import React, { useState } from 'react';
import { DismissReason } from '../types';
import { X } from 'lucide-react';

interface DismissReasonPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: DismissReason, reasonText?: string) => void;
  itemCount?: number;
}

const DISMISS_REASONS: { value: DismissReason; label: string; description: string }[] = [
  {
    value: 'licensed_authorized',
    label: 'Licensed / Authorized',
    description: 'This seller is licensed or authorized to use our brand',
  },
  {
    value: 'not_our_product',
    label: 'Not our product',
    description: 'This is not actually our product or brand',
  },
  {
    value: 'insufficient_evidence',
    label: 'Insufficient evidence',
    description: 'Not enough evidence to pursue this case',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another reason not listed above',
  },
];

const DismissReasonPicker: React.FC<DismissReasonPickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount = 1,
}) => {
  const [selectedReason, setSelectedReason] = useState<DismissReason>('not_our_product');
  const [reasonText, setReasonText] = useState('');

  const handleConfirm = () => {
    onConfirm(selectedReason, selectedReason === 'other' ? reasonText : undefined);
    setSelectedReason('not_our_product');
    setReasonText('');
  };

  const handleClose = () => {
    setSelectedReason('not_our_product');
    setReasonText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-primary">
            Dismiss {itemCount > 1 ? `${itemCount} cases` : 'case'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 text-secondary hover:text-primary hover:bg-surface rounded"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-secondary mb-4">Select a reason for dismissing:</p>

        <div className="space-y-2 mb-4">
          {DISMISS_REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedReason === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-surface'
              }`}
            >
              <input
                type="radio"
                name="dismissReason"
                value={option.value}
                checked={selectedReason === option.value}
                onChange={() => setSelectedReason(option.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-primary">{option.label}</span>
                <p className="text-xs text-secondary mt-0.5">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        {selectedReason === 'other' && (
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Please specify the reason..."
            className="w-full p-3 border border-border rounded-lg text-sm text-primary bg-background focus:outline-none focus:border-primary mb-4 resize-none"
            rows={3}
          />
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedReason === 'other' && !reasonText.trim()}
            className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Dismiss {itemCount > 1 ? `(${itemCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DismissReasonPicker;
