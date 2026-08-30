# تقرير أدلة البناء — Clean Clone

## النتيجة

تم تنفيذ استنساخ نظيف من المستودع الخاص باستخدام `gh repo clone` إلى بيئة مؤقتة لا تحتوي على `node_modules` مسبقاً. كان Commit المصدر:

`725e90bf7d9c5615fe7a912d07c9ed4f9e2ec505`

ثم نُفذت الأوامر التالية بالترتيب:

```bash
gh repo clone yemenhd3-create/clothing-ad-generator-pro-private clothing-ad-generator-clean-final -- --depth 1
cd clothing-ad-generator-clean-final
pnpm install --frozen-lockfile
pnpm android:build
```

نجح `pnpm android:build` بعد تنفيذ `pnpm build` و`pnpm exec cap sync android` و`./gradlew assembleRelease`. مسار الناتج هو `artifacts/ghorfat-almalabes-release.apk`.

## البيئة

| العنصر | القيمة الفعلية |
|---|---|
| Node.js | v22.13.0 |
| pnpm | 10.15.1 |
| JDK | OpenJDK 21.0.11 |
| Gradle Wrapper | 8.11.1 |
| Android Gradle Plugin | 8.7.2 |
| Capacitor Core/Android | 7.6.8 |
| compileSdk/targetSdk | 35 |
| minSdk | 23 |
| CPU المضيف | Linux amd64 |

## بصمة APK

| الخاصية | القيمة |
|---|---|
| الاسم | `ghorfat-almalabes-release.apk` |
| الحجم | 3,759,146 bytes |
| SHA-256 | `137072ebb57c75d4ebf2563b982e577f515bc1b33df0bab923585c3a759bf66b` |
| Package ID | `com.marwan.ghorfatalmalabes` |
| Version Name | `1.0.0` |
| Version Code | `2` |
| Signing schemes | v1 وv2 صحيحان في فحص APK |

هذه البصمة تخص ناتج Clean Clone بعد البناء الحالي. اختلاف البصمة عن APK سابق متوقع لأن Gradle وVite قد ينتجان أرشيفاً مختلفاً زمنياً؛ إثبات المصدر هو Commit المستنسخ وسجل البناء، لا مساواة البصمة بملف قديم.

## فحص التضمين

أثبت `unzip -l` وجود `assets/public/index.html` وملفات JavaScript/CSS و`assets/public/local-runtime-assets/u2netp.onnx` وملف WebAssembly داخل APK. كما أن `assets/capacitor.config.json` يحدد `webDir` إلى `dist/public` ولا يحتوي `server.url`.

## ملاحظة التوقيع

البناء النظيف بدون أسرار يثبت قابلية البناء، لكنه لا يثبت ملكية مفتاح Release. للتوزيع النهائي يجب أن يبني المالك باستخدام keystore تحت سيطرته، عبر `APK_KEYSTORE_PATH` و`APK_KEYSTORE_PASSWORD`، ثم يحتفظ بالبصمة وشهادة التوقيع في سجل الإصدار.
