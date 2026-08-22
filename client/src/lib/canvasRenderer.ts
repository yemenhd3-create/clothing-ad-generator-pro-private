import { DEFAULT_PRODUCT_SCALE, PRODUCT_SCALE_MAX, PRODUCT_SCALE_MIN, type AdDetails, type ProductShadowPreset, type ProductStudioBackdrop, type TemplateBadgeType, type TemplateSettings, type TemplateSize } from '@shared/types';
import { getArtworkTransform } from '@shared/artworkLayout';
import { getDesignGeometry } from '@shared/designGeometry';
import { getTemplateTheme, type TemplateThemePalette } from '@shared/templateThemes';

export interface RenderOptions {
  width?: number;
  height?: number;
  quality?: number;
  visualMode?: 'garment' | 'transparentPerson';
  garmentTransform?: { x: number; y: number; width: number; height: number };
}

const TEMPLATE_FONT_FAMILY = 'Cairo, Tahoma, Arial, sans-serif';
type Box = { x: number; y: number; width: number; height: number };
type ImageSourceBounds = { x: number; y: number; width: number; height: number };
type Geometry = { safe: Box; header: Box; logo: Box; hero: Box; info: Box; price: Box; features: Box; footer: Box; badge: Box };
type Layout = { font: (weight: number, size: number) => string; width: number; height: number; scale: number };

/** يرسم قالباً هندسياً مستقلاً لكل مقاس؛ الملابس دائماً أكبر منطقة بصرية. */
export async function renderAd(details: AdDetails, template: TemplateSettings, productImageSrc: string, options: RenderOptions = {}): Promise<string> {
  await waitForCanvasFonts();
  const { width, height } = resolveCanvasSize(template.size, options.width, options.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تهيئة مساحة الرسم');

  const layout: Layout = { width, height, scale: width / 1080, font: (weight, size) => `${weight} ${Math.round(size * (width / 1080))}px ${TEMPLATE_FONT_FAMILY}` };
  const geometry = createGeometry(template.size, width, height);
  const palette = getTemplateTheme(template.visualTheme).palette;
  const studioOnly = isStudioOnly(details, template);
  const hero = studioOnly ? createStudioHero(template.size, width, height) : geometry.hero;
  if (studioOnly) drawWardrobeBackdrop(ctx, { x: 0, y: 0, width, height }, template.productBackdrop || 'soft', palette);
  else { ctx.fillStyle = template.smartBackgroundColor || palette.background; ctx.fillRect(0, 0, width, height); }

  const logoTransform = getArtworkTransform(template, 'logo');
  const footerTransform = getArtworkTransform(template, 'footer');
  if (!studioOnly) {
    drawTextHeader(ctx, details, template, geometry.header, layout, palette);
    if (template.showStoreLogo && template.storeLogoArtwork) await drawCircularLogo(ctx, template.storeLogoArtwork, toPixelBox(logoTransform, width, height));
  }

  if (!studioOnly) drawHeroBackdrop(ctx, hero, template.productBackdrop || 'auto', palette);
  await drawHero(ctx, productImageSrc, hero, options.visualMode || 'garment', studioOnly ? undefined : (options.garmentTransform || template.smartGarmentTransform), template.productScale, template.productShadow || 'soft', studioOnly);
  if (studioOnly) drawWardrobeOverlays(ctx, template, layout);
  if (!studioOnly) {
    drawBadges(ctx, details, template, geometry.badge, layout, palette);
    if (template.showQuantity || template.showColors) drawInformationPanel(ctx, details, template, geometry.info, layout, palette);
    if (template.showPrice && details.price.trim()) drawPricePanel(ctx, details, geometry.price, layout, palette);
    if (template.showFeatures && details.features.filter(Boolean).length) drawFeatureBadges(ctx, details.features.filter(Boolean).slice(0, 2), geometry.features, layout, palette);
    if (template.showFooterArtwork && template.footerArtwork) await drawArtwork(ctx, template.footerArtwork, toPixelBox(footerTransform, width, height), footerTransform.fit);
    else if (template.showStoreInfo && (details.storeName.trim() || details.storePhone.trim())) drawFooter(ctx, details, geometry.footer, layout, palette);
  }

  const blob = await canvasToBlob(canvas, 'image/png', options.quality || 0.92);
  return URL.createObjectURL(blob);
}

function isStudioOnly(details: AdDetails, template: TemplateSettings) {
  return template.wardrobeStudio === true || (!details.productName.trim() && !details.headline.trim() && !details.price.trim()
    && !details.quantity.trim() && details.colors.length === 0 && details.features.filter(Boolean).length === 0
    && !details.storeName.trim() && !details.storePhone.trim() && !template.storeLogoArtwork && !template.footerArtwork);
}

function createStudioHero(size: TemplateSize, width: number, height: number): Box {
  if (size === 'landscape') return { x: width * .12, y: height * .08, width: width * .76, height: height * .82 };
  if (size === 'story') return { x: width * .075, y: height * .045, width: width * .85, height: height * .86 };
  return { x: width * .09, y: height * .065, width: width * .82, height: height * .80 };
}

function resolveCanvasSize(size: TemplateSize, requestedWidth?: number, requestedHeight?: number) {
  if (requestedWidth && requestedHeight) return { width: requestedWidth, height: requestedHeight };
  const dimensions: Record<TemplateSize, { width: number; height: number }> = {
    portrait: { width: 1080, height: 1350 }, square: { width: 1080, height: 1080 }, story: { width: 1080, height: 1920 }, whatsapp: { width: 1080, height: 1440 }, landscape: { width: 1200, height: 628 },
  };
  return dimensions[size] || dimensions.portrait;
}

function createGeometry(size: TemplateSize, width: number, height: number): Geometry {
  const normalized = getDesignGeometry(size);
  const toPixels = (box: typeof normalized.hero): Box => ({ x: width * box.x, y: height * box.y, width: width * box.width, height: height * box.height });
  return {
    safe: toPixels(normalized.safe), header: toPixels(normalized.header), logo: toPixels(normalized.logo), hero: toPixels(normalized.hero),
    info: toPixels(normalized.info), price: toPixels(normalized.price), features: toPixels(normalized.features), footer: toPixels(normalized.footer), badge: toPixels(normalized.badge),
  };
}

function drawTextHeader(ctx: CanvasRenderingContext2D, details: AdDetails, template: TemplateSettings, box: Box, layout: Layout, palette: TemplateThemePalette) {
  const title = template.showProductName ? details.productName.trim() : '';
  const headline = template.showHeadline ? details.headline.trim() : '';
  const { font, scale } = layout;
  ctx.save();
  ctx.fillStyle = template.smartTextColor || palette.primary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const isLandscape = layout.width > layout.height;
  const hasSideLayer = template.showQualityMark || (template.showStoreLogo && Boolean(template.storeLogoArtwork));
  const titleCenter = hasSideLayer ? box.x + box.width * .38 : box.x + box.width / 2;
  const titleWidth = hasSideLayer ? box.width * .68 : box.width * .88;
  if (title) {
    ctx.font = font(900, isLandscape ? 38 : 53);
    drawWrappedText(ctx, title, titleCenter, box.y + box.height * .08, titleWidth, (isLandscape ? 45 : 62) * scale, 2);
  }
  if (headline) {
    ctx.fillStyle = palette.muted;
    ctx.font = font(600, 22);
    drawWrappedText(ctx, headline, titleCenter, box.y + box.height * (title ? .62 : .25), titleWidth, 30 * scale, 2);
  }
  if (template.showQualityMark) {
    const markSize = Math.min(box.height * .48, 72 * scale);
    roundedRect(ctx, box.x + box.width - markSize, box.y + box.height * .08, markSize, markSize, markSize * .26);
    ctx.fillStyle = palette.primarySoft;
    ctx.fill();
    ctx.fillStyle = template.smartTextColor || palette.primary;
    ctx.font = font(900, 36);
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', box.x + box.width - markSize / 2, box.y + box.height * .08 + markSize / 2);
  }
  ctx.restore();
}

function drawHeroBackdrop(ctx: CanvasRenderingContext2D, box: Box, backdrop: ProductStudioBackdrop, palette: TemplateThemePalette) {
  if (backdrop === 'auto') return;
  ctx.save();
  const colors: Record<Exclude<ProductStudioBackdrop, 'auto'>, [string, string]> = {
    soft: ['rgba(255,255,255,.96)', palette.primarySoft],
    warm: ['#fffaf0', '#f7e6c3'],
    cool: ['#f4fbff', '#dbeef9'],
    spotlight: ['rgba(255,255,255,.99)', 'rgba(232,227,245,.82)'],
  };
  const [center, edge] = colors[backdrop];
  const gradient = ctx.createRadialGradient(box.x + box.width / 2, box.y + box.height * .38, Math.max(1, box.width * .04), box.x + box.width / 2, box.y + box.height / 2, Math.max(box.width, box.height) * .72);
  gradient.addColorStop(0, center);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
}

function drawWardrobeBackdrop(ctx: CanvasRenderingContext2D, box: Box, backdrop: ProductStudioBackdrop, palette: TemplateThemePalette) {
  ctx.save();
  const colors: Record<ProductStudioBackdrop, [string, string]> = {
    auto: ['#ffffff', '#f1edf8'],
    soft: ['rgba(255,255,255,.99)', palette.primarySoft],
    warm: ['#fffdf7', '#f4dfbd'],
    cool: ['#fbfdff', '#dceefa'],
    spotlight: ['#ffffff', '#e7ddf5'],
  };
  const [center, edge] = colors[backdrop];
  const gradient = ctx.createRadialGradient(box.x + box.width / 2, box.y + box.height * .35, Math.max(1, box.width * .02), box.x + box.width / 2, box.y + box.height * .52, Math.max(box.width, box.height) * .7);
  gradient.addColorStop(0, center);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
}

function drawWardrobeOverlays(ctx: CanvasRenderingContext2D, template: TemplateSettings, layout: Layout) {
  const captionPosition = template.studioCaptionPosition || { x: .73, y: .055 };
  const pricePosition = template.studioPricePosition || { x: .78, y: .89 };
  drawWardrobeLabel(ctx, template.studioCaption?.trim() || '', {
    textColor: template.studioCaptionTextColor || '#111827', backgroundColor: template.studioCaptionBackgroundColor || '',
    centerX: layout.width * captionPosition.x, top: layout.height * captionPosition.y, maxWidth: layout.width * .62, fontSize: layout.width > layout.height ? 34 : 40,
  }, layout);
  drawWardrobeLabel(ctx, template.studioPrice?.trim() || '', {
    textColor: template.studioPriceTextColor || '#111827', backgroundColor: template.studioPriceBackgroundColor || '',
    centerX: layout.width * pricePosition.x, top: layout.height * pricePosition.y, maxWidth: layout.width * .38, fontSize: layout.width > layout.height ? 38 : 48,
  }, layout);
}

function drawWardrobeLabel(ctx: CanvasRenderingContext2D, value: string, options: { textColor: string; backgroundColor: string; centerX: number; top: number; maxWidth: number; fontSize: number }, layout: Layout) {
  if (!value) return;
  ctx.save(); ctx.font = layout.font(900, options.fontSize);
  const text = truncateToWidth(ctx, value, options.maxWidth - layout.width * .05);
  const paddingX = layout.width * .022; const paddingY = layout.width * .012;
  const width = Math.min(options.maxWidth, ctx.measureText(text).width + paddingX * 2);
  const height = Math.round(options.fontSize * layout.scale * 1.42 + paddingY * 2);
  const x = Math.max(layout.width * .02, Math.min(layout.width - width - layout.width * .02, options.centerX - width / 2));
  if (options.backgroundColor && options.backgroundColor !== 'transparent') {
    ctx.fillStyle = options.backgroundColor; roundedRect(ctx, x, options.top, width, height, Math.min(height / 2, layout.width * .035)); ctx.fill();
  }
  ctx.fillStyle = options.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + width / 2, options.top + height / 2); ctx.restore();
}

async function drawHero(ctx: CanvasRenderingContext2D, imageSrc: string, box: Box, visualMode: 'garment' | 'transparentPerson', transform?: { x: number; y: number; width: number; height: number }, productScale?: number, shadow: ProductShadowPreset = 'soft', studioOnly = false) {
  const padding = Math.min(box.width, box.height) * (studioOnly ? .06 : .015);
  const safeBox = { x: box.x + padding, y: box.y + padding, width: box.width - padding * 2, height: box.height - padding * 2 };
  const selected = transform ? constrainedHeroTransform(safeBox, transform) : safeBox;
  const image = await loadImage(imageSrc);
  const sourceBounds = getVisibleImageBounds(image);
  const placement = calculateImagePlacement(sourceBounds, selected, visualMode, studioOnly ? Math.min(1.16, normalizeProductScale(productScale)) : normalizeProductScale(productScale));
  ctx.save();
  ctx.beginPath(); ctx.rect(safeBox.x, safeBox.y, safeBox.width, safeBox.height); ctx.clip();
  drawProductShadow(ctx, placement, shadow);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceBounds.x, sourceBounds.y, sourceBounds.width, sourceBounds.height, placement.x, placement.y, placement.width, placement.height);
  ctx.restore();
}

function drawProductShadow(ctx: CanvasRenderingContext2D, box: Box, shadow: ProductShadowPreset) {
  if (shadow === 'none') return;
  ctx.save();
  const grounded = shadow === 'grounded';
  const width = box.width * (grounded ? .58 : .46);
  const height = Math.max(box.height * (grounded ? .08 : .055), 8);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * (grounded ? .97 : .94);
  const gradient = ctx.createRadialGradient(x, y, Math.max(1, width * .08), x, y, width / 2);
  gradient.addColorStop(0, grounded ? 'rgba(43,37,72,.30)' : 'rgba(43,37,72,.18)');
  gradient.addColorStop(1, 'rgba(43,37,72,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, width / 2, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function constrainedHeroTransform(hero: Box, transform: { x: number; y: number; width: number; height: number }): Box {
  const x = Math.max(0, Math.min(.92, transform.x));
  const y = Math.max(0, Math.min(.92, transform.y));
  const width = Math.max(.35, Math.min(1 - x, transform.width));
  const height = Math.max(.35, Math.min(1 - y, transform.height));
  return { x: hero.x + hero.width * x, y: hero.y + hero.height * y, width: hero.width * width, height: hero.height * height };
}

function getBadgeTypes(template: TemplateSettings, details: AdDetails): Array<Exclude<TemplateBadgeType, 'none'>> {
  const configured = template.badgeTypes?.slice() || [];
  if (configured.length) return configured.slice(0, 3);
  if (template.badgeType && template.badgeType !== 'none') return [template.badgeType];
  return template.showDiscount && details.discount.trim() ? ['discount'] : [];
}

function drawBadges(ctx: CanvasRenderingContext2D, details: AdDetails, template: TemplateSettings, box: Box, layout: Layout, palette: TemplateThemePalette) {
  const types = getBadgeTypes(template, details);
  if (!types.length) return;
  const gap = box.width * .08;
  const diameter = Math.min(box.width * (types.length === 1 ? .95 : .58), box.height * .78);
  const totalWidth = diameter * types.length + gap * (types.length - 1);
  const startX = box.x + Math.max(0, (box.width - totalWidth) / 2);
  types.forEach((type, index) => drawBadge(ctx, details, template, type, { x: startX + index * (diameter + gap), y: box.y + (box.height - diameter) / 2, width: diameter, height: diameter }, layout, types.length === 1, palette));
}

function drawBadge(ctx: CanvasRenderingContext2D, details: AdDetails, template: TemplateSettings, type: Exclude<TemplateBadgeType, 'none'>, box: Box, layout: Layout, canUseCustomText: boolean, palette: TemplateThemePalette) {
  const labels: Record<Exclude<TemplateBadgeType, 'none'>, string> = { discount: details.discount.trim() ? `خصم\n${details.discount.trim()}%` : 'خصم', new: 'جديد', offer: 'عرض', price: 'سعر', quality: 'جودة' };
  const text = canUseCustomText && template.badgeText.trim() ? template.badgeText.trim() : labels[type];
  const colors: Record<Exclude<TemplateBadgeType, 'none'>, string> = { discount: palette.accent, new: palette.primary, offer: palette.accentDark, price: palette.accentDark, quality: palette.primary };
  const radius = Math.min(box.width, box.height) / 2;
  const cx = box.x + radius;
  const cy = box.y + radius;
  ctx.save();
  ctx.fillStyle = colors[type];
  ctx.shadowColor = 'rgba(0,0,0,.16)';
  ctx.shadowBlur = radius * .18;
  ctx.shadowOffsetY = radius * .08;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = palette.onAccent;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split(/\n|\s{2,}/).filter(Boolean).slice(0, 2);
  ctx.font = layout.font(900, Math.max(17, Math.min(31, radius / layout.scale * .36)));
  lines.forEach((line, index) => ctx.fillText(line, cx, cy + (index - (lines.length - 1) / 2) * radius * .46));
  ctx.restore();
}

function drawInformationPanel(ctx: CanvasRenderingContext2D, details: AdDetails, template: TemplateSettings, box: Box, layout: Layout, palette: TemplateThemePalette) {
  const items = [template.showQuantity && details.quantity.trim() ? { label: 'الكمية', value: details.quantity.trim() } : null, template.showColors && details.colors.length ? { label: 'الألوان', value: details.colors.slice(0, 2).join('، ') } : null].filter(Boolean) as Array<{ label: string; value: string }>;
  if (!items.length) return;
  ctx.save();
  const gap = box.height * .06;
  const itemHeight = (box.height - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const y = box.y + index * (itemHeight + gap);
    roundedRect(ctx, box.x, y, box.width, itemHeight, Math.min(box.width, itemHeight) * .18);
    ctx.fillStyle = palette.primarySoft; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = palette.muted; ctx.font = layout.font(700, 19); ctx.fillText(item.label, box.x + box.width / 2, y + itemHeight * .16);
    ctx.fillStyle = palette.primary; ctx.font = layout.font(900, 23); drawWrappedText(ctx, item.value, box.x + box.width / 2, y + itemHeight * .46, box.width * .84, itemHeight * .24, 2);
  });
  ctx.restore();
}

function drawPricePanel(ctx: CanvasRenderingContext2D, details: AdDetails, box: Box, layout: Layout, palette: TemplateThemePalette) {
  ctx.save();
  roundedRect(ctx, box.x, box.y, box.width, box.height, Math.min(box.width, box.height) * .18);
  ctx.fillStyle = palette.accent; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.font = layout.font(700, 21); ctx.fillText('السعر', box.x + box.width / 2, box.y + box.height * .14);
  ctx.fillStyle = palette.onAccent; ctx.font = layout.font(900, 44); ctx.fillText(details.price.trim(), box.x + box.width / 2, box.y + box.height * .36);
  ctx.font = layout.font(700, 21); ctx.fillText(details.currency.trim() || 'ريال', box.x + box.width / 2, box.y + box.height * .61);
  if (details.discount.trim()) {
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, layout.scale * 2); ctx.beginPath(); ctx.moveTo(box.x + box.width * .16, box.y + box.height * .76); ctx.lineTo(box.x + box.width * .84, box.y + box.height * .76); ctx.stroke();
    ctx.font = layout.font(800, 18); ctx.fillText(`وفر ${details.discount.trim()}%`, box.x + box.width / 2, box.y + box.height * .81);
  }
  ctx.restore();
}

function drawFeatureBadges(ctx: CanvasRenderingContext2D, features: string[], box: Box, layout: Layout, palette: TemplateThemePalette) {
  const gap = box.width * .025;
  const width = (box.width - gap * (features.length - 1)) / features.length;
  ctx.save();
  features.forEach((feature, index) => {
    const x = box.x + index * (width + gap);
    roundedRect(ctx, x, box.y, width, box.height, Math.min(width, box.height) * .27); ctx.fillStyle = palette.primarySoft; ctx.fill();
    ctx.fillStyle = palette.primary; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = layout.font(800, 20); ctx.fillText(truncateToWidth(ctx, feature, width * .84), x + width / 2, box.y + box.height / 2);
  });
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, details: AdDetails, box: Box, layout: Layout, palette: TemplateThemePalette) {
  ctx.save();
  roundedRect(ctx, box.x, box.y, box.width, box.height, box.height * .25); ctx.fillStyle = palette.accent; ctx.fill();
  ctx.fillStyle = palette.onAccent; ctx.textBaseline = 'middle';
  if (details.storeName.trim()) { ctx.font = layout.font(900, 27); ctx.textAlign = 'right'; ctx.fillText(truncateToWidth(ctx, details.storeName.trim(), box.width * .58), box.x + box.width * .94, box.y + box.height / 2); }
  if (details.storePhone.trim()) { ctx.font = layout.font(800, 24); ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillText(details.storePhone.trim(), box.x + box.width * .06, box.y + box.height / 2); }
  ctx.restore();
}

function toPixelBox(transform: { x: number; y: number; width: number; height: number }, width: number, height: number): Box {
  return { x: transform.x * width, y: transform.y * height, width: transform.width * width, height: transform.height * height };
}

async function drawArtwork(ctx: CanvasRenderingContext2D, source: string, box: Box, fit: 'contain' | 'cover' | 'stretch') {
  const image = await loadImage(source);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (fit === 'stretch') {
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
    return;
  }
  if (fit === 'cover') { ctx.beginPath(); ctx.rect(box.x, box.y, box.width, box.height); ctx.clip(); }
  const ratio = (fit === 'cover' ? Math.max : Math.min)(box.width / image.width, box.height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  ctx.drawImage(image, box.x + (box.width - drawWidth) / 2, box.y + (box.height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

async function drawCircularLogo(ctx: CanvasRenderingContext2D, source: string, box: Box) {
  const image = await loadImage(source);
  const diameter = Math.min(box.width, box.height);
  const x = box.x + (box.width - diameter) / 2;
  const y = box.y + (box.height - diameter) / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2); ctx.clip();
  const ratio = Math.max(diameter / image.width, diameter / image.height);
  const drawWidth = image.width * ratio; const drawHeight = image.height * ratio;
  ctx.drawImage(image, x + (diameter - drawWidth) / 2, y + (diameter - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.94)'; ctx.lineWidth = Math.max(2, diameter * .055); ctx.stroke(); ctx.restore();
}

function calculateImagePlacement(image: Pick<ImageSourceBounds, 'width' | 'height'>, box: Box, visualMode: 'garment' | 'transparentPerson', productScale: number): Box {
  const usesPersonPlacement = visualMode === 'transparentPerson';
  const widthLimit = usesPersonPlacement ? box.width * .94 : box.width;
  const heightLimit = usesPersonPlacement ? box.height * .985 : box.height;
  const ratio = Math.min(widthLimit / image.width, heightLimit / image.height);
  const renderedScale = usesPersonPlacement ? 1 : productScale;
  const drawWidth = Math.max(1, image.width * ratio * renderedScale); const drawHeight = Math.max(1, image.height * ratio * renderedScale);
  return {
    x: box.x + (box.width - drawWidth) / 2,
    y: usesPersonPlacement ? box.y + box.height - drawHeight - box.height * .012 : box.y + (box.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function getVisibleImageBounds(image: HTMLImageElement): ImageSourceBounds {
  const full = { x: 0, y: 0, width: image.width, height: image.height };
  if (!image.naturalWidth || !image.naturalHeight || typeof document === 'undefined') return full;
  try {
    const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio)); const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const scan = document.createElement('canvas'); scan.width = width; scan.height = height;
    const scanContext = scan.getContext('2d', { willReadFrequently: true });
    if (!scanContext) return full;
    scanContext.drawImage(image, 0, 0, width, height);
    const pixels = scanContext.getImageData(0, 0, width, height).data;
    let left = width; let top = height; let right = -1; let bottom = -1;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 18) continue;
      const pixel = (index - 3) / 4; const x = pixel % width; const y = Math.floor(pixel / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left || bottom < top) return full;
    const inset = Math.max(2, Math.round(Math.min(right - left + 1, bottom - top + 1) * .025));
    const safeLeft = Math.max(0, left - inset); const safeTop = Math.max(0, top - inset);
    const safeRight = Math.min(width - 1, right + inset); const safeBottom = Math.min(height - 1, bottom + inset);
    const sourceScale = 1 / ratio;
    return { x: safeLeft * sourceScale, y: safeTop * sourceScale, width: (safeRight - safeLeft + 1) * sourceScale, height: (safeBottom - safeTop + 1) * sourceScale };
  } catch { return full; }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); let settled = false;
    const finish = (callback: () => void) => { if (settled) return; settled = true; window.clearTimeout(timeout); callback(); };
    const timeout = window.setTimeout(() => finish(() => reject(new Error('انتهت مهلة تحميل صورة الملابس'))), 12_000);
    image.onload = () => finish(() => resolve(image)); image.onerror = () => finish(() => reject(new Error('تعذر تحميل صورة الملابس في القالب')));
    image.decoding = 'async'; if (!source.startsWith('blob:') && !source.startsWith('data:')) image.crossOrigin = 'anonymous'; image.src = source;
  });
}

function normalizeProductScale(value?: number) {
  const scale = Number.isFinite(value) ? Number(value) : DEFAULT_PRODUCT_SCALE;
  return Math.min(PRODUCT_SCALE_MAX, Math.max(PRODUCT_SCALE_MIN, scale));
}

async function waitForCanvasFonts() { if (typeof document !== 'undefined' && 'fonts' in document) try { await document.fonts.ready; } catch { /* Tahoma fallback */ } }
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) { const r = Math.min(radius, width / 2, height / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath(); }
function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, centerX: number, topY: number, maxWidth: number, lineHeight: number, maxLines: number) { const words = text.split(/\s+/).filter(Boolean); let line = ''; let index = 0; for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (ctx.measureText(candidate).width <= maxWidth || !line) { line = candidate; continue; } ctx.fillText(line, centerX, topY + index * lineHeight); index += 1; if (index >= maxLines) return; line = word; } if (line && index < maxLines) ctx.fillText(truncateToWidth(ctx, line, maxWidth), centerX, topY + index * lineHeight); }
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) { if (ctx.measureText(text).width <= maxWidth) return text; let value = text; while (value.length && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1); return `${value}…`; }
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> { return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('تعذر تصدير الإعلان كصورة'))), type, quality)); }
