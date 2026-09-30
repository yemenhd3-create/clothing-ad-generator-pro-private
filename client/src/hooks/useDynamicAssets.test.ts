import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllDynamicAssets, saveDynamicTemplate, getDynamicTemplate } from '../lib/dynamicAssetStorage';
import { parseAndValidateTemplateJson } from '../lib/dynamicAssetManager';

describe('useDynamicAssets Hook & Logic Integration', () => {
  beforeEach(async () => {
    await clearAllDynamicAssets();
  });

  it('correctly handles template JSON validation and persistence flow', async () => {
    const validJson = JSON.stringify({
      schemaVersion: 1,
      id: 'tpl_hook_test',
      name: 'قالب اختبار الهوك',
      size: 'portrait',
      visualTheme: 'classic',
      elements: [
        {
          id: 'product',
          visible: true,
          required: true,
          box: { x: 0.1, y: 0.2, width: 0.8, height: 0.6 },
        },
      ],
    });

    const val = parseAndValidateTemplateJson(validJson);
    expect(val.valid).toBe(true);
    expect(val.data).toBeDefined();

    if (val.data) {
      await saveDynamicTemplate(val.data);
      const retrieved = await getDynamicTemplate('tpl_hook_test');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('tpl_hook_test');
      expect(retrieved?.size).toBe('portrait');
    }
  });

  it('rejects malformed templates without throwing an error', () => {
    const brokenJson = '{"id": "bad", "name": "';
    const val = parseAndValidateTemplateJson(brokenJson);
    expect(val.valid).toBe(false);
    expect(val.errors.length).toBeGreaterThan(0);
  });
});
