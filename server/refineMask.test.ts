import { describe, expect, it } from 'vitest';
import { refineU2NetMask } from '../client/src/lib/localBackgroundRemovalSupport';

function block(mask: Uint8ClampedArray, size: number, x0: number, y0: number, w: number, h: number, value = 255) {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) mask[y * size + x] = value;
}

describe('refineU2NetMask', () => {
  it('removes a small detached blob but keeps the main subject', () => {
    const size = 40;
    const mask = new Uint8ClampedArray(size * size);
    block(mask, size, 5, 5, 20, 25);
    block(mask, size, 33, 2, 3, 3);
    const out = refineU2NetMask(mask, size);
    expect(out[10 * size + 10]).toBe(255);
    expect(out[3 * size + 34]).toBe(0);
  });
  it('keeps a second large part such as a separate sleeve', () => {
    const size = 40;
    const mask = new Uint8ClampedArray(size * size);
    block(mask, size, 2, 2, 12, 12);
    block(mask, size, 22, 22, 12, 12);
    const out = refineU2NetMask(mask, size);
    expect(out[8 * size + 8]).toBe(255);
    expect(out[28 * size + 28]).toBe(255);
  });
  it('returns an empty mask unchanged and ignores wrong sizes', () => {
    expect(refineU2NetMask(new Uint8ClampedArray(16), 4).every(v => v === 0)).toBe(true);
    const odd = new Uint8ClampedArray(10);
    expect(refineU2NetMask(odd, 4)).toBe(odd);
  });
});
