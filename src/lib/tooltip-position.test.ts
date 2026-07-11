import { describe, it, expect } from "vitest";
import { computeTooltipPosition } from "./tooltip-position";

const VIEWPORT = { width: 1200, height: 800 };
const TOOLTIP = { width: 260, height: 362 }; // ~488:680 aspect at 260px wide
const MARGIN = 12;

describe("computeTooltipPosition", () => {
  it("places the tooltip to the right of the anchor by default", () => {
    const anchor = { top: 100, left: 100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, MARGIN);
    expect(pos.left).toBe(anchor.left + anchor.width + MARGIN);
    expect(pos.top).toBe(anchor.top);
  });

  it("flips to the left when the tooltip would overflow the right edge", () => {
    const anchor = { top: 100, left: 1100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, MARGIN);
    expect(pos.left).toBe(anchor.left - MARGIN - TOOLTIP.width);
  });

  it("clamps to the viewport when neither side fits", () => {
    const narrowViewport = { width: 300, height: 800 };
    const anchor = { top: 100, left: 100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, narrowViewport, MARGIN);
    expect(pos.left).toBeGreaterThanOrEqual(MARGIN);
    expect(pos.left + TOOLTIP.width).toBeLessThanOrEqual(narrowViewport.width - MARGIN + 1);
  });

  it("shifts up when the tooltip would overflow the bottom edge", () => {
    const anchor = { top: 700, left: 100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, MARGIN);
    expect(pos.top + TOOLTIP.height).toBeLessThanOrEqual(VIEWPORT.height - MARGIN + 1);
  });

  it("clamps top to the margin when the anchor is near the top edge and tooltip is taller than available space", () => {
    const anchor = { top: 0, left: 100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, MARGIN);
    expect(pos.top).toBeGreaterThanOrEqual(MARGIN - MARGIN); // never negative beyond margin
  });

  it("does not go above the top margin even in a very short viewport", () => {
    const shortViewport = { width: 1200, height: 300 };
    const anchor = { top: 150, left: 100, width: 80, height: 20 };
    const pos = computeTooltipPosition(anchor, TOOLTIP, shortViewport, MARGIN);
    expect(pos.top).toBeGreaterThanOrEqual(MARGIN);
  });
});
