export type ProductVideoPreset = 'whatsapp' | 'story' | 'square' | 'portrait';
export type ProductVideoStyle = 'studio' | 'before-after' | 'store-fast';
export type ProductVideoDuration = 6 | 9 | 12 | 15;
export type ProductVideoExportFormat = 'webm' | 'mp4';

export type ProductVideoSettings = {
  preset: ProductVideoPreset;
  style: ProductVideoStyle;
  durationSeconds: ProductVideoDuration;
  fps: 24 | 30;
  includeMusic: boolean;
  quality: 'light' | 'balanced' | 'high';
};

export type ProductVideoScene = {
  id: 'intro' | 'reveal' | 'details' | 'offer' | 'outro';
  start: number;
  end: number;
};

export const PRODUCT_VIDEO_DIMENSIONS: Record<ProductVideoPreset, { width: number; height: number; label: string }> = {
  whatsapp: { width: 720, height: 960, label: 'واتساب 3:4' },
  story: { width: 720, height: 1280, label: 'ستوري 9:16' },
  square: { width: 720, height: 720, label: 'مربع 1:1' },
  portrait: { width: 720, height: 900, label: 'عمودي 4:5' },
};

export const DEFAULT_PRODUCT_VIDEO_SETTINGS: ProductVideoSettings = {
  preset: 'whatsapp',
  style: 'studio',
  durationSeconds: 9,
  fps: 30,
  includeMusic: false,
  quality: 'balanced',
};
