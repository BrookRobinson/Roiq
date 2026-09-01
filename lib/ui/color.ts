/**
 * A translucent version of a colour, for a wash or a border.
 *
 * The codebase reaches for `${color}1f` — append a hex alpha to a hex colour.
 * That works right up until the colour is a CSS VARIABLE, which most of our
 * accents are (`var(--good)`, `var(--bad)`, `var(--warn)`): the result is
 * `var(--good)1f`, which is not a colour, so the declaration is DROPPED and the
 * element renders with no background at all. It fails silently and looks like a
 * design choice — the score badges in the report had been rendering with no
 * wash and no border for as long as they had been using variables, and it was
 * only noticed when something had to sit inside one.
 *
 * `color-mix` takes either form, so this is safe on a hex and on a variable.
 */
export function alpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
