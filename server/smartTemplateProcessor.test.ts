import { describe, it, expect } from 'vitest';
import {
  validateAndProcessTemplateImage,
  buildSmartDynamicTemplate,
  SMART_LAYOUT_PRESETS,
  TARGET_TEMPLATE_WIDTH,
  TARGET_TEMPLATE_HEIGHT,
  MAX_DYNAMIC_TEMPLATES,
} from '../client/src/lib/smartTemplateProcessor';
import { validateDynamicTemplate } from '../client/src/lib/dynamicAssetManager';

describe('Smart WhatsApp Template Engine - محرك قوالب واتساب الذكية', () => {
  it('يحدد المقاس المعياري لواتساب بدقة 1080×1080 وبحد أقصى 4 قوالب', () => {
    expect(TARGET_TEMPLATE_WIDTH).toBe(1080);
    expect(TARGET_TEMPLATE_HEIGHT).toBe(1080);
    expect(MAX_DYNAMIC_TEMPLATES).toBe(4);
  });

  it('يقدم أنماط توزيع ذكية تمنع تداخل الملابس مع النصوص', () => {
    expect(SMART_LAYOUT_PRESETS).toHaveLength(3);

    const splitLeft = SMART_LAYOUT_PRESETS.find(p => p.id === 'split-left');
    expect(splitLeft).toBeDefined();
    // القطعة يسار: يجب أن يكون x أقل من 0.45
    expect(splitLeft!.productSlot.x).toBeLessThan(0.45);

    const splitRight = SMART_LAYOUT_PRESETS.find(p => p.id === 'split-right');
    expect(splitRight).toBeDefined();
    // القطعة يمين: يجب أن يكون x أكبر من 0.48
    expect(splitRight!.productSlot.x).toBeGreaterThan(0.48);

    const centered = SMART_LAYOUT_PRESETS.find(p => p.id === 'centered');
    expect(centered).toBeDefined();
    expect(centered!.productSlot.x).toBeGreaterThan(0.1);
  });

  it('يبني قالباً ديناميكياً متوافقاً مع فحص الجودة ومحمي من التداخل (split-left)', () => {
    const tpl = buildSmartDynamicTemplate({
      name: 'قالب واتساب فاخر',
      backgroundImage: 'data:image/webp;base64,mockValidBase64Image',
      layoutPreset: 'split-left',
    });

    expect(tpl.name).toBe('قالب واتساب فاخر');
    expect(tpl.size).toBe('square');
    expect(tpl.layoutPreset).toBe('split-left');
    expect(tpl.backgroundImage).toBeDefined();

    const productEl = tpl.elements.find(e => e.id === 'product');
    expect(productEl).toBeDefined();
    expect(productEl?.box.x).toBe(0.05);

    // التحقق من أن عناصر النصوص في الجانب المقابل (الأيمن)
    const headerEl = tpl.elements.find(e => e.id === 'header');
    expect(headerEl?.box.x).toBeGreaterThanOrEqual(0.5);

    // التحقق من صحة القالب عبر validateDynamicTemplate
    const validation = validateDynamicTemplate(tpl);
    expect(validation.valid).toBe(true);
    expect(validation.data?.backgroundImage).toBe(tpl.backgroundImage);
    expect(validation.data?.layoutPreset).toBe('split-left');
  });

  it('يبني قالباً ديناميكياً بنمط split-right ويضع النصوص في اليسار', () => {
    const tpl = buildSmartDynamicTemplate({
      name: 'قالب كاجوال واتساب',
      backgroundImage: 'data:image/jpeg;base64,mockValidBase64ImageRight',
      layoutPreset: 'split-right',
    });

    const productEl = tpl.elements.find(e => e.id === 'product');
    expect(productEl?.box.x).toBe(0.51);

    const headerEl = tpl.elements.find(e => e.id === 'header');
    expect(headerEl?.box.x).toBeLessThan(0.45);

    const validation = validateDynamicTemplate(tpl);
    expect(validation.valid).toBe(true);
    expect(validation.data?.layoutPreset).toBe('split-right');
  });

  it('يرفض نصوص وخلفيات قوالب بصيغ غير صالحة عبر validateDynamicTemplate', () => {
    const raw = {
      schemaVersion: 1,
      id: 'test_id',
      name: 'قالب غير صالح',
      size: 'square',
      elements: [
        { id: 'product', box: { x: 0, y: 0, width: 0.5, height: 0.5 } },
      ],
      backgroundImage: 'javascript:alert(1)', // صيغة غير مسموح بها
    };

    const validation = validateDynamicTemplate(raw);
    expect(validation.valid).toBe(true);
    // يجب ألا يقبل الرابط غير الآمن كخلفية
    expect(validation.data?.backgroundImage).toBeUndefined();
  });
});
