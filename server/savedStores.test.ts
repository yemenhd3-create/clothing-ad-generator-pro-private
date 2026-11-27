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

  it('يحفظ الشعار والتذييل مع المتجر ويستعيدهما', () => {
    const logo = 'data:image/webp;base64,LOGO';
    const footer = 'data:image/webp;base64,FOOTER';
    const result = saveSavedStore(profileWith({ storeName: 'شي إن التربة' }), { storeLogoArtwork: logo, footerArtwork: footer });
    expect(result.store?.storeLogoArtwork).toBe(logo);
    expect(result.store?.footerArtwork).toBe(footer);
    const restored = loadSavedStores();
    expect(restored[0].storeLogoArtwork).toBe(logo);
    expect(restored[0].footerArtwork).toBe(footer);
  });

  it('يحدّث الشعار والتذييل عند إعادة حفظ المتجر نفسه', () => {
    saveSavedStore(profileWith({ storeName: 'أقل سعر' }), { storeLogoArtwork: 'data:image/webp;base64,OLD' });
    const again = saveSavedStore(profileWith({ storeName: 'أقل سعر' }), { storeLogoArtwork: 'data:image/webp;base64,NEW', footerArtwork: 'data:image/webp;base64,F' });
    expect(again.created).toBe(false);
    const stores = loadSavedStores();
    expect(stores).toHaveLength(1);
    expect(stores[0].storeLogoArtwork).toBe('data:image/webp;base64,NEW');
    expect(stores[0].footerArtwork).toBe('data:image/webp;base64,F');
  });

  it('يسجّل حقلاً فارغين عند الحفظ بلا شعار أو تذييل ليميّزها عن السجلات القديمة', () => {
    const result = saveSavedStore(profileWith({ storeName: 'بلا هوية' }));
    expect(result.store?.storeLogoArtwork).toBe('');
    expect(result.store?.footerArtwork).toBe('');
  });

  it('يرفض قيم هوية ليست صوراً ويترك حقول السجلات القديمة الغائبة غائبة', () => {
    const result = saveSavedStore(profileWith({ storeName: 'متجر' }), { storeLogoArtwork: 'https://example.com/logo.png' });
    expect(result.store?.storeLogoArtwork).toBe('');

    const legacy = [{ id: 'old-1', storeName: 'قديم', storePhone: '', deliveryPhone: '', storeLocation: '', storeCategory: '', storeCategories: [], defaultDiscount: '', defaultColors: [], updatedAt: 1 }];
    localStorage.setItem(StorageKeys.SAVED_STORES, JSON.stringify(legacy));
    const restored = loadSavedStores();
    expect(restored[0].storeName).toBe('قديم');
    expect(restored[0].storeLogoArtwork).toBeUndefined();
    expect(restored[0].footerArtwork).toBeUndefined();
  });
});
