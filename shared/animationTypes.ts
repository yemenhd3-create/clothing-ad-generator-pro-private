export type ProductAnimationType = 'swing' | 'float' | 'rotate';
export type ProductAnimationPivot = 'center' | 'top-center';

export type ProductAnimationSettings = {
  enabled: boolean;
  type: ProductAnimationType;
  intensity: 'light' | 'medium' | 'strong';
  frameCount: number;
  frameDurationMs: number;
  pivot: ProductAnimationPivot;
  outputWidth: number;
  loop: boolean;
};

export const DEFAULT_PRODUCT_ANIMATION_SETTINGS: ProductAnimationSettings = {
  enabled: true,
  type: 'swing',
  intensity: 'light',
  frameCount: 12,
  frameDurationMs: 90,
  pivot: 'top-center',
  outputWidth: 720,
  loop: true,
};
