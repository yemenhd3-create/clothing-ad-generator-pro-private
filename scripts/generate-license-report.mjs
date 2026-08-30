import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const rows = [];
for (const group of ["dependencies", "devDependencies"]) {
  for (const name of Object.keys(pkg[group] ?? {}).sort()) {
    let installed;
    try {
      installed = JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8"));
    } catch {
      installed = { version: "not installed", license: "not available" };
    }
    const license = typeof installed.license === "string" ? installed.license : installed.license?.type ?? "see package";
    rows.push(`| ${name} | ${installed.version ?? "not installed"} | ${license} | ${group === "dependencies" ? "Runtime" : "Build/test"} |`);
  }
}
const sections = [
  "# جرد الاعتمادات والتراخيص",
  "",
  "هذا الجدول مولد من package.json ونسخ الحزم المثبتة في بيئة البناء. الاعتمادات غير المباشرة قد تحمل تراخيص إضافية؛ قبل إعادة التوزيع، شغّل فحص تراخيص شامل على lockfile واحتفظ بإشعارات الحزم.",
  "",
  "| Dependency | Installed version | License metadata | Required scope |",
  "|---|---:|---|---|",
  rows.join("\n"),
  "",
  "## Android وML",
  "",
  "| Component | Version/source | License | Redistribution note |",
  "|---|---|---|---|",
  "| Capacitor Core/Android | 7.6.8 | MIT | احتفظ بإشعار MIT عند إعادة التوزيع. |",
  "| Capacitor Filesystem | 7.1.8 | MIT | إضافة رسمية؛ راجع إشعار الحزمة. |",
  "| Capacitor Share | 7.0.4 | MIT | إضافة رسمية؛ راجع إشعار الحزمة. |",
  "| ONNX Runtime Web | 1.27.0 | MIT | راجع ThirdPartyNotices للحزمة الموزعة. |",
  "| U-2-Net / u2netp model | upstream U-2-Net | Apache-2.0 للمستودع upstream | يجب الاحتفاظ بإشعار Apache والتحقق من provenance للملف المضمن قبل أي إعادة توزيع. |",
  "| Android Gradle Plugin | 8.7.2 | Apache-2.0 | أداة بناء وليست runtime payload. |",
  "",
  "## مراجع التحقق",
  "",
  "يوضح مستودع U-2-Net الرسمي أن المستودع مرخّص Apache-2.0 [1]. يعلن ONNX Runtime ترخيص MIT [2]، كما يعلن Capacitor ترخيص MIT [3]. يجب عدم تحويل ذلك إلى ضمان قانوني لملف أوزان منفصل ما لم يُراجع مصدره المباشر.",
  "",
  "[1]: https://github.com/xuebinqin/U-2-Net",
  "[2]: https://github.com/microsoft/onnxruntime",
  "[3]: https://github.com/ionic-team/capacitor/blob/main/LICENSE",
  ""
];
writeFileSync(resolve(root, "docs/HANDOVER_LICENSES_DEPENDENCIES_AR.md"), sections.join("\n"));
console.log(`Wrote ${rows.length} direct dependency rows.`);
