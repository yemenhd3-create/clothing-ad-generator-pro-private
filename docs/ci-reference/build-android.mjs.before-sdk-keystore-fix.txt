import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const run = (file, args, options = {}) => {
  console.log(`$ ${file} ${args.join(" ")}`);
  execFileSync(file, args, { cwd: root, stdio: "inherit", env: process.env, ...options });
};

if (!existsSync(resolve(root, "android/gradlew"))) {
  throw new Error("Android project is missing. Restore android/ from the repository before building.");
}

run("pnpm", ["build"]);
run("pnpm", ["exec", "cap", "sync", "android"]);
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "/home/ubuntu/.bubblewrap/android_sdk";
if (!existsSync(androidHome)) {
  throw new Error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT to a valid SDK directory.");
}
writeFileSync(resolve(root, "android/local.properties"), `sdk.dir=${androidHome.replaceAll("\\\\", "/")}\n`);
run("./gradlew", ["assembleRelease"], { cwd: resolve(root, "android") });

const releaseDir = resolve(root, "android/app/build/outputs/apk/release");
const signedApk = resolve(releaseDir, "app-release.apk");
const unsignedApk = resolve(releaseDir, "app-release-unsigned.apk");
const apk = existsSync(signedApk) ? signedApk : unsignedApk;
if (!existsSync(apk)) throw new Error(`Release APK was not produced in ${releaseDir}`);

const artifacts = resolve(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
const destinationName = apk === signedApk ? "ghorfat-almalabes-release.apk" : "ghorfat-almalabes-release-unsigned.apk";
const destination = resolve(artifacts, destinationName);
copyFileSync(apk, destination);
console.log(`APK: ${destination}`);
