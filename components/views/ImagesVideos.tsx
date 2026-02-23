import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { PersistedAsset } from '../../types';
import { ShieldCheck, Trash2, Loader2, UploadCloud, Globe, FileText, Image as ImageIcon, Video, Search, ChevronDown, Plus, AlertTriangle, ExternalLink, Scan } from 'lucide-react';
import Button from '../ui/Button';
import SearchResultsModal from '../SearchResultsModal';

const ImagesVideos: React.FC = () => {
  const {
    assets,
    assetsLoading,
    addAsset,
    deleteAsset,
    getAssetURL,
    addNotification
  } = useDashboard();

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Filtering & Sorting
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'text'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Asset URL cache for display
  const [assetURLs, setAssetURLs] = useState<Map<string, string>>(new Map());
  const [loadingURLs, setLoadingURLs] = useState<Set<string>>(new Set());

  // Search modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchingAsset, setSearchingAsset] = useState<PersistedAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load URLs for visible assets
  useEffect(() => {
    const loadURLs = async () => {
      for (const asset of assets) {
        if (asset.type !== 'text' && !assetURLs.has(asset.id) && !loadingURLs.has(asset.id)) {
          setLoadingURLs(prev => new Set(prev).add(asset.id));
          try {
            const url = await getAssetURL(asset.id);
            setAssetURLs(prev => new Map(prev).set(asset.id, url));
          } catch (error) {
            console.error('Failed to load asset URL:', asset.id, error);
          } finally {
            setLoadingURLs(prev => {
              const next = new Set(prev);
              next.delete(asset.id);
              return next;
            });
          }
        }
      }
    };
    loadURLs();
  }, [assets, getAssetURL, assetURLs, loadingURLs]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id);
      // Remove from local URL cache
      setAssetURLs(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      addNotification('error', 'Failed to delete asset');
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const selectedFiles = Array.from(files);
    let successCount = 0;
    const failedFiles: string[] = [];

    for (const file of selectedFiles) {
      try {
        await addAsset(file);
        successCount++;
      } catch {
        failedFiles.push(file.name);
      }
    }

    if (successCount > 0) {
      addNotification('success', `${successCount}/${selectedFiles.length} file(s) uploaded successfully`);
    }

    if (failedFiles.length > 0) {
      const preview = failedFiles.slice(0, 2).join(', ');
      const suffix = failedFiles.length > 2 ? ', ...' : '';
      addNotification('error', `Failed to upload ${failedFiles.length} file(s): ${preview}${suffix}`);
    }

    setIsUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleSearchForCopies = (asset: PersistedAsset) => {
    if (asset.type === 'text') {
      addNotification('info', 'Text search is not supported yet');
      return;
    }
    setSearchingAsset(asset);
    setSearchModalOpen(true);
  };

  // Filter Logic
  const filteredAssets = assets
    .filter(a => {
      if (filterType !== 'all' && a.type !== filterType) return false;
      if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return b.dateAdded - a.dateAdded;
      if (sortOrder === 'oldest') return a.dateAdded - b.dateAdded;
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  if (assetsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-secondary">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*,video/*,text/*,.md,.json"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Protected Assets</h1>
          <p className="text-secondary mt-1 text-sm">Central repository for your IP. Used for automated matching.</p>
        </div>

        <div className="flex items-center gap-2 h-[42px]">
          <Button
            onClick={triggerFileInput}
            variant="primary"
            icon={UploadCloud}
            className="h-full"
            isLoading={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center border-b border-border pb-4">
        <div className="flex gap-1 bg-surface p-1 rounded-lg">
          {[
            { id: 'all', label: 'All Assets', icon: null },
            { id: 'image', label: 'Images', icon: ImageIcon },
            { id: 'video', label: 'Videos', icon: Video },
            { id: 'text', label: 'Text', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${filterType === tab.id
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
                }`}
            >
              {tab.icon && <tab.icon size={14} />}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
            <input
              type="text"
              placeholder="Filter assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-1.5 bg-background border border-border rounded-lg text-sm font-medium text-secondary focus:text-primary focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* Upload / Drop Zone Card */}
        <div
          onClick={triggerFileInput}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-secondary cursor-pointer transition-all group duration-200 min-h-[200px]
            ${isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border bg-surface/50 hover:border-secondary hover:bg-surface'
            }
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center mb-3 transition-transform shadow-sm
            ${isDragging
              ? 'bg-primary border-primary text-inverse scale-110'
              : 'bg-background border-border group-hover:scale-110'
            }
          `}>
            {isUploading ? (
              <Loader2 size={24} className="animate-spin text-primary" />
            ) : (
              <Plus size={24} className={isDragging ? 'text-inverse' : 'text-primary'} />
            )}
          </div>
          <span className="font-medium text-sm text-primary">
            {isUploading ? 'Uploading...' : 'Add Files'}
          </span>
          <span className="text-[10px] text-secondary mt-1 text-center px-4">Images, Video, or Text Files</span>
        </div>

        {/* Asset Grid */}
        {filteredAssets.map((asset) => {
          const assetUrl = assetURLs.get(asset.id);
          const isLoadingUrl = loadingURLs.has(asset.id);

          return (
            <div key={asset.id} className="group relative bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/30 transition-all animate-in fade-in zoom-in duration-300 flex flex-col min-h-[200px]">

              {/* Preview Area */}
              <div className="flex-1 relative overflow-hidden bg-zinc-900 flex items-center justify-center">

                {/* Status Badge - Top Right */}
                <div className={`absolute top-2 right-2 z-20 px-2 py-0.5 rounded backdrop-blur-md flex items-center gap-1 text-[10px] font-bold border shadow-sm
                  ${asset.protected
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : 'bg-amber-500/20 border-amber-500/30 text-amber-500'
                  }`}
                >
                  {asset.protected ? (
                    <>
                      <ShieldCheck size={10} />
                      SECURE
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={10} />
                      INFRINGEMENT
                    </>
                  )}
                </div>

                {/* Media Type Icon - Top Left */}
                {asset.type !== 'text' && (
                  <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1.5 rounded backdrop-blur-sm text-white">
                    {asset.type === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}
                  </div>
                )}

                {/* Search Button - Shows on hover for images */}
                {asset.type === 'image' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSearchForCopies(asset);
                    }}
                    className="absolute bottom-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-inverse px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-primary/90"
                  >
                    <Scan size={12} />
                    Search Web
                  </button>
                )}

                {isLoadingUrl ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <Loader2 className="animate-spin text-secondary" size={24} />
                  </div>
                ) : asset.type === 'video' && assetUrl ? (
                  <video src={assetUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                ) : asset.type === 'image' && assetUrl ? (
                  <img src={assetUrl} alt={asset.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                ) : (
                  // Text Asset Visualization
                  <div className="w-full h-full p-5 flex flex-col bg-background text-primary overflow-hidden relative group-hover:bg-surface transition-colors pt-8">
                    {/* Background Decoration */}
                    <div className="absolute -right-6 -bottom-6 text-secondary/5 rotate-12 pointer-events-none transition-colors group-hover:text-secondary/10">
                      <FileText size={100} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                      {/* Aligned Header */}
                      <div className="flex items-center gap-2 mb-3 opacity-50">
                        <FileText size={12} />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Document</span>
                      </div>

                      <div className="border-t border-dashed border-border/50 w-full mb-3"></div>

                      <p className="text-xs leading-relaxed line-clamp-5 text-secondary group-hover:text-primary transition-colors font-mono">
                        {asset.content || "No preview available."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Info */}
              <div className="p-3 bg-background border-t border-border z-10 flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-medium text-primary text-xs truncate flex-1" title={asset.name}>{asset.name}</h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.id);
                    }}
                    className="text-secondary hover:text-red-500 transition-colors -mr-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Source URL for Infringements */}
                {!asset.protected && asset.sourceUrl && (
                  <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[10px] text-amber-500 hover:text-amber-600 transition-colors truncate w-full bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10"
                  >
                    <ExternalLink size={10} className="shrink-0" />
                    <span className="truncate">{asset.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </a>
                )}

                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-secondary uppercase tracking-wider">{asset.type}</p>
                  <p className="text-[10px] text-secondary/50">{new Date(asset.dateAdded).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAssets.length === 0 && !assetsLoading && (
        <div className="text-center py-12 text-secondary">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">No assets found</p>
          <p className="text-sm mt-1">Upload images, videos, or text files to get started</p>
        </div>
      )}

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false);
          setSearchingAsset(null);
        }}
        asset={searchingAsset}
      />
    </div>
  );
};

export default ImagesVideos;
