import type { WheelEvent } from "react";

/**
 * Stop the mouse wheel from editing a number field.
 *
 * A focused <input type="number"> treats wheel events as increment/decrement, so
 * scrolling the page with the cursor over one silently changes the value —
 * someone scrolls past the Variables form and their budget quietly drops, which
 * on the map re-colours or hides every pin with no visible cause. Blurring on
 * wheel hands the scroll back to the page.
 */
export const blurOnWheel = (e: WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
