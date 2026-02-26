import React, { useState } from 'react';
import ImagesVideos from './ImagesVideos';
import Keywords from './Keywords';
import IPDocuments from './IPDocuments';

type AssetTab = 'images' | 'keywords' | 'docs';

interface AssetsViewProps {
  initialTab?: AssetTab;
}

const AssetsView: React.FC<AssetsViewProps> = ({ initialTab = 'images' }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>(initialTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Assets</h1>
          <p className="text-secondary mt-1 text-sm">Manage your brand assets, keywords, and IP documents.</p>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-surface border border-border p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'images' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Images & Videos
          </button>
          <button
            onClick={() => setActiveTab('keywords')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'keywords' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Keywords
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'docs' ? 'bg-zinc-800 text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            IP Documents
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'images' && <ImagesVideos />}
      {activeTab === 'keywords' && <Keywords />}
      {activeTab === 'docs' && <IPDocuments />}
    </div>
  );
};

export default AssetsView;
