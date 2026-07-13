/**
 * `src/lexer` public barrel — the scanning stage of the Klein pipeline.
 *
 * Downstream stages (the parser, the `interpret()` facade) construct the concrete
 * `Lexer` from here:
 *
 *     import { Lexer } from "../lexer";
 *     const { tokens, errors } = new Lexer(source, sourceName).tokenize();
 *
 * The token/error vocabulary the lexer produces lives in `@contracts` and is
 * imported from there, not re-exported here. This file is a pure re-export barrel
 * (no logic) and is excluded from coverage per `vitest.config.ts`.
 */

export { Lexer } from "./lexer";
