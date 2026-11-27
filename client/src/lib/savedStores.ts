import { StorageKeys } from '@shared/types';
import type { MerchantProfile } from '@shared/merchantAssistant';
import { getFromStorage, removeFromStorage, saveToStorage } from './storage';

export const SAVED_STORES_LIMIT = 8;

export type SavedStore = {
  id: string;
  storeName: string;
  storePhone: string;
  deliveryPhone: string;
  storeLocation: string;
  storeCategory: string;
  storeCategories: string[];
  defaultDiscount: string;
  defaultColors: string[];
  /** شعار المتجر (Data URI). غائب في السجلات المحفوظة قبل دعم الهوية البصرية، وفارغ عند الحفظ بلا شعار. */
  storeLogoArtwork?: string;
  /** تذييل المتجر (Data URI). غائب في السجلات القديمة، وفارغ عند الحفظ بلا تذييل. */
  footerArtwork?: string;
  updatedAt: number;
};

export type SavedStoreArtwork = {
  storeLogoArtwork?: string;
  footerArtwork?: string;
};

export type SaveStoreResult = {
  stores: SavedStore[];
  store: SavedStore | null;
  created: boolean;
};

function cleanText(value: unknown, max = 80): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanList(value: unknown, maxItems = 10): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(entry => cleanText(entry, 32)).filter(Boolean))).slice(0, maxItems);
}

function cleanColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).slice(0, 6);
}

const ARTWORK_MAX_CHARS = 400_000;

/** يبقي صور Data URIs فقط؛ يعيد undefined للقيمة الغائبة أو غير الصالحة حتى لا تُمحى هوية السجلات القديمة عند التطبيق. */
function cleanArtwork(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('data:image/')) return undefined;
  return trimmed.slice(0, ARTWORK_MAX_CHARS);
}

function normalizeSavedStore(value: unknown): SavedStore | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const storeName = cleanText(source.storeName);
  if (!storeName) return null;
  return {
    id: cleanText(source.id, 48) || `store-${typeof source.updatedAt === 'number' ? source.updatedAt : 0}`,
    storeName,
    storePhone: cleanText(source.storePhone, 32),
    deliveryPhone: cleanText(source.deliveryPhone, 32),
    storeLocation: cleanText(source.storeLocation),
    storeCategory: cleanText(source.storeCategory, 48),
    storeCategories: cleanList(source.storeCategories),
    defaultDiscount: cleanText(source.defaultDiscount, 16),
    defaultColors: cleanColors(source.defaultColors),
    storeLogoArtwork: cleanArtwork(source.storeLogoArtwork),
    footerArtwork: cleanArtwork(source.footerArtwork),
    updatedAt: typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt) ? source.updatedAt : 0,
  };
}

function sortAndCap(stores: SavedStore[]): SavedStore[] {
  return [...stores].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, SAVED_STORES_LIMIT);
}

export function loadSavedStores(): SavedStore[] {
  const raw = getFromStorage<unknown>(StorageKeys.SAVED_STORES);
  if (!Array.isArray(raw)) return [];
  return sortAndCap(raw.map(normalizeSavedStore).filter((store): store is SavedStore => Boolean(store)));
}

function persist(stores: SavedStore[]): SavedStore[] {
  const next = sortAndCap(stores);
  saveToStorage(StorageKeys.SAVED_STORES, next);
  return next;
}

export function saveSavedStore(profile: MerchantProfile, artwork: SavedStoreArtwork = {}): SaveStoreResult {
  const storeName = cleanText(profile.storeName);
  const stores = loadSavedStores();
  if (!storeName) return { stores, store: null, created: false };
  const existing = stores.find(store => store.storeName === storeName);
  const store: SavedStore = {
    id: existing?.id ?? `store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storeName,
    storePhone: cleanText(profile.storePhone, 32),
    deliveryPhone: cleanText(profile.deliveryPhone, 32),
    storeLocation: cleanText(profile.storeLocation),
    storeCategory: cleanText(profile.storeCategory, 48),
    storeCategories: cleanList(profile.storeCategories),
    defaultDiscount: cleanText(profile.defaultDiscount, 16),
    defaultColors: cleanColors(profile.defaultColors),
    storeLogoArtwork: cleanArtwork(artwork.storeLogoArtwork) ?? '',
    footerArtwork: cleanArtwork(artwork.footerArtwork) ?? '',
    updatedAt: Date.now(),
  };
  return { stores: persist([store, ...stores.filter(entry => entry.id !== store.id)]), store, created: !existing };
}

export function deleteSavedStore(id: string): SavedStore[] {
  return persist(loadSavedStores().filter(store => store.id !== id));
}

export function clearSavedStores(): void {
  removeFromStorage(StorageKeys.SAVED_STORES);
}
