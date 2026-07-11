export type AnchorRect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Viewport = { width: number; height: number };
export type TooltipPosition = { top: number; left: number };

/**
 * Compute a fixed-position tooltip placement anchored to an element's
 * bounding rect. Prefers the right side, flips to the left when the
 * tooltip would overflow the right edge, and clamps within the viewport
 * (with `margin`) on both axes when it doesn't fit either side.
 */
export function computeTooltipPosition(
  anchor: AnchorRect,
  tooltip: Size,
  viewport: Viewport,
  margin = 12,
): TooltipPosition {
  const rightLeft = anchor.left + anchor.width + margin;
  const fitsRight = rightLeft + tooltip.width <= viewport.width - margin;
  const leftSideLeft = anchor.left - margin - tooltip.width;
  const fitsLeft = leftSideLeft >= margin;

  let left: number;
  if (fitsRight) {
    left = rightLeft;
  } else if (fitsLeft) {
    left = leftSideLeft;
  } else {
    // Neither side fits — clamp within the viewport.
    left = Math.max(margin, Math.min(rightLeft, viewport.width - margin - tooltip.width));
  }

  let top = anchor.top;
  if (top + tooltip.height > viewport.height - margin) {
    top = viewport.height - margin - tooltip.height;
  }
  if (top < margin) {
    top = margin;
  }

  return { top, left };
}
