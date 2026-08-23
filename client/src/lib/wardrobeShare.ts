export function getWardrobeShareText(mode: 'image' | 'whatsapp', marketingText: string): string {
  return mode === 'whatsapp' ? marketingText.trim() : '';
}
