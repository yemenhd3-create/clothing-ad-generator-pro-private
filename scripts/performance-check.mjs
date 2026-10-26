import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist/public/assets');
const entries = await Promise.all(
  (await readdir(assetsDirectory))
    .filter((fileName) => fileName.endsWith('.js') || fileName.endsWith('.css'))
    .map(async (fileName) => ({
      fileName,
      bytes: (await stat(path.join(assetsDirectory, fileName))).size,
    })),
);

function findAsset(prefix, extension) {
  const asset = entries.find((entry) => entry.fileName.startsWith(prefix) && entry.fileName.endsWith(extension));
  if (!asset) throw new Error(`ملف الحزمة المتوقع غير موجود: ${prefix}${extension}`);
  return asset;
}

const main = findAsset('index-', '.js');
const reactVendor = findAsset('vendor-react-', '.js');
const dataVendor = findAsset('vendor-data-', '.js');
const uiVendor = findAsset('vendor-ui-', '.js');
const css = findAsset('index-', '.css');
const about = findAsset('AboutApp-', '.js');
const developer = findAsset('DeveloperWorkspace-', '.js');

const initialJavaScriptBytes = main.bytes + reactVendor.bytes + dataVendor.bytes + uiVendor.bytes;
const deferredJavaScriptBytes = about.bytes + developer.bytes;
const budgets = {
  mainJavaScript: 180 * 1024,
  initialJavaScript: 750 * 1024,
  deferredJavaScript: 45 * 1024,
  css: 132 * 1024,
};

const violations = [
  ['الحزمة الرئيسية', main.bytes, budgets.mainJavaScript],
  ['حزم JavaScript الأولية', initialJavaScriptBytes, budgets.initialJavaScript],
  ['الحزم المؤجلة', deferredJavaScriptBytes, budgets.deferredJavaScript],
  ['CSS', css.bytes, budgets.css],
].filter(([, actual, budget]) => actual > budget);

const toKiB = (bytes) => Number((bytes / 1024).toFixed(1));
console.log(JSON.stringify({
  status: violations.length === 0 ? 'pass' : 'fail',
  initial: {
    mainJavaScriptKiB: toKiB(main.bytes),
    bundledJavaScriptKiB: toKiB(initialJavaScriptBytes),
    cssKiB: toKiB(css.bytes),
  },
  deferred: {
    aboutAppKiB: toKiB(about.bytes),
    developerWorkspaceKiB: toKiB(developer.bytes),
    totalKiB: toKiB(deferredJavaScriptBytes),
  },
  budgetsKiB: Object.fromEntries(Object.entries(budgets).map(([key, bytes]) => [key, toKiB(bytes)])),
  violations: violations.map(([name, actual, budget]) => ({ name, actualKiB: toKiB(actual), budgetKiB: toKiB(budget) })),
}, null, 2));

if (violations.length) process.exitCode = 1;
