# تقرير المعمارية الفعلية — غرفة الملابس

## النطاق

المعمارية الفعلية هي تطبيق React/TypeScript داخل خادم Express/tRPC للويب، مع مشروع Android/Capacitor مستقل محفوظ في `android/`. عند بناء APK، ينتج Vite أصول الواجهة في `dist/public` ثم ينفذ `cap sync android` لنسخها إلى `android/app/src/main/assets/public`. لا يحتوي `capacitor.config.json` على `server.url`؛ ولذلك لا يعتمد تشغيل الواجهة المضمنة على عنوان Manus أو Render.

## المكونات

| الطبقة | المكوّن الفعلي | الدور |
|---|---|---|
| UI | React 19 وTailwind 4 وواجهات shadcn/ui | رفع الصور، القالب، الإعدادات، النص، الإخراج |
| Web runtime | Vite | تجميع الواجهة إلى `dist/public` |
| Server | Express 4 وtRPC 11 | إجراءات الخادم الاختيارية والمصادقة والخدمات المتصلة |
| Data | Drizzle/MySQL أو TiDB عند تهيئة البيئة | بيانات الخادم فقط؛ المسار المحلي لا يحتاجها |
| Native shell | Capacitor 7.6.8 وAndroid Gradle | تشغيل HTML/JS/CSS محلياً داخل APK |
| Local ML | ONNX Runtime Web + `u2netp.onnx` | إزالة خلفية الصورة داخل الجهاز |
| Local renderer | Canvas | تركيب الملابس والخلفيات والظل والنص والتصدير |
| Sharing | Web Share/Capacitor Share | حفظ PNG وفتح لوحة مشاركة النظام |
| Optional services | OAuth، AI providers، APIs | تعمل فقط في المسارات المتصلة الاختيارية |

## تدفق الصورة

`اختيار الصورة → ذاكرة المتصفح/التطبيق → ONNX Runtime المحلي → Canvas → PNG محلي → تنزيل أو مشاركة`.

لا تُرسل الصورة إلى الخادم في هذا المسار. إذا اختار المستخدم وظيفة تعتمد على AI أو الخادم، فذلك مسار منفصل يجب توضيحه للمستخدم وتوثيقه في بيئة التشغيل. نموذج الإزالة لا يحتاج تنزيلًا من الإنترنت في APK لأن النموذج وملفات WebAssembly ضمن أصول الحزمة.

## Guest Mode

المسار المحلي الضيف لا يمرر المستخدم إلى OAuth ولا يحتاج قاعدة بيانات لإنشاء إعلان محلي. أدوات المطور وإدارة المفاتيح تبقى خلف مسار خادمي محمي. لذلك لا ينبغي اعتبار Guest Mode بديلاً عن حساب الإدارة.

## البناء

1. `pnpm build` يبني الواجهة والخادم.
2. `pnpm exec cap sync android` ينسخ `dist/public` ويحدّث إضافات Capacitor.
3. `android/gradlew assembleRelease` ينفذ بناء Gradle.
4. الناتج `android/app/build/outputs/apk/release/app-release.apk` وينسخه السكربت إلى `artifacts/`.

## قرارات معمارية

تم اختيار تضمين الواجهة بدلاً من TWA لتجنب الاعتماد على استضافة حيّة لتشغيل القلب المحلي. تم إبقاء AI المتصل وTry-On الخارجي خارج مسار القبول الحالي لتفادي تعطيل الوظائف المحلية. Google Drive غير جزء من هذا الإصدار؛ التخزين المحلي أو خدمات الخادم الاختيارية لا تغير استقلال APK عن واجهة الموقع.
