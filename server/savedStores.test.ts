// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SAVED_STORES_LIMIT, deleteSavedStore, loadSavedStores, saveSavedStore } from '../client/src/lib/savedStores';
import { createMerchantProfile } from '../shared/merchantAssistant';
import { StorageKeys } from '../shared/types';

function profileWith(patch: Partial<ReturnType<typeof createMerchantProfile>>) {
  return { ...createMerchantProfile(), ...patch };
}

describe('المتاجر المحفوظة محلياً', () => {
  beforeEach(() => localStorage.clear());

  it('يحفظ بيانات المتجر ويستعيدها بعد إعادة فتح التطبيق', () => {
    const result = saveSavedStore(profileWith({ storeName: 'شي إن التربة', storePhone: '777123456', storeLocation: 'التربة', storeCategories: ['نسائي', 'بناتي'], defaultDiscount: '20' }));
    expect(result.created).toBe(true);
    expect(result.store?.storeName).toBe('شي إن التربة');

    const restored = loadSavedStores();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ storeName: 'شي إن التربة', storePhone: '777123456', storeLocation: 'التربة', defaultDiscount: '20' });
    expect(restored[0].storeCategories).toEqual(['نسائي', 'بناتي']);
  });

  it('يحدّث المتجر نفسه عند حفظ الاسم مرة أخرى بدل تكراره', () => {
    saveSavedStore(profileWith({ storeName: 'أقل سعر', storePhone: '1' }));
    const again = saveSavedStore(profileWith({ storeName: 'أقل سعر', storePhone: '2', storeLocation: 'عدن' }));
    expect(again.created).toBe(false);
    const stores = loadSavedStores();
    expect(stores).toHaveLength(1);
    expect(stores[0].storePhone).toBe('2');
    expect(stores[0].storeLocation).toBe('عدن');
  });

  it('يرفض الحفظ بلا اسم متجر ولا يغيّر القائمة', () => {
    const result = saveSavedStore(profileWith({ storeName: '   ' }));
    expect(result.store).toBeNull();
    expect(loadSavedStores()).toEqual([]);
  });

  it('يبقي الأحدث ضمن الحد الأقصى عند تجاوزه', () => {
    for (let i = 1; i <= SAVED_STORES_LIMIT + 3; i += 1) {
      saveSavedStore(profileWith({ storeName: `متجر ${i}` }));
    }
    const stores = loadSavedStores();
    expect(stores).toHaveLength(SAVED_STORES_LIMIT);
    expect(stores[0].storeName).toBe(`متجر ${SAVED_STORES_LIMIT + 3}`);
    expect(stores.some(store => store.storeName === 'متجر 1')).toBe(false);
  });

  it('يتجاهل البيانات التالفة أو بلا اسم عند القراءة', () => {
    localStorage.setItem(StorageKeys.SAVED_STORES, 'not-json-at-all');
    expect(loadSavedStores()).toEqual([]);
  });

  it('يحذف المتجر المطلوب فقط', () => {
    const first = saveSavedStore(profileWith({ storeName: 'الأول' })).store!;
    saveSavedStore(profileWith({ storeName: 'الثاني' }));
    const remaining = deleteSavedStore(first.id);
    expect(remaining.map(store => store.storeName)).toEqual(['الثاني']);
    expect(loadSavedStores().map(store => store.storeName)).toEqual(['الثاني']);
  });
});
