# دليل الصيانة والإصدار

## تحديث الاعتمادات

حدّث حزمة واحدة في فرع مستقل، ثم راجع changelog والترخيص، وشغّل `pnpm install` و`pnpm check` و`pnpm test` و`pnpm build`. عند تحديث Capacitor شغّل `pnpm exec cap sync android` وافحص تغييرات `android/` قبل الالتزام. لا ترفع `pnpm-lock.yaml` من دون اختبار Clean Clone.

## تحديث Android

حدّث Android SDK وAGP وGradle Wrapper معاً وفق مصفوفة التوافق. راجع `minSdk`, `targetSdk`, الصلاحيات، ومكوّنات Manifest. شغّل `./android/gradlew -p android test lintRelease` ثم `pnpm android:build`. لا تغيّر Package ID بعد توزيع الإصدار.

## تغيير النموذج المحلي

أي نموذج جديد يجب أن يثبت مصدره وترخيصه وSHA-256 وحجمه، ثم يوضع ضمن مسار الأصول الذي ينسخه Capacitor. اختبر الذاكرة والوقت ونتيجة القص على أجهزة منخفضة وحديثة. لا تحذف النموذج القديم قبل وجود رجوع آمن.

## إصدار Release

يتحقق المالك من وجود keystore تحت سيطرته، يضبط `APK_KEYSTORE_PATH` و`APK_KEYSTORE_PASSWORD` خارج Git، يبني APK، يفحص `apksigner`, يسجل SHA-256 وPackage ID وVersion Code، ثم يحتفظ بملف الإصدار وشهادة التوقيع في مخزن يملكه. لا تُحفظ كلمة المرور في shell history أو README.

## إصلاح الأعطال

ابدأ بإعادة إنتاج العطل في Clean Clone، ثم أضف اختباراً يصفه قبل تعديل السلوك. افحص `server/` للأعطال الخادمية وسجل المتصفح للمشكلات المحلية، وميّز دائماً بين عطل WebView وعطل خدمة خارجية. بعد الإصلاح شغّل الاختبارات الكاملة وحدّث `todo.md` و`CHANGELOG.md`.

## خدمات الحسابات

تُنقل حسابات GitHub والنشر وقاعدة البيانات والتخزين ومزودي AI إلى المالك. عند تغيير مزود متصل، لا تُضمّن المفتاح في العميل؛ حدّث متغيرات البيئة في مدير أسرار المالك واختبر fallback المحلي.
