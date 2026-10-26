import { describe, expect, it } from 'vitest';
import { buildProductVideoScenes } from '../client/src/lib/productVideoExport';
import { DEFAULT_PRODUCT_VIDEO_SETTINGS, PRODUCT_VIDEO_DIMENSIONS } from '../shared/productVideoTypes';

describe('web product promo video', () => {
  it('uses the WhatsApp portrait preset and optional audio by default', () => {
    expect(DEFAULT_PRODUCT_VIDEO_SETTINGS.preset).toBe('whatsapp');
    expect(DEFAULT_PRODUCT_VIDEO_SETTINGS.durationSeconds).toBe(9);
    expect(DEFAULT_PRODUCT_VIDEO_SETTINGS.includeMusic).toBe(false);
    expect(PRODUCT_VIDEO_DIMENSIONS.whatsapp).toEqual({ width: 720, height: 960, label: 'واتساب 3:4' });
  });

  it('creates ordered scenes that cover the selected duration', () => {
    const scenes = buildProductVideoScenes(9);
    expect(scenes.map(scene => scene.id)).toEqual(['intro', 'reveal', 'details', 'offer', 'outro']);
    expect(scenes[0].start).toBe(0);
    expect(scenes.at(-1)?.end).toBe(9);
    scenes.forEach((scene, index) => {
      expect(scene.end).toBeGreaterThan(scene.start);
      if (index > 0) expect(scene.start).toBe(scenes[index - 1].end);
    });
  });

  it('supports short and extended timelines without exceeding the requested duration', () => {
    for (const duration of [6, 12, 15]) {
      const scenes = buildProductVideoScenes(duration);
      expect(scenes.at(-1)?.end).toBe(duration);
      expect(scenes.every(scene => scene.end > scene.start)).toBe(true);
    }
  });
});
