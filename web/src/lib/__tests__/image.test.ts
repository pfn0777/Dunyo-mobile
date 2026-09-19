import { describe, expect, it } from 'vitest';
import { computeResizedDimensions, MAIN_LONG_SIDE_PX, THUMB_LONG_SIDE_PX } from '../image.ts';

describe('computeResizedDimensions', () => {
  it('scales the long side (width) down to the target, preserving aspect ratio', () => {
    expect(computeResizedDimensions(2000, 1000, THUMB_LONG_SIDE_PX)).toEqual({ width: 400, height: 200 });
  });

  it('scales the long side (height) down to the target, preserving aspect ratio', () => {
    expect(computeResizedDimensions(1000, 2000, THUMB_LONG_SIDE_PX)).toEqual({ width: 200, height: 400 });
  });

  it('handles square images', () => {
    expect(computeResizedDimensions(800, 800, MAIN_LONG_SIDE_PX)).toEqual({ width: 800, height: 800 });
  });

  it('never upscales an image smaller than the target', () => {
    expect(computeResizedDimensions(300, 150, THUMB_LONG_SIDE_PX)).toEqual({ width: 300, height: 150 });
  });

  it('returns unchanged dimensions when the long side exactly equals the target', () => {
    expect(computeResizedDimensions(400, 200, THUMB_LONG_SIDE_PX)).toEqual({ width: 400, height: 200 });
  });

  it('rounds fractional pixel results', () => {
    // long side 1001 -> scale 1000/1001; 333 * scale = 332.667 -> rounds to 333
    expect(computeResizedDimensions(1001, 333, MAIN_LONG_SIDE_PX)).toEqual({ width: 1000, height: 333 });
  });

  it('never produces a zero dimension', () => {
    const result = computeResizedDimensions(10000, 1, THUMB_LONG_SIDE_PX);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
