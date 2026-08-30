# TEST REPORT

## اختبارات نفذت فعلياً من Clean Clone

| Command | Result | Status |
|---|---|---|
| `pnpm install --frozen-lockfile` | ثُبتت الاعتمادات من lockfile دون تعديل مطلوب | PASS |
| `pnpm check` | `tsc --noEmit` اكتمل دون أخطاء | PASS |
| `pnpm test` | 78 ملف اختبار، 304 اختباراً ناجحاً | PASS |
| `pnpm build` | Vite وesbuild أنتجا `dist/public` و`dist/index.js` | PASS |
| `pnpm exec cap sync android` | نُسخت أصول الواجهة إلى Android، واكتُشفت إضافتا Filesystem وShare | PASS |
| `./android/gradlew assembleRelease` | `BUILD SUCCESSFUL` وأُنتج APK | PASS |
| `./android/gradlew -p android test lintRelease` | `BUILD SUCCESSFUL` | PASS |
| فحص secrets النصي | لم يظهر مفتاح أو private key ضمن الأنماط المفحوصة | PASS، نطاقه محدود بالأنماط |
| `aapt dump badging` | Package ID وSDK وActivity متطابقة مع المصدر | PASS |
| `apksigner verify --verbose` | v1 وv2 صحيحان؛ v3/v4 غير مستخدمين في هذا الناتج | PASS مع ملاحظة |

تحوي بعض الاختبارات رسائل stderr متوقعة، مثل فشل مزود API وهمي أو عدم توفر Canvas في jsdom، لكنها لا تفشل assertions؛ لا ينبغي تفسير الرسائل كاختبار جهاز حقيقي.

## USER DEVICE TEST REQUIRED

هذه البنود لم تُسجل كمنفذة هنا لأنها تحتاج هاتف Android فعلياً: تثبيت APK، فتح التطبيق بعد التثبيت، اختيار صورة من المعرض، تجربة الكاميرا، تشغيل إزالة الخلفية على صور بأحجام مختلفة، حفظ PNG، فتح لوحة المشاركة، تجربة Guest Mode على جهاز صديق، قياس الحرارة واستهلاك البطارية، واختبار أجهزة منخفضة الذاكرة أو ARM32 أو الأجهزة اللوحية. يجب على المالك تسجيل الجهاز وإصدار Android والنتيجة ولقطة أو سجل عند تنفيذها.

## مصفوفة الاختبار اليدوي المقترحة

| Test Case | Expected | Device/Android | Result |
|---|---|---|---|
| تثبيت APK | يثبت دون فتح موقع خارجي | يملؤه المالك | NOT TESTED |
| فتح التطبيق | تظهر واجهة غرفة الملابس بلا Chrome أو TWA | يملؤه المالك | NOT TESTED |
| رفع JPG/PNG/WebP | تظهر الصورة وتنتقل للمعالجة | يملؤه المالك | NOT TESTED |
| إزالة الخلفية | نتيجة محلية أو رسالة فشل قابلة للاسترداد | يملؤه المالك | NOT TESTED |
| القالب والتصدير | PNG محفوظ بالقياس المتوقع | يملؤه المالك | NOT TESTED |
| مشاركة | تظهر Android Share Sheet | يملؤه المالك | NOT TESTED |
| الإنترنت مغلق | القلب المحلي يستمر | يملؤه المالك | NOT TESTED |
| جهاز ضعيف | لا تجمد دائم؛ رسالة واضحة عند نفاد الموارد | يملؤه المالك | NOT TESTED |
