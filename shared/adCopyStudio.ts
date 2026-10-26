export type AdCopyLayerKind = 'productTitle' | 'shortDescription' | 'price' | 'discount' | 'quantity' | 'colors' | 'contact' | 'location' | 'cta';
export type AdCopyTextAlign = 'right' | 'center' | 'left';

export interface AdCopyInput {
  productName: string;
  price: string;
  currency: string;
  storeLocation: string;
  storePhone: string;
  discount: string;
  quantity: string;
  colors: string[];
  cta: string;
  productContext: string;
  selectedFields: AdCopyLayerKind[];
}

export interface AdCopySuggestion {
  productTitle: string;
  shortDescription: string;
  priceText: string;
  discountText: string;
  quantityText: string;
  colorsText: string;
  contactText: string;
  locationText: string;
  ctaText: string;
}

export interface AdCopyLayer {
  id: AdCopyLayerKind;
  label: string;
  text: string;
  visible: boolean;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: AdCopyTextAlign;
  weight: number;
}

export const AD_COPY_FONTS = [
  { id: 'Cairo', label: 'كايرو', family: 'Cairo, Tahoma, Arial, sans-serif' },
  { id: 'Tajawal', label: 'تجوال', family: 'Tajawal, Cairo, Tahoma, Arial, sans-serif' },
  { id: 'Noto Kufi Arabic', label: 'نوتو كوفي', family: 'Noto Kufi Arabic, Cairo, Tahoma, Arial, sans-serif' },
  { id: 'TGEzra', label: 'ثابت أنيق', family: 'TGEzra, Cairo, Tahoma, Arial, sans-serif' },
] as const;

export const AD_COPY_LAYER_LABELS: Record<AdCopyLayerKind, string> = {
  productTitle: 'اسم القطعة', shortDescription: 'الوصف القصير', price: 'السعر', discount: 'الخصم', quantity: 'الكمية', colors: 'الألوان', contact: 'رقم التوصيل', location: 'عنوان المركز', cta: 'زر الإجراء',
};

export const DEFAULT_AD_COPY_POSITIONS: Record<AdCopyLayerKind, { x: number; y: number }> = {
  productTitle: { x: .78, y: .28 }, shortDescription: { x: .78, y: .35 }, price: { x: .78, y: .48 }, discount: { x: .78, y: .55 }, quantity: { x: .78, y: .62 }, colors: { x: .78, y: .68 }, contact: { x: .72, y: .88 }, location: { x: .28, y: .88 }, cta: { x: .86, y: .88 },
};

export function createAdCopyLayers(suggestion: AdCopySuggestion, selectedFields: AdCopyLayerKind[], fontFamily = AD_COPY_FONTS[0].family): AdCopyLayer[] {
  const values: Record<AdCopyLayerKind, string> = { productTitle: suggestion.productTitle, shortDescription: suggestion.shortDescription, price: suggestion.priceText, discount: suggestion.discountText, quantity: suggestion.quantityText, colors: suggestion.colorsText, contact: suggestion.contactText, location: suggestion.locationText, cta: suggestion.ctaText };
  return selectedFields.filter(id => values[id].trim()).map((id, index) => ({ id, label: AD_COPY_LAYER_LABELS[id], text: values[id], visible: true, x: DEFAULT_AD_COPY_POSITIONS[id]?.x ?? .5, y: DEFAULT_AD_COPY_POSITIONS[id]?.y ?? (.24 + index * .07), fontSize: id === 'productTitle' ? 42 : id === 'price' ? 38 : 24, fontFamily, color: '#352080', align: id === 'location' || id === 'contact' ? 'center' : 'right', weight: id === 'productTitle' || id === 'price' ? 900 : 700 }));
}
