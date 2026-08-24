import type { MerchantAssistantSession, MerchantProfile } from '@shared/merchantAssistant';
import type { TemplateSettings } from '@shared/types';

export type LocalProjectBackup = {
  version: 2;
  app: 'clothing-ad-generator-pro';
  createdAt: number;
  profile: MerchantProfile;
  session: MerchantAssistantSession;
  template: TemplateSettings;
};

const SENSITIVE_FIELD = /(?:api[_-]?key|secret|token|password|authorization|cookie|session[_-]?token)/i;

function removeSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSensitiveFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_FIELD.test(key))
    .map(([key, child]) => [key, removeSensitiveFields(child)]));
}

function containsSensitiveField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => SENSITIVE_FIELD.test(key) || containsSensitiveField(child));
}

export function createLocalProjectBackup(profile: MerchantProfile, session: MerchantAssistantSession, template: TemplateSettings): LocalProjectBackup {
  return {
    version: 2,
    app: 'clothing-ad-generator-pro',
    createdAt: Date.now(),
    profile: removeSensitiveFields(profile) as MerchantProfile,
    session: removeSensitiveFields(session) as MerchantAssistantSession,
    template: removeSensitiveFields(template) as TemplateSettings,
  };
}

export function stringifyLocalProjectBackup(backup: LocalProjectBackup) {
  return JSON.stringify(backup, null, 2);
}

export function parseLocalProjectBackup(value: string): LocalProjectBackup | null {
  try {
    const parsed = JSON.parse(value) as Partial<Omit<LocalProjectBackup, 'version' | 'app'>> & { version?: number; app?: string };
    if ((parsed.version !== 1 && parsed.version !== 2) || !parsed.profile || !parsed.session || !parsed.template || typeof parsed.createdAt !== 'number') return null;
    if (!Array.isArray(parsed.session.messages) || !Array.isArray(parsed.session.tasks) || containsSensitiveField(parsed)) return null;
    return { version: 2, app: 'clothing-ad-generator-pro', createdAt: parsed.createdAt, profile: parsed.profile, session: parsed.session, template: parsed.template } as LocalProjectBackup;
  } catch {
    return null;
  }
}

export function backupFilename(createdAt: number) {
  return `clothing-studio-backup-v2-${new Date(createdAt).toISOString().slice(0, 10)}.json`;
}
