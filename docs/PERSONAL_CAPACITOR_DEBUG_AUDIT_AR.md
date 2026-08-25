# تدقيق APK Capacitor الشخصي — نسخة اختبار

## القرار

رُفضت نسخ Bubblewrap/TWA السابقة لأنها تستخدم معرفات `space.manus.clothgenpro_tjswxvvy.twa` ولا تحتوي ملف واجهة التطبيق داخل الأرشيف. لذلك لا تعد نسخاً مستقلة عن الاستضافة.

## النسخة الجديدة

تم إنشاء مشروع Capacitor جديد من الصفر خارج مصدر الويب، بالمعرّف الشخصي:

```text
com.marwan.ghorfatalmalabes
```

تضم الحزمة ملفات `dist/public` داخل APK، وتشمل `assets/public/index.html` وشعار التطبيق ونموذج U2Net وملفات WebAssembly. إعداد Capacitor لا يحتوي `server.url`، ولم يعثر الفحص على مراجع `TWA` أو `Bubblewrap` أو `Custom Tabs` داخل الأرشيف.

| فحص | النتيجة |
|---|---|
| اسم الحزمة | `com.marwan.ghorfatalmalabes` |
| نشاط الإقلاع | `com.marwan.ghorfatalmalabes.MainActivity` |
| واجهة HTML مدمجة | موجودة |
| نموذج الإزالة محلياً | موجود |
| رابط خادم Capacitor | غير موجود |
| توقيع APK v2 | ناجح |
| نوع الحزمة | Debug للاختبار فقط |

تبقى تجربة التثبيت ورفع صورة على هاتف Android قبولاً يدوياً؛ ولا تحتوي هذه النتيجة على ادعاء باختبار لم يتم على جهاز فعلي.
