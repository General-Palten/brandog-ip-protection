import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PersistedAsset, VisionSearchResponse, VisionSearchResult } from '../types';
import { searchByImage } from '../lib/vision-api';
import { isVisionConfigured } from '../lib/api-config';
import {
  X, Loader2, Search, ExternalLink, Plus, AlertTriangle,
  Image as ImageIcon, Globe, Settings, CheckCircle
} from 'lucide-react';
import Button from './ui/Button';

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: PersistedAsset | null;
}

const SearchResultsModal: React.FC<SearchResultsModalProps> = ({
  isOpen,
  onClose,
  asset
}) => {
  const {
    getAssetBase64,
    getAssetURL,
    createInfringementFromSearch,
    addNotification
  } = useDashboard();

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VisionSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
  const [addedResults, setAddedResults] = useState<Set<string>>(new Set());

  // Load asset preview URL when modal opens
  useEffect(() => {
    if (isOpen && asset) {
      setSearchResults(null);
      setError(null);
      setAddedResults(new Set());

      getAssetURL(asset.id)
        .then(url => setAssetPreviewUrl(url))
        .catch(() => setAssetPreviewUrl(null));
    }
  }, [isOpen, asset, getAssetURL]);

  const handleSearch = async () => {
    if (!asset) return;

    if (!isVisionConfigured()) {
      setError('Vision API not configured. Please add your API key in Settings → Integrations.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults(null);

    try {
      const base64 = await getAssetBase64(asset.id);
      const results = await searchByImage(base64);
      setSearchResults(results);

      if (results.pagesWithMatchingImages.length === 0 &&
          results.fullMatchingImages.length === 0 &&
          results.partialMatchingImages.length === 0) {
        setError('No matching images found on the web. Your image appears to be unique!');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      addNotification('error', message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAsInfringement = (result: VisionSearchResult) => {
    if (!asset) return;

    createInfringementFromSearch(result, asset);
    setAddedResults(prev => new Set(prev).add(result.url));
  };

  if (!isOpen) return null;

  const totalResults = searchResults
    ? searchResults.pagesWithMatchingImages.length +
      searchResults.fullMatchingImages.length +
      searchResults.partialMatchingImages.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Search size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Reverse Image Search</h2>
              <p className="text-xs text-secondary">Find where your image appears online</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Asset Preview */}
          {asset && (
            <div className="flex items-start gap-4 p-4 bg-surface rounded-lg border border-border">
              <div className="w-24 h-24 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0">
                {assetPreviewUrl ? (
                  <img
                    src={assetPreviewUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="text-secondary" size={32} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-primary">{asset.name}</h3>
                <p className="text-xs text-secondary mt-1">
                  Search the web for pages containing this image or similar images.
                </p>
                <div className="mt-3">
                  <Button
                    onClick={handleSearch}
                    isLoading={isSearching}
                    icon={Search}
                  >
                    {isSearching ? 'Searching...' : 'Search Web'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm text-primary">{error}</p>
                {error.includes('Settings') && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      // Navigate to settings - this would need to be wired up to your router
                    }}
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    <Settings size={12} />
                    Go to Settings
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary mb-4" size={40} />
              <p className="text-secondary">Searching billions of web pages...</p>
              <p className="text-xs text-secondary/70 mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* Results */}
          {searchResults && !isSearching && (
            <div className="space-y-6">
              {/* Web Entities (detected labels) */}
              {searchResults.webEntities.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
                    Detected Content
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.webEntities.slice(0, 10).map((entity, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-surface border border-border rounded text-xs text-primary"
                      >
                        {entity.description}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pages with Matching Images */}
              {searchResults.pagesWithMatchingImages.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                    Pages with Matching Images ({searchResults.pagesWithMatchingImages.length})
                  </h4>
                  <div className="space-y-3">
                    {searchResults.pagesWithMatchingImages.map((result, i) => {
                      const isAdded = addedResults.has(result.url);
                      const domain = new URL(result.url).hostname;

                      return (
                        <div
                          key={i}
                          className="p-3 bg-surface border border-border rounded-lg hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Globe size={14} className="text-secondary flex-shrink-0" />
                                <span className="text-xs text-secondary truncate">{domain}</span>
                              </div>
                              <h5 className="font-medium text-primary text-sm mt-1 line-clamp-1">
                                {result.pageTitle || result.url}
                              </h5>
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary/70 hover:text-primary hover:underline truncate block mt-1"
                              >
                                {result.url}
                              </a>

                              {/* Match info */}
                              <div className="flex gap-3 mt-2 text-[10px] text-secondary">
                                {result.fullMatchingImages.length > 0 && (
                                  <span className="text-green-500">
                                    {result.fullMatchingImages.length} exact match(es)
                                  </span>
                                )}
                                {result.partialMatchingImages.length > 0 && (
                                  <span className="text-amber-500">
                                    {result.partialMatchingImages.length} partial match(es)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-secondary hover:text-primary hover:bg-background rounded transition-colors"
                              >
                                <ExternalLink size={16} />
                              </a>
                              <Button
                                size="sm"
                                variant={isAdded ? 'secondary' : 'primary'}
                                onClick={() => handleAddAsInfringement(result)}
                                disabled={isAdded}
                                icon={isAdded ? CheckCircle : Plus}
                              >
                                {isAdded ? 'Added' : 'Add'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Matching Images (standalone) */}
              {searchResults.fullMatchingImages.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                    Full Matching Images ({searchResults.fullMatchingImages.length})
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    {searchResults.fullMatchingImages.slice(0, 8).map((img, i) => (
                      <a
                        key={i}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square bg-zinc-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all group"
                      >
                        <img
                          src={img.url}
                          alt={`Match ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/><text fill="%23666" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">No preview</text></svg>';
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {totalResults === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
                  <p className="text-primary font-medium">No matches found</p>
                  <p className="text-sm text-secondary mt-1">
                    Your image doesn't appear to be used elsewhere on the web.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {searchResults && totalResults > 0 && (
          <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between">
            <p className="text-xs text-secondary">
              Found {totalResults} potential match(es) • {addedResults.size} added as infringement(s)
            </p>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsModal;
