/**
 * Character-class predicates for the Klein scanner.
 *
 * These are pure, total helpers over single UTF-16 code units (the one-character
 * strings the scanner peeks). They are deliberately ASCII-only: Klein identifiers
 * and numeric literals are ASCII by design (see `docs/LANGUAGE.md`), so lexical
 * classification never needs Unicode letter tables. Every predicate returns
 * `false` for the empty string, which is what `String.charAt` yields past the end
 * of input — so callers can classify "the next character" without a separate
 * end-of-input guard.
 */

/** True iff `ch` is a decimal digit `0`–`9`. */
export function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/** True iff `ch` is a hexadecimal digit `0`–`9`, `a`–`f`, or `A`–`F`. */
export function isHexDigit(ch: string): boolean {
  return (
    (ch >= "0" && ch <= "9") ||
    (ch >= "a" && ch <= "f") ||
    (ch >= "A" && ch <= "F")
  );
}

/**
 * True iff `ch` may begin an identifier: an ASCII letter or an underscore.
 * Digits are excluded here (an identifier may not start with a digit) but are
 * admitted by {@link isAlphaNum} for the continuation of an identifier.
 */
export function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

/** True iff `ch` may continue an identifier: an {@link isAlpha} char or a digit. */
export function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch);
}
