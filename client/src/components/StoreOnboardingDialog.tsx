import React, { useState } from 'react';
import type { MerchantProfile } from '@shared/merchantAssistant';
import { Store, Phone, MapPin, Tag, Plus, Check, Sparkles, X, ArrowLeft } from 'lucide-react';

interface StoreOnboardingDialogProps {
  isOpen: boolean;
  profile: MerchantProfile;
  onSave: (updatedProfile: MerchantProfile) => void;
  onSkip: () => void;
}

const PRESET_CATEGORIES = [
  'نسائي',
  'رجالي',
  'بناتي',
  'ولادي',
  'مواليد وأطفال',
  'شنط',
  'أحذية',
  'عطور وإكسسوارات',
];

export default function StoreOnboardingDialog({
  isOpen,
  profile,
  onSave,
  onSkip,
}: StoreOnboardingDialogProps) {
  if (!isOpen) return null;

  const [storeName, setStoreName] = useState(profile.storeName || '');
  const [storeLocation, setStoreLocation] = useState(profile.storeLocation || '');
  const [storePhone, setStorePhone] = useState(profile.storePhone || '');
  const [deliveryPhone, setDeliveryPhone] = useState(profile.deliveryPhone || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    profile.storeCategories && profile.storeCategories.length > 0
      ? profile.storeCategories
      : ['نسائي', 'بناتي', 'أطفال']
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories(prev => [...prev, trimmed]);
    }
    setNewCategoryInput('');
    setShowAddCustom(false);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: MerchantProfile = {
      ...profile,
      storeName: storeName.trim().slice(0, 80),
      storeLocation: storeLocation.trim().slice(0, 80),
      storePhone: storePhone.trim().slice(0, 32),
      deliveryPhone: deliveryPhone.trim().slice(0, 32),
      storeCategories: selectedCategories.slice(0, 10),
      storeCategory: selectedCategories.join('، ').slice(0, 48),
      onboardingComplete: true,
      updatedAt: Date.now(),
    };
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in" dir="rtl">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <button
          type="button"
          onClick={onSkip}
          className="absolute left-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          aria-label="إغلاق وتخطي الآن"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store size={28} />
          </div>
          <h2 className="mt-4 text-xl font-black text-foreground">
            مرحباً بك في غرفة الملابس!
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            أدخل البيانات الأساسية لمركزك لمرة واحدة فقط؛ سنستخدمها تلقائياً لضبط القوالب وتوليد نصوص تسويقية احترافية للواتساب.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-foreground">
              <Store size={15} className="text-primary" />
              اسم المركز أو المتجر
            </label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="مثال: مركز الأناقة للأزياء"
              className="h-11 w-full rounded-2xl border border-border bg-muted/50 px-3.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-background"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-foreground">
              <MapPin size={15} className="text-primary" />
              العنوان والمدينة (اختياري)
            </label>
            <input
              type="text"
              value={storeLocation}
              onChange={e => setStoreLocation(e.target.value)}
              placeholder="مثال: صنعاء - شارع حدة، مقابل مول العاصمة"
              className="h-11 w-full rounded-2xl border border-border bg-muted/50 px-3.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-background"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-foreground">
              <Tag size={15} className="text-primary" />
              أقسام وتصنيفات المبيعات في المركز
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_CATEGORIES.map(category => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border border-border bg-secondary text-foreground hover:bg-secondary'
                    }`}
                  >
                    {isSelected && <Check size={13} />}
                    {category}
                  </button>
                );
              })}

              {selectedCategories
                .filter(cat => !PRESET_CATEGORIES.includes(cat))
                .map(customCat => (
                  <button
                    key={customCat}
                    type="button"
                    onClick={() => toggleCategory(customCat)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition active:scale-95"
                  >
                    <Check size={13} />
                    {customCat}
                  </button>
                ))}

              {!showAddCustom ? (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                >
                  <Plus size={14} /> إضافة تصنيف
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    placeholder="تصنيف جديد"
                    className="h-8 w-28 rounded-xl border border-primary px-2 text-xs font-medium text-foreground outline-none"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="rounded-xl bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    إضافة
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-foreground">
                <Phone size={15} className="text-primary" />
                رقم الاستفسار العام (واتساب)
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={storePhone}
                onChange={e => setStorePhone(e.target.value)}
                placeholder="770000000"
                className="h-11 w-full rounded-2xl border border-border bg-muted/50 px-3.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-background"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-foreground">
                <Phone size={15} className="text-emerald-600" />
                رقم خدمة التوصيل والطلب
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={deliveryPhone}
                onChange={e => setDeliveryPhone(e.target.value)}
                placeholder="771111111"
                className="h-11 w-full rounded-2xl border border-border bg-muted/50 px-3.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-background"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-md transition active:scale-95"
          >
            <Sparkles size={17} />
            حفظ وبدء العمل
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-border bg-secondary px-5 text-xs font-bold text-muted-foreground transition hover:bg-secondary active:scale-95"
          >
            تخطي والإكمال لاحقاً
            <ArrowLeft size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
