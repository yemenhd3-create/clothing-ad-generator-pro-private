# غرفة الملابس — Professional Clothing Ad Generator

تطبيق شخصي وتعليمي عربي موجّه للهاتف لتحويل صورة قطعة ملابس إلى إعلان قابل للتنزيل والمشاركة. الواجهة الأساسية، إزالة الخلفية، القالب، الحفظ المحلي، والتصدير مصممة للعمل داخل الجهاز. الخدمات المتصلة اختيارية ولا يجوز اعتبار الموقع المستضاف شرطاً لتشغيل واجهة التطبيق المضمنة في APK.

## مصدر الحقيقة والملكية

المستودع الخاص هو مصدر الحقيقة الوحيد:

`https://github.com/yemenhd3-create/clothing-ad-generator-pro-private`

يجب أن تكون النتيجة بعد الاستنساخ النظيف: **Clone → Install → Configure → Build → APK**. لا تعتمد عملية البناء على مجلد Android خارجي أو ملف APK سابق. مجلد `android/` وملف `capacitor.config.json` وسكربت `scripts/build-android.mjs` محفوظة في المستودع. لا توجد ملفات `.env` أو مفاتيح API أو كلمات مرور في المصدر.

## المتطلبات

| الأداة | الإصدار المثبت والمتحقق منه | الغرض |
|---|---:|---|
| Node.js | 22.13.0 | تشغيل الأدوات وبناء الواجهة والخادم |
| pnpm | 10.15.1 | تثبيت الاعتمادات |
| JDK | 21.0.11 | بناء Android |
| Gradle Wrapper | 8.11.1 | بناء مشروع Android |
| Android Gradle Plugin | 8.7.2 | ربط Gradle وAndroid |
| Capacitor | 7.6.8 | تضمين الواجهة داخل APK |
| Android SDK | compile/target 35 | تجميع الحزمة |

يمكن استخدام إصدارات أحدث متوافقة، لكن يجب تسجيل أي تغيير في تقرير الصيانة وإعادة الاختبارات.

## التشغيل المحلي للويب

```bash
git clone https://github.com/yemenhd3-create/clothing-ad-generator-pro-private.git
cd clothing-ad-generator-pro-private
pnpm install --frozen-lockfile
pnpm dev
```

يفتح الخادم رابط التطوير المطبوع في الطرفية. لتشغيل الوظائف التي تعتمد على الخادم، تُضبط متغيرات البيئة في بيئة التشغيل فقط. الواجهة المحلية لا تتطلب تسجيل دخول لمسار الضيف المحدود.

## الاختبارات والبناء

```bash
pnpm check
pnpm test
pnpm build
pnpm perf:check
pnpm mobile:check
```

لبناء APK مضمّن من نفس المصدر:

```bash
pnpm android:build
```

ينفذ السكربت `pnpm build`، ثم `pnpm exec cap sync android`، ثم `./android/gradlew assembleRelease`. ينشئ Gradle ملف `android/local.properties` محلياً من `ANDROID_HOME` أو `ANDROID_SDK_ROOT`، ولا يُحفظ في Git. عند غياب مفتاح توقيع المالك، ينتج السكربت صراحةً `artifacts/ghorfat-almalabes-release-unsigned.apk`. لا يجوز توزيع هذا الملف على أنه Release مملوك؛ الإصدار القابل للتوزيع يجب أن ينتج `artifacts/ghorfat-almalabes-release.apk` بعد تزويد بيئة البناء بـ keystore المملوك للمالك.

لتوقيع إصدار Release يجب أن يزوّد مالك المشروع بيئة البناء بمسار keystore وكلمة مروره خارج Git:

```bash
export APK_KEYSTORE_PATH=/secure/path/project-release.jks
export APK_KEYSTORE_PASSWORD='provided-through-secure-secret-store'
pnpm android:build
```

لا تُرسل كلمة المرور أو private key في المحادثة ولا تضعهما في المستودع. يجب حفظ نسخة احتياطية من keystore تحت سيطرة المالك، لأن فقدانه يمنع تحديث التطبيق المثبت بنفس معرّف الحزمة.

## بنية التطبيق

| الجزء | الموقع | المسؤولية |
|---|---|---|
| واجهة React | `client/src/` | مسار الرفع، القالب، الإعدادات، النص والمشاركة |
| خادم Express/tRPC | `server/` | المصادقة والخدمات المتصلة وإدارة مزودي AI الاختياريين |
| العقود المشتركة | `shared/` | الأنواع وقرارات الرجوع المحلي |
| قاعدة البيانات | `drizzle/` | المخطط والهجرات فقط؛ لا تُحفظ بيانات قاعدة حقيقية في Git |
| Android/Capacitor | `android/` | نشاط Android، الموارد، Gradle، والمكوّنات الأصلية |
| بناء Android | `scripts/build-android.mjs` | بناء الواجهة، مزامنة Capacitor، وإنتاج APK |
| الإزالة المحلية | `client/src/` + أصول البناء | ONNX Runtime Web ونموذج `u2netp.onnx` المضمن في أصول APK |

`capacitor.config.json` يستخدم `dist/public` ولا يحتوي على `server.url`. لذلك تُنسخ الواجهة إلى APK بدلاً من فتح موقع حي داخل Custom Tab أو TWA.

## Offline / Online

| الوظيفة | بدون إنترنت | تحتاج إنترنت | الملاحظة |
|---|---|---|---|
| فتح واجهة APK | نعم | لا | HTML/JS/CSS مضمّنة |
| Guest Mode | نعم | لا | لا يتطلب حساباً لمسار الضيف المحلي |
| اختيار الصور | نعم | لا | من الجهاز وفق صلاحيات Android المتاحة |
| إزالة الخلفية | نعم | لا | ONNX Runtime Web والنموذج محليان |
| توليد قالب Canvas | نعم | لا | التنفيذ محلي |
| الحفظ والتنزيل | نعم | لا | التخزين المحلي وملف PNG |
| مشاركة النظام | نعم | لا | قد تعتمد التطبيقات المستهدفة على توفرها |
| النص المحسن أو مزود AI | لا | نعم | مسار اختياري؛ عند الفشل يرجع إلى النص المحلي |
| Manus OAuth/قاعدة البيانات | لا | نعم | لا يستخدمه المسار المحلي الضيف |

## الأمان والخصوصية

الصورة في المسار المحلي تنتقل من اختيار الجهاز إلى معالجة Canvas/ONNX داخل التطبيق ثم إلى ملف PNG محلي أو لوحة مشاركة النظام. لا تُرفع إلى الخادم إلا عند اختيار وظيفة متصلة صراحةً. مفاتيح مزودي AI، إن وُجدت، تُدار خادمياً ومشفرة ولا تُرسل إلى الواجهة أو تُحفظ في Git. راجع `docs/HANDOVER_SECURITY_PRIVACY_AR.md` و`docs/HANDOVER_INDEPENDENCE_AUDIT_AR.md` قبل أي إصدار.

## التطوير والصيانة

قبل تغيير schema، حدّث `drizzle/schema.ts` وأنشئ migration ثم طبّقها وفق دليل المشروع. قبل تحديث Capacitor أو Android SDK، نفّذ بناء الويب، الاختبارات، `cap sync`، Gradle unit tests، وlint. لا تغيّر `applicationId` بعد أول توزيع. لا تستبدل نموذج الإزالة أو مكتبة Runtime قبل مراجعة الترخيص والحجم واختبار الأجهزة.

الميزات المؤجلة عمداً، ومنها Google Drive وTry-On الخارجي، ليست متطلبات لبناء APK الحالي ولا ينبغي إدخالها ضمن إغلاق التسليم الحالي.

## توثيق التسليم

- [`docs/HANDOVER_FINAL_REPORT_AR.md`](docs/HANDOVER_FINAL_REPORT_AR.md) — التقرير النهائي وحالة القبول.
- [`docs/HANDOVER_BUILD_EVIDENCE_AR.md`](docs/HANDOVER_BUILD_EVIDENCE_AR.md) — أدلة Clean Clone وAPK.
- [`docs/HANDOVER_ARCHITECTURE_AR.md`](docs/HANDOVER_ARCHITECTURE_AR.md) — المعمارية الفعلية وتدفق البيانات.
- [`docs/HANDOVER_SECURITY_PRIVACY_AR.md`](docs/HANDOVER_SECURITY_PRIVACY_AR.md) — الأمان والخصوصية.
- [`docs/HANDOVER_LICENSES_DEPENDENCIES_AR.md`](docs/HANDOVER_LICENSES_DEPENDENCIES_AR.md) — الاعتمادات والتراخيص.
- [`docs/HANDOVER_INDEPENDENCE_AUDIT_AR.md`](docs/HANDOVER_INDEPENDENCE_AUDIT_AR.md) — استقلالية المطور والملكية.
- [`docs/HANDOVER_TEST_REPORT_AR.md`](docs/HANDOVER_TEST_REPORT_AR.md) — الاختبارات الفعلية ومصفوفة الجهاز.
- [`docs/HANDOVER_MAINTENANCE_AR.md`](docs/HANDOVER_MAINTENANCE_AR.md) — الصيانة وإصدار التحديثات.
- [`docs/ENV_TEMPLATE.example`](docs/ENV_TEMPLATE.example) — أسماء متغيرات البيئة كقالب آمن بلا قيم.

## الحالة الواقعية

بناء Clean Clone وTypeScript وVitest وGradle test/lint قابل للتنفيذ آلياً من المستودع. تثبيت APK على هاتف Android فعلي، وتجربة الكاميرا والمعرض والإزالة والمشاركة على أجهزة حقيقية، تتطلب تنفيذ المستخدم أو مختبر Android فعلياً ولا يجوز تسجيلها كاختبارات تمت هنا. قبول الملكية النهائي يتطلب نقل keystore وحسابات النشر إلى مالك المشروع والتحقق منها خارج المحادثة.

## الترخيص

كود المشروع الأصلي مرخّص MIT كما هو معلن في `package.json`. المكونات الخارجية والنموذج لها تراخيص مستقلة يجب مراجعتها في تقرير التراخيص قبل إعادة التوزيع أو أي استخدام خارج النطاق الشخصي والتعليمي.
