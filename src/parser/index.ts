/**
 * `src/parser` public barrel — the parsing stage of the Klein pipeline.
 *
 * Downstream stages (the runtime, the `interpret()` facade) construct the concrete
 * `Parser` from here, feeding it the lexer's token stream:
 *
 *     import { Lexer } from "../lexer";
 *     import { Parser } from "../parser";
 *     const { tokens } = new Lexer(source, sourceName).tokenize();
 *     const { program, errors } = new Parser(tokens, sourceName).parse();
 *
 * The AST / token / error vocabulary the parser produces lives in `@contracts` and
 * is imported from there, not re-exported here. The precedence table is an
 * internal implementation detail and is intentionally not part of this surface.
 * This file is a pure re-export barrel (no logic) and is excluded from coverage
 * per `vitest.config.ts`.
 */

export { Parser } from "./parser";
