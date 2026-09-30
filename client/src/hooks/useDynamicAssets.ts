import { useState, useEffect, useCallback } from 'react';
import {
  type DynamicTemplate,
  listDynamicTemplates,
  getDynamicTemplate,
  saveDynamicTemplate,
  deleteDynamicTemplate,
  parseAndValidateTemplateJson,
} from '@/lib/dynamicAssetManager';

export function useDynamicAssets() {
  const [templates, setTemplates] = useState<DynamicTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<DynamicTemplate | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const refreshTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await listDynamicTemplates();
      setTemplates(items);
      if (items.length > 0 && !activeTemplate) {
        setActiveTemplate(items[0]);
      }
    } catch (err) {
      setErrorNotice('تعذر قراءة القوالب من التخزين المحلي');
    } finally {
      setIsLoading(false);
    }
  }, [activeTemplate]);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const saveJsonTemplate = async (jsonString: string): Promise<boolean> => {
    setErrorNotice(null);
    setSuccessNotice(null);

    const validation = parseAndValidateTemplateJson(jsonString);
    if (!validation.valid || !validation.data) {
      setErrorNotice(`خطأ في بنية القالب: ${validation.errors.join(' | ')}`);
      return false;
    }

    try {
      await saveDynamicTemplate(validation.data);
      setActiveTemplate(validation.data);
      await refreshTemplates();
      setSuccessNotice(`تم حفظ وتفعيل القالب "${validation.data.name}" بنجاح في الجهاز`);
      return true;
    } catch (e) {
      setErrorNotice(`فشل حفظ القالب محلياً: ${(e as Error).message}`);
      return false;
    }
  };

  const removeTemplate = async (id: string): Promise<boolean> => {
    try {
      await deleteDynamicTemplate(id);
      if (activeTemplate?.id === id) {
        setActiveTemplate(null);
      }
      await refreshTemplates();
      setSuccessNotice('تم حذف القالب بنجاح');
      return true;
    } catch (e) {
      setErrorNotice('فشل حذف القالب');
      return false;
    }
  };

  return {
    templates,
    activeTemplate,
    setActiveTemplate,
    isLoading,
    errorNotice,
    successNotice,
    saveJsonTemplate,
    removeTemplate,
    refreshTemplates,
    setErrorNotice,
    setSuccessNotice,
  };
}
