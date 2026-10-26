import { describe, expect, it } from 'vitest';
import { getAnimationAngle } from '../client/src/lib/animatedAdRenderer';

describe('animated ad motion', () => {
  it('creates a smooth light swing within the approved range', () => {
    const values = Array.from({ length: 12 }, (_, index) => getAnimationAngle('swing', index, 12, 'light'));
    expect(Math.max(...values)).toBeLessThanOrEqual(8);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-8);
    expect(values[0]).toBeCloseTo(0);
    expect(values.at(-1)).toBeCloseTo(0);
  });

  it('supports a top-center pivot mode without changing motion values', () => {
    expect(getAnimationAngle('swing', 3, 12, 'medium')).toBeGreaterThan(0);
    expect(getAnimationAngle('swing', 9, 12, 'medium')).toBeLessThan(0);
  });

  it('keeps rotate as an explicit optional visual mode', () => {
    expect(getAnimationAngle('rotate', 0, 12, 'strong')).toBe(0);
    expect(getAnimationAngle('rotate', 11, 12, 'strong')).toBe(330);
  });
});
