import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Android Digital Asset Links', () => {
  it('يربط نطاق PWA بحزمة APK وتوقيعها العام من دون أي سر', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'client/public/.well-known/assetlinks.json'),
      'utf8',
    );
    const entries = JSON.parse(source) as Array<{
      target?: { namespace?: string; package_name?: string; sha256_cert_fingerprints?: string[] };
    }>;

    expect(entries).toHaveLength(1);
    expect(entries[0]?.target?.namespace).toBe('android_app');
    expect(entries[0]?.target?.package_name).toBe('space.manus.clothgenpro_tjswxvvy.twa');
    expect(entries[0]?.target?.sha256_cert_fingerprints?.[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});
