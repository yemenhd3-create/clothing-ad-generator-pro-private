import React from 'react';
import { Button } from './ui/button';
import Modal from './Modal';

type ConfirmDestructiveModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * نافذة تأكيد موحدة للإجراءات الحساسة في لوحة المطور (حذف مزود، إيقاف حساب، إلغاء رمز).
 * تمنع تنفيذ الإجراء بضغطة واحدة عن طريق الخطأ.
 */
export default function ConfirmDestructiveModal({
  isOpen,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'تراجع',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDestructiveModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} variant="outline" disabled={pending}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={pending} className="bg-red-600 text-white hover:bg-red-700">
            {pending ? 'جارٍ التنفيذ…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="leading-7 text-gray-700">{description}</p>
    </Modal>
  );
}
