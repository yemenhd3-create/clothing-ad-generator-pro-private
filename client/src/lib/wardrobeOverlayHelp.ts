export function getWardrobeOverlayHelp(layer: 'caption' | 'price') {
  return layer === 'caption'
    ? { placeholder: 'مثال: متوفر لدى مركز أحمد للتخفيضات', hint: 'اكتب جملة قصيرة تظهر أعلى الصورة.' }
    : { placeholder: 'مثال: 5000 ريال', hint: 'اكتب الرقم ثم كلمة ريال؛ سيظهر السعر أسفل الصورة.' };
}
