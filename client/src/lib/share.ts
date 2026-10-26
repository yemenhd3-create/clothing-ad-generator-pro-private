import { shareImageThroughNativeAndroid } from './nativeAndroidShare';

/**
 * Share and Download Utilities
 * Handles sharing to WhatsApp, email, and downloading images
 */

/**
 * Share to WhatsApp
 */
export function shareToWhatsApp(
  imageUrl: string,
  caption: string = 'تحقق من هذا الإعلان الرائع!'
): void {
  try {
    const encodedCaption = encodeURIComponent(caption);
    const whatsappUrl = `https://wa.me/?text=${encodedCaption}%20${encodeURIComponent(imageUrl)}`;
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Failed to share to WhatsApp:', error);
    throw new Error('فشل في المشاركة عبر واتساب');
  }
}

/**
 * Share to Email
 */
export function shareToEmail(
  imageUrl: string,
  subject: string = 'إعلان منتج جديد',
  body: string = 'تحقق من هذا الإعلان الرائع!'
): void {
  try {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(`${body}\n\n${imageUrl}`);
    const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    window.location.href = mailtoUrl;
  } catch (error) {
    console.error('Failed to share to email:', error);
    throw new Error('فشل في المشاركة عبر البريد الإلكتروني');
  }
}

/**
 * Copy image to clipboard
 */
export async function copyToClipboard(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    } else {
      // Fallback for older browsers
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ad.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Download image
 */
export function downloadImage(
  imageUrl: string,
  filename: string = 'إعلان-المنتج.png'
): void {
  try {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to download image:', error);
    throw new Error('فشل في تنزيل الصورة');
  }
}

/**
 * Share using Web Share API (if available)
 */
export async function shareViaWebAPI(
  imageUrl: string,
  title: string = 'إعلان منتج',
  text: string = 'تحقق من هذا الإعلان الرائع!'
): Promise<boolean> {
  try {
    if (await shareImageThroughNativeAndroid(imageUrl, title, text)) {
      return true;
    }
    if (!navigator.share) {
      console.warn('Web Share API not available');
      return false;
    }

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'ad.png', { type: 'image/png' });

    await navigator.share({
      title,
      text,
      files: [file],
    });

    return true;
  } catch (error) {
    console.error('Failed to share via Web API:', error);
    return false;
  }
}

/**
 * Generate shareable link with image data
 */
export function generateShareLink(imageBase64: string, productName: string): string {
  try {
    const data = {
      image: imageBase64,
      product: productName,
      timestamp: Date.now(),
    };

    const encoded = btoa(JSON.stringify(data));
    return `${window.location.origin}?share=${encoded}`;
  } catch (error) {
    console.error('Failed to generate share link:', error);
    return '';
  }
}

/**
 * Parse shared data from URL
 */
export function parseShareLink(
  shareData: string
): { image: string; product: string; timestamp: number } | null {
  try {
    const decoded = atob(shareData);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to parse share link:', error);
    return null;
  }
}

/**
 * Create a canvas from image URL
 */
export async function canvasFromImageUrl(imageUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Convert canvas to blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Compress image
 */
export async function compressImage(
  imageUrl: string,
  maxWidth: number = 1080,
  maxHeight: number = 1350,
  quality: number = 0.8
): Promise<string> {
  try {
    const canvas = await canvasFromImageUrl(imageUrl);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate new dimensions
    let width = canvas.width;
    let height = canvas.height;

    if (width > maxWidth || height > maxHeight) {
      const aspectRatio = width / height;

      if (width > height) {
        width = maxWidth;
        height = Math.round(width / aspectRatio);
      } else {
        height = maxHeight;
        width = Math.round(height * aspectRatio);
      }

      const newCanvas = document.createElement('canvas');
      newCanvas.width = width;
      newCanvas.height = height;

      const newCtx = newCanvas.getContext('2d');
      if (!newCtx) {
        throw new Error('Failed to get new canvas context');
      }

      newCtx.drawImage(canvas, 0, 0, width, height);
      return newCanvas.toDataURL('image/png', quality);
    }

    return canvas.toDataURL('image/png', quality);
  } catch (error) {
    console.error('Failed to compress image:', error);
    throw error;
  }
}
