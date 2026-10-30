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
  productTitle: 'اسم القطعة',
  shortDescription: 'الوصف القصير',
  price: 'السعر',
  discount: 'الخصم',
  quantity: 'الكمية',
  colors: 'الألوان',
  contact: 'رقم التوصيل',
  location: 'عنوان المركز',
  cta: 'زر الإجراء',
};

export const DEFAULT_AD_COPY_POSITIONS: Record<AdCopyLayerKind, { x: number; y: number }> = {
  productTitle: { x: .78, y: .20 },
  shortDescription: { x: .78, y: .28 },
  price: { x: .78, y: .38 },
  discount: { x: .78, y: .46 },
  quantity: { x: .78, y: .54 },
  colors: { x: .78, y: .62 },
  contact: { x: .72, y: .88 },
  location: { x: .28, y: .88 },
  cta: { x: .86, y: .88 },
};

export function createAdCopyLayers(
  suggestion: AdCopySuggestion,
  selectedFields: AdCopyLayerKind[],
  fontFamily = AD_COPY_FONTS[0].family
): AdCopyLayer[] {
  const values: Record<AdCopyLayerKind, string> = {
    productTitle: suggestion.productTitle,
    shortDescription: suggestion.shortDescription,
    price: suggestion.priceText,
    discount: suggestion.discountText,
    quantity: suggestion.quantityText,
    colors: suggestion.colorsText,
    contact: suggestion.contactText,
    location: suggestion.locationText,
    cta: suggestion.ctaText,
  };

  return selectedFields
    .filter(id => values[id] && values[id].trim().length > 0)
    .map((id, index) => ({
      id,
      label: AD_COPY_LAYER_LABELS[id],
      text: values[id].trim(),
      visible: true,
      x: DEFAULT_AD_COPY_POSITIONS[id]?.x ?? .5,
      y: DEFAULT_AD_COPY_POSITIONS[id]?.y ?? (.20 + index * .08),
      fontSize: id === 'productTitle' ? 44 : id === 'price' ? 40 : 26,
      fontFamily,
      color: id === 'price' ? '#d97706' : '#1e1b4b',
      align: id === 'location' || id === 'contact' ? 'center' : 'right',
      weight: id === 'productTitle' || id === 'price' ? 900 : 700,
    }));
}

export function buildFallbackAdCopy(input: AdCopyInput): AdCopySuggestion {
  const curr = (input.currency || 'ريال').replace(/سعودي/g, '').trim();
  const priceVal = input.price.trim() ? `${input.price.trim()} ${curr}` : '';
  const discountVal = input.discount.trim() ? `خصم ${input.discount.trim()}%` : '';
  const qtyVal = input.quantity.trim() ? `الكمية: ${input.quantity.trim()} فقط` : '';
  const colorsVal = input.colors.length ? `الألوان: ${input.colors.join('، ')}` : '';
  const shortDesc = input.productContext.trim() || 'إطلالة فاخرة وخامة عالية الجودة';

  return {
    productTitle: input.productName.trim() || 'أناقة راقية',
    shortDescription: shortDesc,
    priceText: priceVal,
    discountText: discountVal,
    quantityText: qtyVal,
    colorsText: colorsVal,
    contactText: input.storePhone.trim() ? `للتواصل: ${input.storePhone.trim()}` : '',
    locationText: input.storeLocation.trim(),
    ctaText: input.cta.trim() || 'اطلب الآن',
  };
}
