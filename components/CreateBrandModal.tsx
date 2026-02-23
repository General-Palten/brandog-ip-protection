import React, { useState, useRef } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateBrandModal: React.FC<CreateBrandModalProps> = ({ isOpen, onClose }) => {
  const { createBrand, setCurrentBrandId, refreshBrands } = useAuth();
  const { addNotification } = useDashboard();
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const isSubmitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || isCreating || isSubmitting.current) return;

    isSubmitting.current = true;
    setIsCreating(true);
    try {
      const { data, error } = await createBrand(brandName.trim(), websiteUrl.trim() || undefined);

      if (error) {
        // If AbortError, refresh brands to check if it was created
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          await refreshBrands();
          setBrandName('');
          setWebsiteUrl('');
          onClose();
          return;
        }
        addNotification('error', error.message || 'Failed to create brand');
      } else if (data) {
        addNotification('success', `Brand "${data.name}" created successfully`);
        setCurrentBrandId(data.id);
        setBrandName('');
        setWebsiteUrl('');
        onClose();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        await refreshBrands();
        setBrandName('');
        setWebsiteUrl('');
        onClose();
        return;
      }
      addNotification('error', 'Failed to create brand');
    } finally {
      setIsCreating(false);
      isSubmitting.current = false;
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setBrandName('');
      setWebsiteUrl('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Brand">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              Brand Name *
            </label>
            <input
              autoFocus
              type="text"
              required
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
              placeholder="e.g. My Awesome Brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              Website URL (optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
              placeholder="e.g. mybrand.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isCreating || !brandName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Creating...
                </>
              ) : (
                'Create Brand'
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateBrandModal;
