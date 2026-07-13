/**
 * The Klein tree-walking interpreter — the concrete realization of the
 * `Interpreter` interface declared in `contracts/values.ts`.
 *
 * This module is the runtime's **evaluator**: one cohesive, mutually-recursive
 * visitor over the AST that composes the two sibling runtime modules — the value
 * model (`./values`) and the lexical scope chain (`./environment`) — into a
 * working interpreter. It owns exactly one responsibility: *evaluate a `Program`
 * to a `Value`*, with the language's semantics fixed by `docs/LANGUAGE.md`.
 *
 * The design in one paragraph. Expressions evaluate to `Value`s
 * ({@link Interpreter.evalExpression}); statements execute for effect and yield a
 * {@link Signal} that models `return` / `break` / `continue` as **internal
 * control-flow signals** threaded up the statement-execution chain
 * ({@link Interpreter.execStatement}). Those signals are never `throw`n and are
 * never observable to callers as JS values — a function call converts a `return`
 * signal into its result value, and loops consume `break`/`continue`. The only
 * thing that ever escapes the evaluator is a {@link RuntimeErr} (from `@core`) on
 * a genuine runtime fault, carrying the correct `ErrorCode`, a real `Span`, and
 * the maintained Klein call stack (innermost frame last).
 *
 * Composition, not reimplementation. Value construction, truthiness, structural
 * equality, and stringification live in `./values`; binding/lookup/shadowing live
 * in `./environment`. This module imports and calls them — it never re-derives a
 * value constructor, the truthiness rule, the equality relation, or the scope
 * chain. Builtins are **injected** via `InterpreterOptions.builtins` and installed
 * into `globals`; no standard library is hardcoded here (that is the `stdlib`
 * task). Injected builtins run through the same call machinery as user functions
 * via {@link BuiltinContext}, so higher-order builtins (`map`, `filter`) that call
 * back into user code preserve stack frames and error handling.
 */

import {
  ErrorCode,
  ValueKind,
  type AssignmentExpression,
  type BinaryOperator,
  type BuiltinContext,
  type BuiltinValue,
  type Environment,
  type Expression,
  type FunctionValue,
  type IndexExpression,
  type Interpreter as InterpreterContract,
  type InterpreterOptions,
  type MemberExpression,
  type Program,
  type Span,
  type StackFrame,
  type Statement,
  type UnaryOperator,
  type Value,
} from "@contracts";
import { RuntimeErr } from "@core";

import { Environment as EnvironmentImpl } from "./environment";
import {
  isTruthy,
  makeArray,
  makeBoolean,
  makeFunction,
  makeNull,
  makeNumber,
  makeObject,
  makeString,
  valuesEqual,
} from "./values";

// ─────────────────────────────────────────────────────────────────────────────
// Control-flow signals (internal — never thrown, never observable to callers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The completion of a statement. `execStatement` returns one of these so `return`
 * / `break` / `continue` propagate up the statement chain as ordinary data rather
 * than as host exceptions. A function call consumes `return`; a loop consumes
 * `break` / `continue`; `normal` means "fell through, keep going".
 */
type Signal =
  | { readonly type: "normal" }
  | { readonly type: "break" }
  | { readonly type: "continue" }
  | { readonly type: "return"; readonly value: Value };

/** The three operand-less signals are shared singletons (they carry no payload). */
const NORMAL: Signal = { type: "normal" };
const BREAK: Signal = { type: "break" };
const CONTINUE: Signal = { type: "continue" };

/** The default maximum user-function call depth (guards the host stack). */
const DEFAULT_MAX_CALL_DEPTH = 1000;

/** The synthetic name of the top-level (program) call-stack frame. */
const SCRIPT_FRAME = "<script>";
/** The call-stack name used for anonymous function literals. */
const ANONYMOUS_FRAME = "<anonymous>";

// ─────────────────────────────────────────────────────────────────────────────
// The interpreter
// ─────────────────────────────────────────────────────────────────────────────

export class Interpreter implements InterpreterContract {
  /** The global (outermost) scope; injected builtins are installed here. */
  readonly globals: Environment;

  /** Output sink for builtins' `write` capability. */
  private readonly write: (text: string) => void;

  /** Capabilities handed to every builtin: `write` + re-entrant `call`. */
  private readonly builtinContext: BuiltinContext;

  /** Max user-function call depth before {@link ErrorCode.StackOverflow}. */
  private readonly maxCallDepth: number;

  /** The live Klein call stack, innermost frame last. Snapshotted onto errors. */
  private readonly stack: StackFrame[] = [];

  /** Current user-function call depth (drives the StackOverflow guard). */
  private depth = 0;

  constructor(options: InterpreterOptions = {}) {
    this.globals = new EnvironmentImpl();
    this.write =
      options.write ??
      ((text: string): void => {
        process.stdout.write(text);
      });
    this.maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH;
    // `call` re-enters the SAME machinery so higher-order builtins preserve
    // frames, depth, and error handling; `write` forwards to the configured sink.
    this.builtinContext = {
      write: (text: string): void => this.write(text),
      call: (callee: Value, args: readonly Value[], span: Span): Value =>
        this.callValue(callee, args, span),
    };
    // Install injected builtins into globals. No stdlib is hardcoded here; the
    // caller (the CLI facade) supplies the roster. Default: none.
    for (const builtin of options.builtins ?? []) {
      this.globals.define(builtin.name, builtin);
    }
  }

  /**
   * Evaluate a whole program. Runs its top-level statements in the global scope
   * and returns the value of the **final top-level expression statement**, or
   * `null` when the program has none (per `Interpreter.run` in the contract and
   * `docs/LANGUAGE.md#result-of-a-program`). Throws {@link RuntimeErr} on the
   * first runtime fault.
   */
  run(program: Program): Value {
    // Fresh stack per run; push the base <script> frame so even a top-level
    // fault carries a one-frame call stack.
    this.stack.length = 0;
    this.depth = 0;
    this.stack.push({ functionName: SCRIPT_FRAME, span: program.span });
    try {
      let result: Value = makeNull();
      // Hoist top-level function declarations by value so forward references and
      // mutual recursion resolve regardless of textual order.
      this.hoist(program.body, this.globals);
      for (const statement of program.body) {
        if (statement.kind === "FunctionDeclaration") {
          continue; // already hoisted
        }
        if (statement.kind === "ExpressionStatement") {
          // Only TOP-LEVEL expression statements contribute the program result.
          result = this.evalExpression(statement.expression, this.globals);
          continue;
        }
        // Any control-flow signal at the top level (a stray break/continue/return)
        // has no enclosing consumer and is simply discarded.
        this.execStatement(statement, this.globals);
      }
      return result;
    } finally {
      this.stack.pop();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Statement execution
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Execute a list of statements in `env`, first hoisting its function
   * declarations. Returns the first non-`normal` {@link Signal} produced, so
   * `return` / `break` / `continue` short-circuit the remaining statements.
   */
  private runStatements(
    statements: readonly Statement[],
    env: Environment,
  ): Signal {
    this.hoist(statements, env);
    for (const statement of statements) {
      if (statement.kind === "FunctionDeclaration") {
        continue; // already hoisted
      }
      const signal = this.execStatement(statement, env);
      if (signal.type !== "normal") {
        return signal;
      }
    }
    return NORMAL;
  }

  /** Bind every `FunctionDeclaration` in `statements` into `env` (hoist by value). */
  private hoist(statements: readonly Statement[], env: Environment): void {
    for (const statement of statements) {
      if (statement.kind === "FunctionDeclaration") {
        env.define(
          statement.name,
          makeFunction(statement, env, statement.name),
        );
      }
    }
  }

  /** Execute a block in a fresh child scope of `env`. */
  private execBlock(
    block: { readonly statements: readonly Statement[] },
    env: Environment,
  ): Signal {
    return this.runStatements(block.statements, env.child());
  }

  /** Execute one statement for effect, returning its control-flow {@link Signal}. */
  private execStatement(statement: Statement, env: Environment): Signal {
    switch (statement.kind) {
      case "LetStatement":
        env.define(statement.name, this.evalExpression(statement.value, env));
        return NORMAL;

      case "ExpressionStatement":
        this.evalExpression(statement.expression, env);
        return NORMAL;

      case "BlockStatement":
        return this.execBlock(statement, env);

      case "IfStatement": {
        if (isTruthy(this.evalExpression(statement.condition, env))) {
          return this.execBlock(statement.consequent, env);
        }
        if (statement.alternate === null) {
          return NORMAL;
        }
        // `else if` is an alternate that is itself an IfStatement; a final `else`
        // is a BlockStatement.
        return statement.alternate.kind === "BlockStatement"
          ? this.execBlock(statement.alternate, env)
          : this.execStatement(statement.alternate, env);
      }

      case "WhileStatement": {
        for (;;) {
          if (!isTruthy(this.evalExpression(statement.condition, env))) {
            break;
          }
          const signal = this.execBlock(statement.body, env);
          if (signal.type === "break") {
            break;
          }
          if (signal.type === "return") {
            return signal;
          }
          // "normal" and "continue" both fall through to re-check the condition.
        }
        return NORMAL;
      }

      case "ForStatement": {
        // The loop gets its own scope so a `let` in the init clause is scoped to
        // the loop and its update/condition can see it.
        const loopEnv = env.child();
        if (statement.init !== null) {
          this.execStatement(statement.init, loopEnv);
        }
        for (;;) {
          // An omitted condition is treated as always true.
          if (
            statement.condition !== null &&
            !isTruthy(this.evalExpression(statement.condition, loopEnv))
          ) {
            break;
          }
          const signal = this.execBlock(statement.body, loopEnv);
          if (signal.type === "break") {
            break;
          }
          if (signal.type === "return") {
            return signal;
          }
          // "continue" skips the rest of the body but STILL runs the update.
          if (statement.update !== null) {
            this.evalExpression(statement.update, loopEnv);
          }
        }
        return NORMAL;
      }

      case "ReturnStatement":
        return {
          type: "return",
          value:
            statement.value === null
              ? makeNull()
              : this.evalExpression(statement.value, env),
        };

      case "BreakStatement":
        return BREAK;

      case "ContinueStatement":
        return CONTINUE;

      case "FunctionDeclaration":
        // Normally hoisted (and skipped) by `runStatements`/`run`; handled here
        // defensively so the switch is total and correct if executed directly.
        env.define(
          statement.name,
          makeFunction(statement, env, statement.name),
        );
        return NORMAL;

      default:
        return assertNever(statement);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Expression evaluation
  // ───────────────────────────────────────────────────────────────────────────

  /** Evaluate one expression to a {@link Value}. */
  private evalExpression(expression: Expression, env: Environment): Value {
    switch (expression.kind) {
      case "NumberLiteral":
        return makeNumber(expression.value);

      case "StringLiteral":
        return makeString(expression.value);

      case "BooleanLiteral":
        return makeBoolean(expression.value);

      case "NullLiteral":
        return makeNull();

      case "Identifier":
        return this.lookup(env, expression.name, expression.span);

      case "ArrayLiteral":
        return makeArray(
          expression.elements.map((element) =>
            this.evalExpression(element, env),
          ),
        );

      case "ObjectLiteral": {
        // Insertion order is observable; a later duplicate key overwrites the
        // value while keeping the key's original position (Map semantics).
        const entries = new Map<string, Value>();
        for (const entry of expression.entries) {
          entries.set(entry.key, this.evalExpression(entry.value, env));
        }
        return makeObject(entries);
      }

      case "FunctionLiteral":
        return makeFunction(expression, env, null);

      case "UnaryExpression":
        return this.evalUnary(
          expression.operator,
          this.evalExpression(expression.operand, env),
          expression.span,
        );

      case "BinaryExpression":
        return this.evalBinary(
          expression.operator,
          this.evalExpression(expression.left, env),
          this.evalExpression(expression.right, env),
          expression.span,
        );

      case "LogicalExpression": {
        // Short-circuit, yielding one of the OPERAND values (not a coerced
        // boolean), per docs/LANGUAGE.md#logical-operators.
        const left = this.evalExpression(expression.left, env);
        if (expression.operator === "&&") {
          return isTruthy(left)
            ? this.evalExpression(expression.right, env)
            : left;
        }
        return isTruthy(left)
          ? left
          : this.evalExpression(expression.right, env);
      }

      case "AssignmentExpression":
        return this.evalAssignment(expression, env);

      case "CallExpression": {
        const callee = this.evalExpression(expression.callee, env);
        const args = expression.args.map((arg) =>
          this.evalExpression(arg, env),
        );
        return this.callValue(callee, args, expression.span);
      }

      case "IndexExpression":
        return this.evalIndexGet(expression, env);

      case "MemberExpression":
        return this.evalMemberGet(expression, env);

      default:
        return assertNever(expression);
    }
  }

  /** Read a variable, threading the Klein call stack onto an undefined-variable fault. */
  private lookup(env: Environment, name: string, span: Span): Value {
    try {
      return env.get(name, span);
    } catch (error) {
      throw this.withStack(error);
    }
  }

  private evalUnary(
    operator: UnaryOperator,
    operand: Value,
    span: Span,
  ): Value {
    switch (operator) {
      case "-":
        if (operand.kind !== ValueKind.Number) {
          this.fail(
            ErrorCode.InvalidOperand,
            `unary '-' expects a number, got ${operand.kind}`,
            span,
          );
        }
        return makeNumber(-operand.value);
      case "!":
        // `!` is total over every value via truthiness and never faults.
        return makeBoolean(!isTruthy(operand));
      default:
        return assertNever(operator);
    }
  }

  private evalBinary(
    operator: BinaryOperator,
    left: Value,
    right: Value,
    span: Span,
  ): Value {
    switch (operator) {
      case "==":
        return makeBoolean(valuesEqual(left, right));
      case "!=":
        return makeBoolean(!valuesEqual(left, right));
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
        return this.arithmetic(operator, left, right, span);
      case "<":
      case ">":
      case "<=":
      case ">=":
        return this.compare(operator, left, right, span);
      default:
        return assertNever(operator);
    }
  }

  /**
   * Arithmetic and string concatenation. `+` accepts two numbers (add) or two
   * strings (concatenate); the other operators accept two numbers. An operand of
   * a categorically-unacceptable kind is {@link ErrorCode.InvalidOperand}; two
   * individually-acceptable but mismatched operands (number `+` string) are
   * {@link ErrorCode.TypeMismatch}. No implicit conversions.
   */
  private arithmetic(
    operator: "+" | "-" | "*" | "/" | "%",
    left: Value,
    right: Value,
    span: Span,
  ): Value {
    if (operator === "+") {
      if (left.kind === ValueKind.Number && right.kind === ValueKind.Number) {
        return makeNumber(left.value + right.value);
      }
      if (left.kind === ValueKind.String && right.kind === ValueKind.String) {
        return makeString(left.value + right.value);
      }
      const numericOrString = (v: Value): boolean =>
        v.kind === ValueKind.Number || v.kind === ValueKind.String;
      if (!numericOrString(left) || !numericOrString(right)) {
        this.fail(
          ErrorCode.InvalidOperand,
          `operator '+' cannot be applied to ${left.kind} and ${right.kind}`,
          span,
        );
      }
      this.fail(
        ErrorCode.TypeMismatch,
        `operator '+' requires two numbers or two strings, got ${left.kind} and ${right.kind}`,
        span,
      );
    }

    // "-", "*", "/", "%": both operands must be numbers.
    if (left.kind !== ValueKind.Number || right.kind !== ValueKind.Number) {
      this.fail(
        ErrorCode.InvalidOperand,
        `operator '${operator}' expects two numbers, got ${left.kind} and ${right.kind}`,
        span,
      );
    }
    if ((operator === "/" || operator === "%") && right.value === 0) {
      this.fail(ErrorCode.DivisionByZero, `division by zero`, span);
    }
    switch (operator) {
      case "-":
        return makeNumber(left.value - right.value);
      case "*":
        return makeNumber(left.value * right.value);
      case "/":
        return makeNumber(left.value / right.value);
      case "%":
        return makeNumber(left.value % right.value);
      default:
        return assertNever(operator);
    }
  }

  /**
   * Ordered comparison. Numbers compare with IEEE-754 ordering; strings compare
   * lexicographically (by UTF-16 code unit). An unsupported operand kind is
   * {@link ErrorCode.InvalidOperand}; a number-vs-string mismatch is
   * {@link ErrorCode.TypeMismatch}.
   */
  private compare(
    operator: "<" | ">" | "<=" | ">=",
    left: Value,
    right: Value,
    span: Span,
  ): Value {
    const orderable = (v: Value): boolean =>
      v.kind === ValueKind.Number || v.kind === ValueKind.String;
    if (!orderable(left) || !orderable(right)) {
      this.fail(
        ErrorCode.InvalidOperand,
        `operator '${operator}' cannot compare ${left.kind} and ${right.kind}`,
        span,
      );
    }
    if (left.kind === ValueKind.Number && right.kind === ValueKind.Number) {
      return makeBoolean(this.applyOrder(operator, left.value, right.value));
    }
    if (left.kind === ValueKind.String && right.kind === ValueKind.String) {
      return makeBoolean(this.applyOrder(operator, left.value, right.value));
    }
    this.fail(
      ErrorCode.TypeMismatch,
      `operator '${operator}' cannot compare ${left.kind} and ${right.kind}`,
      span,
    );
  }

  /** The ordering relation for two same-typed comparable operands. */
  private applyOrder<T extends number | string>(
    operator: "<" | ">" | "<=" | ">=",
    left: T,
    right: T,
  ): boolean {
    switch (operator) {
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        return assertNever(operator);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Assignment, indexing, member access
  // ───────────────────────────────────────────────────────────────────────────

  private evalAssignment(
    expression: AssignmentExpression,
    env: Environment,
  ): Value {
    const target = expression.target;
    switch (target.kind) {
      case "Identifier": {
        const value = this.evalExpression(expression.value, env);
        try {
          env.assign(target.name, value, target.span);
        } catch (error) {
          throw this.withStack(error);
        }
        return value;
      }
      case "IndexExpression":
        return this.evalIndexSet(target, expression.value, env);
      case "MemberExpression":
        return this.evalMemberSet(target, expression.value, env);
      default:
        return assertNever(target);
    }
  }

  private evalIndexGet(expression: IndexExpression, env: Environment): Value {
    const container = this.evalExpression(expression.object, env);
    const index = this.evalExpression(expression.index, env);
    if (container.kind === ValueKind.Array) {
      const i = this.arrayIndex(index, container.elements.length, expression);
      return container.elements[i]!;
    }
    if (container.kind === ValueKind.Object) {
      const key = this.objectKey(index, expression.index.span);
      if (!container.entries.has(key)) {
        this.fail(
          ErrorCode.PropertyNotFound,
          `object has no key '${key}'`,
          expression.span,
        );
      }
      return container.entries.get(key)!;
    }
    this.fail(
      ErrorCode.InvalidIndexTarget,
      `cannot index a value of kind ${container.kind}`,
      expression.span,
    );
  }

  private evalIndexSet(
    target: IndexExpression,
    valueExpression: Expression,
    env: Environment,
  ): Value {
    const container = this.evalExpression(target.object, env);
    const index = this.evalExpression(target.index, env);
    const value = this.evalExpression(valueExpression, env);
    if (container.kind === ValueKind.Array) {
      const i = this.arrayIndex(index, container.elements.length, target);
      container.elements[i] = value;
      return value;
    }
    if (container.kind === ValueKind.Object) {
      const key = this.objectKey(index, target.index.span);
      container.entries.set(key, value);
      return value;
    }
    this.fail(
      ErrorCode.InvalidIndexTarget,
      `cannot index-assign a value of kind ${container.kind}`,
      target.span,
    );
  }

  private evalMemberGet(expression: MemberExpression, env: Environment): Value {
    const container = this.evalExpression(expression.object, env);
    if (container.kind !== ValueKind.Object) {
      this.fail(
        ErrorCode.InvalidIndexTarget,
        `cannot read member '.${expression.property}' of a ${container.kind}`,
        expression.span,
      );
    }
    if (!container.entries.has(expression.property)) {
      this.fail(
        ErrorCode.PropertyNotFound,
        `object has no key '${expression.property}'`,
        expression.propertySpan,
      );
    }
    return container.entries.get(expression.property)!;
  }

  private evalMemberSet(
    target: MemberExpression,
    valueExpression: Expression,
    env: Environment,
  ): Value {
    const container = this.evalExpression(target.object, env);
    const value = this.evalExpression(valueExpression, env);
    if (container.kind !== ValueKind.Object) {
      this.fail(
        ErrorCode.InvalidIndexTarget,
        `cannot assign member '.${target.property}' of a ${container.kind}`,
        target.span,
      );
    }
    container.entries.set(target.property, value);
    return value;
  }

  /**
   * Validate a numeric array index against `length`, returning the JS index.
   * A non-number index is {@link ErrorCode.InvalidIndexType}; a non-integer or
   * out-of-bounds index is {@link ErrorCode.IndexOutOfRange}.
   */
  private arrayIndex(
    index: Value,
    length: number,
    node: IndexExpression,
  ): number {
    if (index.kind !== ValueKind.Number) {
      this.fail(
        ErrorCode.InvalidIndexType,
        `array index must be a number, got ${index.kind}`,
        node.index.span,
      );
    }
    const i = index.value;
    if (!Number.isInteger(i) || i < 0 || i >= length) {
      this.fail(
        ErrorCode.IndexOutOfRange,
        `array index ${formatIndex(i)} is out of range for length ${length}`,
        node.span,
      );
    }
    return i;
  }

  /** Validate an object key: it must be a string ({@link ErrorCode.InvalidIndexType}). */
  private objectKey(index: Value, indexSpan: Span): string {
    if (index.kind !== ValueKind.String) {
      this.fail(
        ErrorCode.InvalidIndexType,
        `object key must be a string, got ${index.kind}`,
        indexSpan,
      );
    }
    return index.value;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Call machinery
  // ───────────────────────────────────────────────────────────────────────────

  /** Dispatch a call to a function or builtin uniformly; else {@link ErrorCode.NotCallable}. */
  private callValue(callee: Value, args: readonly Value[], span: Span): Value {
    if (callee.kind === ValueKind.Function) {
      return this.applyFunction(callee, args, span);
    }
    if (callee.kind === ValueKind.Builtin) {
      return this.applyBuiltin(callee, args, span);
    }
    this.fail(
      ErrorCode.NotCallable,
      `value of kind ${callee.kind} is not callable`,
      span,
    );
  }

  /**
   * Apply a user function: check arity, guard call depth, then evaluate the body
   * in a **fresh scope that is a child of the function's closure** (lexical
   * scoping — not the call site). A `return` signal yields its value; falling off
   * the end (or a stray `break`/`continue`) yields `null`.
   */
  private applyFunction(
    callee: FunctionValue,
    args: readonly Value[],
    callSpan: Span,
  ): Value {
    const params = callee.node.params;
    if (args.length !== params.length) {
      this.fail(
        ErrorCode.WrongArgumentCount,
        `${describeCallee(callee.name)} expects ${params.length} argument(s), got ${args.length}`,
        callSpan,
      );
    }
    if (this.depth >= this.maxCallDepth) {
      this.fail(
        ErrorCode.StackOverflow,
        `maximum call depth ${this.maxCallDepth} exceeded`,
        callSpan,
      );
    }

    this.depth += 1;
    this.stack.push({
      functionName: callee.name ?? ANONYMOUS_FRAME,
      span: callSpan,
    });
    try {
      const scope = callee.closure.child();
      for (let i = 0; i < params.length; i += 1) {
        scope.define(params[i]!.name, args[i]!);
      }
      const signal = this.runStatements(callee.node.body.statements, scope);
      return signal.type === "return" ? signal.value : makeNull();
    } finally {
      this.stack.pop();
      this.depth -= 1;
    }
  }

  /**
   * Apply a builtin: check its arity, push a stack frame, and invoke `impl` with
   * the {@link BuiltinContext}. A {@link RuntimeErr} thrown by the builtin (which
   * has no access to the interpreter's call stack) gets the maintained stack
   * attached here, so builtin faults are anchored like every other runtime error.
   */
  private applyBuiltin(
    callee: BuiltinValue,
    args: readonly Value[],
    callSpan: Span,
  ): Value {
    const { min, max } = callee.arity;
    if (args.length < min || (max !== null && args.length > max)) {
      this.fail(
        ErrorCode.WrongArgumentCount,
        `builtin '${callee.name}' expects ${describeArity(min, max)} argument(s), got ${args.length}`,
        callSpan,
      );
    }
    this.stack.push({ functionName: callee.name, span: callSpan });
    try {
      return callee.impl(args, this.builtinContext, callSpan);
    } catch (error) {
      throw this.withStack(error);
    } finally {
      this.stack.pop();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error plumbing
  // ───────────────────────────────────────────────────────────────────────────

  /** Throw a {@link RuntimeErr} carrying the correct code, span, and a snapshot of the call stack. */
  private fail(code: ErrorCode, message: string, span: Span): never {
    throw new RuntimeErr(code, message, span, this.snapshot());
  }

  /**
   * Attach the current call stack to a {@link RuntimeErr} that lacks one (those
   * thrown by `Environment` or by a builtin, which cannot see the interpreter's
   * stack). Non-`RuntimeErr` throwables and already-stacked errors pass through
   * unchanged.
   */
  private withStack(error: unknown): unknown {
    if (error instanceof RuntimeErr && error.callStack === undefined) {
      return new RuntimeErr(
        error.code,
        error.message,
        error.span,
        this.snapshot(),
      );
    }
    return error;
  }

  /** An immutable copy of the live call stack (innermost frame last). */
  private snapshot(): readonly StackFrame[] {
    return this.stack.slice();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers (module-private)
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable arity, e.g. `2`, `1 to 3`, or `at least 1` (variadic). */
function describeArity(min: number, max: number | null): string {
  if (max === null) {
    return `at least ${min}`;
  }
  return min === max ? `${min}` : `${min} to ${max}`;
}

/** Name a callee for a WrongArgumentCount message. */
function describeCallee(name: string | null): string {
  return name === null ? "anonymous function" : `function '${name}'`;
}

/** Render an out-of-range index for a diagnostic (integers bare; non-integers as-is). */
function formatIndex(index: number): string {
  return String(index);
}

/**
 * Compile-time exhaustiveness guard: if a new AST/operator variant is added to a
 * union without a matching `case`, `value` ceases to be `never` and this fails to
 * type-check. At runtime it defends against a malformed node.
 */
function assertNever(value: never): never {
  throw new Error(
    `unreachable: unhandled variant ${String((value as { kind: unknown }).kind)}`,
  );
}
