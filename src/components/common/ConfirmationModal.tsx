import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isLoading = false,
  children,
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantBtn = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-rose-600/20',
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 shadow-emerald-600/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 shadow-amber-600/20'
  }[confirmVariant];

  const variantIcon = {
    danger: <AlertTriangle className="w-6 h-6 text-rose-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    primary: <CheckCircle2 className="w-6 h-6 text-emerald-600" />
  }[confirmVariant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
              {variantIcon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{title}</h3>
              {description && (
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
              )}
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-200 transition-all disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-5 py-2 text-sm font-semibold rounded-lg shadow-sm focus:outline-hidden focus:ring-2 focus:ring-offset-2 transition-all flex items-center gap-2 disabled:opacity-50 ${variantBtn}`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
