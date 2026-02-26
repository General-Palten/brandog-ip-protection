import React, { useState, useRef } from 'react';
import ImagesVideos from './ImagesVideos';
import IPDocuments from './IPDocuments';
import Keywords from './Keywords';
import { FolderOpen, FileText, X, Type, UploadCloud, Plus } from 'lucide-react';
import { ShadTabs, ShadTabsList, ShadTabsTrigger } from '../ui/shadcn-tabs';

type AssetTab = 'ip' | 'docs';

interface AssetsViewProps {
  initialTab?: AssetTab;
}

const AssetsView: React.FC<AssetsViewProps> = ({ initialTab = 'ip' }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>(initialTab);
  const [isKeywordsOpen, setIsKeywordsOpen] = useState(false);

  // Refs to trigger uploads from the header into child components
  const ipUploadRef = useRef<() => void>(null);
  const docsUploadRef = useRef<() => void>(null);

  const handleUpload = () => {
    if (activeTab === 'ip') ipUploadRef.current?.();
    else docsUploadRef.current?.();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Assets</h1>
          <p className="text-secondary mt-1 text-sm">
            Central repository for your intellectual property and brand assets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-inverse rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {activeTab === 'ip' ? <UploadCloud size={16} /> : <Plus size={16} />}
            {activeTab === 'ip' ? 'Upload Files' : 'Upload Document'}
          </button>
          <button
            onClick={() => setIsKeywordsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border text-primary rounded-lg text-sm font-medium hover:bg-surface transition-colors"
          >
            <Type size={16} />
            Manage Keywords
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <ShadTabs>
        <ShadTabsList>
          <ShadTabsTrigger
            active={activeTab === 'ip'}
            icon={FolderOpen}
            onClick={() => setActiveTab('ip')}
          >
            IP
          </ShadTabsTrigger>
          <ShadTabsTrigger
            active={activeTab === 'docs'}
            icon={FileText}
            onClick={() => setActiveTab('docs')}
          >
            Documents
          </ShadTabsTrigger>
        </ShadTabsList>
      </ShadTabs>

      {/* Tab Content */}
      {activeTab === 'ip' && <ImagesVideos onUploadRef={ipUploadRef} />}
      {activeTab === 'docs' && <IPDocuments onUploadRef={docsUploadRef} />}

      {/* Keywords Drawer */}
      {isKeywordsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in"
            onClick={() => setIsKeywordsOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Type size={18} className="text-primary" />
                <h2 className="text-lg font-medium text-primary">Manage Keywords</h2>
              </div>
              <button
                onClick={() => setIsKeywordsOpen(false)}
                className="p-2 text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <Keywords />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AssetsView;
