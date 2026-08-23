// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageUploader, { isSupportedImage } from '../client/src/components/ImageUploader';

describe('ImageUploader على هاتف Android', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:blocked-photo'), configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bitmap unavailable')));
    vi.stubGlobal('Image', class {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event | string) => void) | null = null;
      width = 0;
      height = 0;
      naturalWidth = 0;
      naturalHeight = 0;
      decoding = 'async';
      set src(_: string) { queueMicrotask(() => this.onerror?.(new Event('error'))); }
    });
    vi.stubGlobal('FileReader', class {
      result: string | null = null;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onabort: ((event: Event) => void) | null = null;
      readAsDataURL() { queueMicrotask(() => this.onerror?.(new Event('error'))); }
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('يعرض زر الكاميرا بعد خطأ FILE_READ_UNAVAILABLE ويطلب منتقي صورة عام', async () => {
    const { container } = render(<ImageUploader onImageSelect={vi.fn()} />);
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const galleryInput = inputs[0];
    const cameraInput = container.querySelector<HTMLInputElement>('input[capture="environment"]');
    const cameraClick = vi.spyOn(cameraInput!, 'click');

    expect(galleryInput.accept).toContain('image/*');
    expect(galleryInput.accept).toContain('.heic');
    expect(cameraInput?.accept).toContain('image/*');

    const file = new File(['photo'], 'dress.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    await screen.findByText(/تعذّرت قراءة ملف الصورة من مزود المعرض/);
    fireEvent.click(screen.getByRole('button', { name: 'جرّب التقاط صورة الآن' }));
    await waitFor(() => expect(cameraClick).toHaveBeenCalledOnce());
  });

  it('يربط زري المعرض والكاميرا بمدخلي ملفات أصليين لفتح الاختيار من لمسة مباشرة', () => {
    const { container } = render(<ImageUploader onImageSelect={vi.fn()} />);
    const galleryInput = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
    const cameraInput = container.querySelector<HTMLInputElement>('input[capture="environment"]');
    const galleryButton = screen.getByRole('button', { name: 'من المعرض' });
    const cameraButton = screen.getByRole('button', { name: 'بالكاميرا' });

    expect(galleryButton.getAttribute('for')).toBe(galleryInput?.id);
    expect(cameraButton.getAttribute('for')).toBe(cameraInput?.id);
    expect(cameraInput?.getAttribute('capture')).toBe('environment');
  });

  it('يقبل صورة معرض مجهولة النوع أو HEIC بالاسم ويستبعد الملفات غير الصورية', () => {
    expect(isSupportedImage(new File(['photo'], 'WhatsApp Image 2026', { type: 'application/octet-stream' }))).toBe(true);
    expect(isSupportedImage(new File(['photo'], 'portrait.heic', { type: '' }))).toBe(true);
    expect(isSupportedImage(new File(['document'], 'invoice.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});
