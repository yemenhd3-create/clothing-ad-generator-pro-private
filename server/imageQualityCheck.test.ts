import { describe, expect, it } from 'vitest';
import { assessGrayPixels } from '../client/src/lib/imageQualityCheck';

const size = 32;
const checker = () => Float32Array.from({ length: size * size }, (_, i) => ((i % size) + Math.floor(i / size)) % 2 ? 200 : 100);

describe('assessGrayPixels', () => {
  it('accepts a sharp, well lit, large image', () => {
    expect(assessGrayPixels(checker(), size, size, 1200, 1600).issues).toEqual([]);
  });
  it('flags a flat image as blurry', () => {
    expect(assessGrayPixels(new Float32Array(size * size).fill(130), size, size, 1200, 1600).issues).toContain('blurry');
  });
  it('flags small and dark images', () => {
    const dark = checker().map(v => v * 0.2);
    const report = assessGrayPixels(dark, size, size, 300, 400);
    expect(report.issues).toEqual(expect.arrayContaining(['small', 'dark']));
    expect(report.messages.length).toBe(report.issues.length);
  });
});
