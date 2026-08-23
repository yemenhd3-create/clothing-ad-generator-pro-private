/** رسالة مفهومة عندما يمنع موفر ملفات Android قراءة الصورة بعد اختيارها. */
export function getImagePreparationErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (detail.includes('FILE_READ_UNAVAILABLE')) {
    return 'تعذّرت قراءة ملف الصورة من مزود المعرض. جرّب زر «التقاط صورة» داخل التطبيق، أو افتح الصورة في المعرض واختر «حفظ نسخة» ثم اختر النسخة الجديدة. لا تغلق نافذة الاختيار قبل اكتمال التحميل.';
  }
  return 'تعذّر تجهيز هذه الصورة على هذا المتصفح. التطبيق يقبل صور المعرض الشائعة ويحاول تحويلها محلياً؛ جرّب فتحها في المعرض ثم «حفظ نسخة» أو اختر نسخة JPG/PNG إذا كان جهازك لا يدعم صيغة الصورة الأصلية.';
}

/** رسالة موحدة لمسار الكاميرا المباشر من المتصفح. */
export function getCameraCaptureErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'لم يُسمح للتطبيق باستخدام الكاميرا. افتح إعدادات الموقع في المتصفح، فعّل إذن «الكاميرا»، ثم اضغط «بالكاميرا» مرة أخرى.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'لم نعثر على كاميرا قابلة للاستخدام. أغلق أي تطبيق آخر يستعمل الكاميرا ثم أعد المحاولة.';
  }
  return 'تعذر فتح الكاميرا الآن. جرّب مرة أخرى، أو استخدم زر «من المعرض» لاختيار صورة محفوظة.';
}
