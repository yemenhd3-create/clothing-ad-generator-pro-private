declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options: Record<string, unknown>): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(pixels: Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>): number[][];
  export function applyPalette(pixels: Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
