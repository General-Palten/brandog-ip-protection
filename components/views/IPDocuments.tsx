import React, { useState, useEffect, useRef } from 'react';
import { MOCK_DOCS } from '../../constants';
import { FileText, Download, CheckCircle, Clock, Plus, MoreVertical, Trash2, Loader2, Upload, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import BentoCard from '../ui/BentoCard';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { uploadIPDocument, getIPDocumentUrl, deleteFile } from '../../lib/storage';
import {
  fetchIPDocuments,
  createIPDocument,
  deleteIPDocument,
  type IPDocumentItem
} from '../../lib/data-service';

interface IPDocumentsProps {
  onUploadRef?: React.RefObject<(() => void) | null>;
}

const IPDocuments: React.FC<IPDocumentsProps> = ({ onUploadRef }) => {
  const { user, currentBrand } = useAuth();
  const { addNotification } = useDashboard();

  const [documents, setDocuments] = useState<IPDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<IPDocumentItem['type']>('Trademark');
  const [newRegNumber, setNewRegNumber] = useState('');
  const [newStatus, setNewStatus] = useState<IPDocumentItem['status']>('Active');
  const [newExpiry, setNewExpiry] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents from Supabase or fallback to mock
  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoading(true);

      if (!isSupabaseConfigured() || !currentBrand) {
        // Fallback to mock data (transform to match our type)
        setDocuments(MOCK_DOCS.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type as IPDocumentItem['type'],
          regNumber: d.regNumber,
          status: d.status as IPDocumentItem['status'],
          expiry: d.expiry,
          storagePath: null,
        })));
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchIPDocuments(currentBrand.id);
        if (data.length > 0) {
          setDocuments(data);
        } else {
          // Show mock data if no real data exists
          setDocuments(MOCK_DOCS.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type as IPDocumentItem['type'],
            regNumber: d.regNumber,
            status: d.status as IPDocumentItem['status'],
            expiry: d.expiry,
            storagePath: null,
          })));
        }
      } catch (error) {
        console.error('Error loading IP documents:', error);
        setDocuments(MOCK_DOCS.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type as IPDocumentItem['type'],
          regNumber: d.regNumber,
          status: d.status as IPDocumentItem['status'],
          expiry: d.expiry,
          storagePath: null,
        })));
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, [currentBrand?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!newName) {
        setNewName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for name
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    if (!isSupabaseConfigured() || !currentBrand || !user) {
      // Mock mode
      const newDoc: IPDocumentItem = {
        id: Date.now().toString(),
        name: newName,
        type: newType,
        regNumber: newRegNumber || '-',
        status: newStatus,
        expiry: newExpiry || '-',
        storagePath: null,
      };
      setDocuments([newDoc, ...documents]);
      resetForm();
      return;
    }

    setIsSaving(true);
    try {
      let storagePath: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        const { path, error } = await uploadIPDocument(user.id, currentBrand.id, selectedFile);
        if (error) {
          throw error;
        }
        storagePath = path;
      }

      // Create database record
      const data = await createIPDocument(currentBrand.id, {
        name: newName,
        docType: newType,
        registrationNumber: newRegNumber || undefined,
        status: newStatus,
        expiryDate: newExpiry || undefined,
        storagePath: storagePath || undefined,
      });

      if (data) {
        const newDoc: IPDocumentItem = {
          id: data.id,
          name: data.name,
          type: data.doc_type,
          regNumber: data.registration_number || '-',
          status: data.status,
          expiry: data.expiry_date || '-',
          storagePath: data.storage_path,
        };
        setDocuments([newDoc, ...documents]);
        addNotification('success', 'Document uploaded successfully');
        resetForm();
      } else {
        addNotification('error', 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error adding IP document:', error);
      addNotification('error', 'Failed to upload document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    if (!isSupabaseConfigured()) {
      setDocuments(documents.filter(d => d.id !== id));
      setMenuOpenId(null);
      return;
    }

    setDeletingId(id);
    try {
      // Delete from storage if exists
      if (doc.storagePath) {
        await deleteFile('ip-documents', doc.storagePath);
      }

      // Delete database record
      const success = await deleteIPDocument(id);

      if (success) {
        setDocuments(documents.filter(d => d.id !== id));
        addNotification('success', 'Document deleted');
      } else {
        addNotification('error', 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      addNotification('error', 'Failed to delete document');
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  const handleDownload = async (doc: IPDocumentItem) => {
    if (!doc.storagePath) {
      addNotification('info', 'No file attached to this document');
      return;
    }

    setDownloadingId(doc.id);
    try {
      const url = await getIPDocumentUrl(doc.storagePath);
      if (url) {
        window.open(url, '_blank');
      } else {
        addNotification('error', 'Failed to get download URL');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      addNotification('error', 'Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setNewName('');
    setNewType('Trademark');
    setNewRegNumber('');
    setNewStatus('Active');
    setNewExpiry('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Expose upload trigger to parent
  useEffect(() => {
    if (onUploadRef && 'current' in onUploadRef) {
      (onUploadRef as React.MutableRefObject<(() => void) | null>).current = () => setIsModalOpen(true);
    }
    return () => {
      if (onUploadRef && 'current' in onUploadRef) {
        (onUploadRef as React.MutableRefObject<(() => void) | null>).current = null;
      }
    };
  }, [onUploadRef]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-secondary">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileSelect}
      />

      {documents.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">Upload your IP documents to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {documents.map((doc) => (
              <BentoCard key={doc.id} className="relative group hover:border-primary/50 transition-all">
                 <div className="p-6">
                     {/* Menu button */}
                     <div className="absolute top-4 right-4">
                       <button
                         onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}
                         className="text-secondary hover:text-primary transition-colors p-1"
                       >
                          <MoreVertical size={16} />
                       </button>
                       {menuOpenId === doc.id && (
                         <>
                           <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                           <div className="absolute right-0 top-8 bg-background border border-border rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                             <button
                               onClick={() => handleDelete(doc.id)}
                               disabled={deletingId === doc.id}
                               className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-50"
                             >
                               {deletingId === doc.id ? (
                                 <Loader2 size={14} className="animate-spin" />
                               ) : (
                                 <Trash2 size={14} />
                               )}
                               Delete
                             </button>
                           </div>
                         </>
                       )}
                     </div>

                     <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 bg-primary/5 text-primary border border-primary/10 rounded-lg flex items-center justify-center shrink-0">
                           <FileText size={20} />
                        </div>
                        <div className="pr-6">
                           <h3 className="font-medium text-primary leading-tight mb-1 line-clamp-2">{doc.name}</h3>
                           <p className="text-xs text-secondary uppercase tracking-wide">{doc.type}</p>
                        </div>
                     </div>

                     <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm py-2 border-b border-border/50 border-dashed">
                           <span className="text-secondary">Reg. Number</span>
                           <span className="font-mono text-primary">{doc.regNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm py-2 border-b border-border/50 border-dashed">
                           <span className="text-secondary">Status</span>
                           <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                             doc.status === 'Active' ? 'text-green-500' :
                             doc.status === 'Expired' ? 'text-red-500' : 'text-yellow-500'
                           }`}>
                              {doc.status === 'Active' ? <CheckCircle size={12} /> :
                               doc.status === 'Expired' ? <AlertCircle size={12} /> : <Clock size={12} />}
                              {doc.status}
                           </span>
                        </div>
                        <div className="flex justify-between text-sm py-2">
                           <span className="text-secondary">Expiry</span>
                           <span className="text-primary font-mono">{doc.expiry}</span>
                        </div>
                     </div>

                     <button
                       onClick={() => handleDownload(doc)}
                       disabled={downloadingId === doc.id || !doc.storagePath}
                       className={`w-full py-2 bg-background border border-border rounded text-sm font-medium transition-all flex items-center justify-center gap-2
                         ${doc.storagePath
                           ? 'text-secondary hover:text-primary hover:border-primary'
                           : 'text-secondary/50 cursor-not-allowed'
                         }`}
                     >
                        {downloadingId === doc.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        {doc.storagePath ? 'Download PDF' : 'No File'}
                     </button>
                 </div>
              </BentoCard>
           ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title="Upload IP Document"
      >
        <div className="p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Document File</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${selectedFile ? 'border-primary bg-primary/5' : 'border-border hover:border-secondary'}`}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <FileText size={16} />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                ) : (
                  <div className="text-secondary">
                    <Upload size={24} className="mx-auto mb-2" />
                    <p className="text-sm">Click to select file</p>
                    <p className="text-xs mt-1">PDF, DOC, DOCX, JPG, PNG</p>
                  </div>
                )}
              </div>
            </div>

            {/* Document Name */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Document Name *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                placeholder="e.g. US Trademark Registration"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as IPDocumentItem['type'])}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
              >
                <option value="Trademark">Trademark</option>
                <option value="Copyright">Copyright</option>
                <option value="Patent">Patent</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Registration Number */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Registration Number</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                placeholder="e.g. 88765432"
                value={newRegNumber}
                onChange={e => setNewRegNumber(e.target.value)}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as IPDocumentItem['status'])}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Expiry Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                value={newExpiry}
                onChange={e => setNewExpiry(e.target.value)}
              />
            </div>

            <div className="pt-6 flex gap-3">
              <Button type="button" variant="ghost" className="flex-1" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" />
                    Uploading...
                  </>
                ) : (
                  'Upload Document'
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default IPDocuments;
