import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDynamicTemplate,
  parseAndValidateTemplateJson,
  importDynamicTemplate,
  resolveTemplateOrFallback,
  type DynamicTemplate,
} from './dynamicAssetManager';
import {
  saveDynamicTemplate,
  getDynamicTemplate,
  listDynamicTemplates,
  deleteDynamicTemplate,
  clearAllDynamicAssets,
} from './dynamicAssetStorage';
import type { TemplateSettings } from '@shared/types';

describe('DynamicAssetManager & Storage (Phase 1)', () => {
  beforeEach(async () => {
    await clearAllDynamicAssets();
  });

  const validTemplateSample: DynamicTemplate = {
    schemaVersion: 1,
    id: 'tpl_custom_summer_2026',
    name: 'قالب الصيف الحديث',
    size: 'story',
    visualTheme: 'midnight',
    productScale: 0.85,
    elements: [
      {
        id: 'product',
        visible: true,
        required: true,
        box: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
      },
      {
        id: 'header',
        visible: true,
        required: false,
        box: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
      },
      {
        id: 'price',
        visible: true,
        required: false,
        box: { x: 0.6, y: 0.85, width: 0.3, height: 0.1 },
      },
    ],
    createdAt: 1700000000000,
    author: 'marwan',
  };

  it('validates a correct template successfully', () => {
    const result = validateDynamicTemplate(validTemplateSample);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe('tpl_custom_summer_2026');
    expect(result.data?.elements.length).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a template missing the required product element', () => {
    const invalidTemplate = {
      ...validTemplateSample,
      id: 'no_product_tpl',
      elements: [
        {
          id: 'header',
          visible: true,
          required: false,
          box: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
        },
      ],
    };

    const result = validateDynamicTemplate(invalidTemplate);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('product'))).toBe(true);
  });

  it('rejects a template with an invalid size', () => {
    const invalidTemplate = {
      ...validTemplateSample,
      id: 'bad_size_tpl',
      size: 'invalid_super_wide',
    };

    const result = validateDynamicTemplate(invalidTemplate);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('size'))).toBe(true);
  });

  it('clamps out-of-range element boxes safely without throwing', () => {
    const outOfBounds = {
      ...validTemplateSample,
      id: 'tpl_clamped',
      elements: [
        {
          id: 'product',
          visible: true,
          required: true,
          box: { x: -0.5, y: 1.5, width: 2.0, height: -1 },
        },
      ],
    };

    const result = validateDynamicTemplate(outOfBounds);
    expect(result.valid).toBe(false);
  });

  it('parses valid JSON string and imports template into storage', async () => {
    const jsonStr = JSON.stringify(validTemplateSample);
    const importRes = await importDynamicTemplate(jsonStr);
    expect(importRes.success).toBe(true);
    expect(importRes.template?.id).toBe('tpl_custom_summer_2026');

    const stored = await getDynamicTemplate('tpl_custom_summer_2026');
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('قالب الصيف الحديث');
  });

  it('safely handles corrupted JSON without crashing', async () => {
    const brokenJson = '{ "name": "Broken", elements: [ ';
    const res = await importDynamicTemplate(brokenJson);
    expect(res.success).toBe(false);
    expect(res.message).toContain('JSON');
  });

  it('resolves fallback template safely when dynamic template is not found', async () => {
    const fallback: TemplateSettings = {
      size: 'square',
      visualTheme: 'classic',
    } as any;

    const resolved = await resolveTemplateOrFallback('non_existent_id', fallback);
    expect(resolved.settings.size).toBe('square');
    expect(resolved.dynamicTemplate).toBeUndefined();
  });

  it('supports delete and listing of dynamic templates', async () => {
    await saveDynamicTemplate(validTemplateSample);
    const listBefore = await listDynamicTemplates();
    expect(listBefore.length).toBeGreaterThanOrEqual(1);

    await deleteDynamicTemplate(validTemplateSample.id);
    const storedAfter = await getDynamicTemplate(validTemplateSample.id);
    expect(storedAfter).toBeNull();
  });
});
