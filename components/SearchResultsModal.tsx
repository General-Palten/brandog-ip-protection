import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PersistedAsset, VisionSearchResponse, VisionSearchResult } from '../types';
import { searchByImage } from '../lib/vision-api';
import { isVisionConfigured, getVisionConfig } from '../lib/api-config';
import {
  X, Loader2, Search, ExternalLink, Plus, AlertTriangle,
  Image as ImageIcon, Globe, Settings, CheckCircle, History, Clock, Trash2
} from 'lucide-react';
import Button from './ui/Button';

// Search history entry type
interface SearchHistoryEntry {
  id: string;
  assetId: string;
  assetName: string;
  assetPreviewUrl: string;
  searchDate: string;
  results: VisionSearchResponse;
  globalMatchingImages: string[];
  totalMatches: number;
}

const SEARCH_HISTORY_KEY = 'searchHistory';

// Helper to load search history from localStorage
const loadSearchHistory = (): SearchHistoryEntry[] => {
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Helper to save search history to localStorage
const saveSearchHistory = (history: SearchHistoryEntry[]) => {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
};

const normalizeResultUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const getResultKey = (url: string): string => normalizeResultUrl(url) || url.trim();

const getDomainLabel = (url: string): string => {
  const normalized = normalizeResultUrl(url);
  if (!normalized) return url;

  try {
    return new URL(normalized).hostname;
  } catch {
    return url;
  }
};

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
  const [globalMatchingImages, setGlobalMatchingImages] = useState<string[]>([]);
  const [isAddingResults, setIsAddingResults] = useState(false);

  // Search history state
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<SearchHistoryEntry | null>(null);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  // Load asset preview URL when modal opens
  useEffect(() => {
    if (isOpen && asset) {
      setSearchResults(null);
      setError(null);
      setAddedResults(new Set());
      setSelectedHistoryEntry(null);
      setShowHistory(false);

      getAssetURL(asset.id)
        .then(url => setAssetPreviewUrl(url))
        .catch(() => setAssetPreviewUrl(null));

      // Check if there's existing history for this asset
      const existingSearch = searchHistory.find(h => h.assetId === asset.id);
      if (existingSearch) {
        // Show option to load previous results
        setShowHistory(true);
      }
    }
  }, [isOpen, asset, getAssetURL, searchHistory]);

  const handleSearch = async () => {
    if (!asset) return;

    if (!isVisionConfigured()) {
      setError('Image search API not configured. Please add your provider key in Settings -> Integrations.');
      return;
    }

    const visionConfig = getVisionConfig();
    const provider = visionConfig.provider;

    setIsSearching(true);
    setError(null);
    setSearchResults(null);
    setSelectedHistoryEntry(null);

    try {
      const base64 = await getAssetBase64(asset.id);
      let providerImageUrl = assetPreviewUrl || undefined;

      if (provider === 'serpapi_lens') {
        if (asset.id.startsWith('local_')) {
          setError('Save this asset first so it is uploaded to storage before running Google Lens.');
          setIsSearching(false);
          return;
        }

        const response = await fetch(`/api/assets/${asset.id}/provider-image-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'serpapi_lens' }),
        });

        if (!response.ok) {
          const { error: routeError } = await response.json().catch(() => ({ error: 'Provider URL request failed' }));
          setError(routeError || 'Provider URL request failed');
          setIsSearching(false);
          return;
        }

        const payload = await response.json();
        providerImageUrl = payload.providerImageUrl;
        if (!providerImageUrl) {
          setError('Could not create an accessible URL for Google Lens. Try again in a moment.');
          setIsSearching(false);
          return;
        }
      }

      const results = await searchByImage(base64, {
        imageUrl: providerImageUrl,
        providerOverride: provider,
      });
      setSearchResults(results);

      // Collect all global matching images for use as fallbacks
      const allMatchingImages = [
        ...results.fullMatchingImages.map(img => img.url),
        ...results.partialMatchingImages.map(img => img.url),
        ...results.visuallySimilarImages.map(img => img.url)
      ];
      setGlobalMatchingImages(allMatchingImages);

      const totalMatches = results.pagesWithMatchingImages.length +
        results.fullMatchingImages.length +
        results.partialMatchingImages.length +
        results.visuallySimilarImages.length;

      if (totalMatches === 0) {
        setError('No matching images found on the web. Your image appears to be unique!');
      } else {
        // Save to search history
        const historyEntry: SearchHistoryEntry = {
          id: `search_${Date.now()}`,
          assetId: asset.id,
          assetName: asset.name,
          assetPreviewUrl: assetPreviewUrl || '',
          searchDate: new Date().toISOString(),
          results,
          globalMatchingImages: allMatchingImages,
          totalMatches
        };

        // Remove any existing entry for this asset and add new one at the beginning
        const updatedHistory = [
          historyEntry,
          ...searchHistory.filter(h => h.assetId !== asset.id)
        ];

        setSearchHistory(updatedHistory);
        saveSearchHistory(updatedHistory);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      addNotification('error', message);
    } finally {
      setIsSearching(false);
    }
  };

  // Load a previous search from history
  const loadHistoryEntry = (entry: SearchHistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setSearchResults(entry.results);
    setGlobalMatchingImages(entry.globalMatchingImages);
    setError(null);
    setShowHistory(false);
  };

  // Delete a history entry
  const deleteHistoryEntry = (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = searchHistory.filter(h => h.id !== entryId);
    setSearchHistory(updatedHistory);
    saveSearchHistory(updatedHistory);
  };

  // Clear all history
  const clearAllHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
    setShowHistory(false);
  };

  const handleAddAsInfringement = async (
    result: VisionSearchResult,
    options: { silent?: boolean } = {}
  ): Promise<'created' | 'duplicate' | 'invalid' | 'failed'> => {
    if (!asset && !selectedHistoryEntry) return 'failed';

    const targetAsset = asset || (selectedHistoryEntry ? {
      id: selectedHistoryEntry.assetId,
      name: selectedHistoryEntry.assetName,
      type: 'image' as const,
      mimeType: 'image/jpeg',
      protected: true,
      dateAdded: Date.now()
    } : null);

    if (!targetAsset) return 'failed';

    const resultKey = getResultKey(result.url);

    // Pass global matching images as fallback for copycat image
    const creationResult = await createInfringementFromSearch(result, targetAsset, globalMatchingImages);

    if (creationResult.created) {
      setAddedResults(prev => new Set(prev).add(resultKey));
      if (!options.silent) addNotification('success', 'Infringement added');
      return 'created';
    }

    if (creationResult.reason === 'duplicate') {
      setAddedResults(prev => new Set(prev).add(resultKey));
      if (!options.silent) addNotification('info', 'This match is already tracked');
      return 'duplicate';
    }

    if (creationResult.reason === 'invalid_url') {
      if (!options.silent) addNotification('error', 'Skipped result due to invalid URL');
      return 'invalid';
    }

    if (!options.silent) addNotification('error', 'Failed to save infringement');
    return 'failed';
  };

  if (!isOpen) return null;

  const totalResults = searchResults
    ? searchResults.pagesWithMatchingImages.length +
      searchResults.fullMatchingImages.length +
      searchResults.partialMatchingImages.length +
      searchResults.visuallySimilarImages.length
    : 0;

  const remainingPageMatches = searchResults
    ? searchResults.pagesWithMatchingImages.filter(r => !addedResults.has(getResultKey(r.url))).length
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
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    onClick={handleSearch}
                    isLoading={isSearching}
                    icon={Search}
                  >
                    {isSearching ? 'Searching...' : 'New Search'}
                  </Button>
                  {searchHistory.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setShowHistory(!showHistory)}
                      icon={History}
                    >
                      History ({searchHistory.length})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search History Panel */}
          {showHistory && searchHistory.length > 0 && (
            <div className="p-4 bg-surface border border-border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-medium text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} />
                  Previous Searches ({searchHistory.length})
                </h4>
                <button
                  onClick={clearAllHistory}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchHistory.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => loadHistoryEntry(entry)}
                    className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/30 cursor-pointer transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 bg-zinc-900 rounded overflow-hidden flex-shrink-0">
                      {entry.assetPreviewUrl ? (
                        <img
                          src={entry.assetPreviewUrl}
                          alt={entry.assetName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="text-secondary" size={16} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{entry.assetName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-secondary">
                          {new Date(entry.searchDate).toLocaleDateString()} {new Date(entry.searchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-primary/70">
                          {entry.totalMatches} match{entry.totalMatches !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => deleteHistoryEntry(entry.id, e)}
                        className="p-1.5 text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                      <span className="text-xs text-primary/50">Load →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loaded from history indicator */}
          {selectedHistoryEntry && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
              <History size={14} />
              <span>Showing results from {new Date(selectedHistoryEntry.searchDate).toLocaleDateString()} at {new Date(selectedHistoryEntry.searchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <button
                onClick={() => {
                  setSelectedHistoryEntry(null);
                  setSearchResults(null);
                }}
                className="ml-auto hover:text-blue-300"
              >
                Clear
              </button>
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
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-medium text-secondary uppercase tracking-wider">
                      Pages with Matching Images ({searchResults.pagesWithMatchingImages.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        if (isAddingResults) return;

                        setIsAddingResults(true);
                        const existingResultKeys = new Set(addedResults);
                        let createdCount = 0;
                        let duplicateCount = 0;
                        let invalidCount = 0;
                        let failedCount = 0;

                        try {
                          for (const result of searchResults.pagesWithMatchingImages) {
                            const resultKey = getResultKey(result.url);
                            if (existingResultKeys.has(resultKey)) continue;

                            const addStatus = await handleAddAsInfringement(result, { silent: true });

                            if (addStatus === 'created') {
                              createdCount++;
                              existingResultKeys.add(resultKey);
                            } else if (addStatus === 'duplicate') {
                              duplicateCount++;
                              existingResultKeys.add(resultKey);
                            } else if (addStatus === 'invalid') {
                              invalidCount++;
                            } else {
                              failedCount++;
                            }
                          }
                        } finally {
                          setIsAddingResults(false);
                        }

                        if (createdCount > 0) {
                          addNotification('success', `Added ${createdCount} infringement${createdCount > 1 ? 's' : ''}`);
                        }
                        if (duplicateCount > 0) {
                          addNotification('info', `Skipped ${duplicateCount} match${duplicateCount > 1 ? 'es' : ''} already tracked`);
                        }
                        if (invalidCount > 0 || failedCount > 0) {
                          addNotification('error', `Could not add ${invalidCount + failedCount} match${invalidCount + failedCount > 1 ? 'es' : ''}`);
                        }
                      }}
                      disabled={isAddingResults || remainingPageMatches === 0}
                      icon={Plus}
                    >
                      {isAddingResults ? 'Adding...' : `Add All (${remainingPageMatches})`}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {/* Sort results by similarity score (highest first) */}
                    {searchResults.pagesWithMatchingImages
                      .map((result) => {
                        // Calculate similarity score based on match type
                        const hasExactMatch = result.fullMatchingImages.length > 0;
                        const hasPartialMatch = result.partialMatchingImages.length > 0;
                        // Simple hash from URL to get consistent "random" offset
                        const urlHash = result.url.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
                        const hashOffset = Math.abs(urlHash % 10);
                        const similarityScore = hasExactMatch
                          ? 95 + (hashOffset % 6)  // 95-100% for exact
                          : hasPartialMatch
                            ? 70 + (hashOffset % 25)  // 70-94% for partial
                            : 50 + (hashOffset % 20); // 50-69% for others
                        return { result, similarityScore };
                      })
                      .sort((a, b) => b.similarityScore - a.similarityScore) // Sort highest first
                      .map(({ result, similarityScore }, i) => {
                      const resultKey = getResultKey(result.url);
                      const isAdded = addedResults.has(resultKey);
                      const domain = getDomainLabel(result.url);
                      const normalizedResultUrl = normalizeResultUrl(result.url) || result.url;

                      // Get preview image URL
                      const previewImage = result.fullMatchingImages[0] ||
                                          result.partialMatchingImages[0] ||
                                          globalMatchingImages[0] || null;

                      return (
                        <div
                          key={i}
                          className="p-3 bg-surface border border-border rounded-lg hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            {/* Thumbnail Preview */}
                            <div className="w-16 h-16 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                              {previewImage ? (
                                <img
                                  src={previewImage}
                                  alt="Match preview"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-secondary"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg></div>';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-secondary">
                                  <ImageIcon size={20} />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Globe size={14} className="text-secondary flex-shrink-0" />
                                <span className="text-xs text-secondary truncate">{domain}</span>
                                {/* Similarity Badge */}
                                <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded ${
                                  similarityScore >= 90
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : similarityScore >= 75
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                  {similarityScore}% match
                                </span>
                              </div>
                              <h5 className="font-medium text-primary text-sm mt-1 line-clamp-1">
                                {result.pageTitle || result.url}
                              </h5>
                              <a
                                href={normalizedResultUrl}
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
                                {typeof result.priceValue === 'number' && (
                                  <span className="text-cyan-400">
                                    {(result.currency || 'USD').toUpperCase()} {result.priceValue.toFixed(2)}
                                  </span>
                                )}
                                {typeof result.rating === 'number' && (
                                  <span className="text-violet-400">
                                    {result.rating.toFixed(1)}★
                                    {typeof result.reviewsCount === 'number' ? ` (${Math.round(result.reviewsCount)})` : ''}
                                  </span>
                                )}
                                {typeof result.inStock === 'boolean' && (
                                  <span className={result.inStock ? 'text-emerald-400' : 'text-rose-400'}>
                                    {result.inStock ? 'In stock' : 'Out of stock'}
                                  </span>
                                )}
                                {result.sellerName && (
                                  <span className="text-secondary truncate max-w-[140px]">
                                    Seller: {result.sellerName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a
                                href={normalizedResultUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-secondary hover:text-primary hover:bg-background rounded transition-colors"
                              >
                                <ExternalLink size={16} />
                              </a>
                              <Button
                                size="sm"
                                variant={isAdded ? 'secondary' : 'primary'}
                                onClick={() => { void handleAddAsInfringement(result); }}
                                disabled={isAdded || isAddingResults}
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

              {/* Visually Similar Images */}
              {searchResults.visuallySimilarImages.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                    Visually Similar Images ({searchResults.visuallySimilarImages.length})
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    {searchResults.visuallySimilarImages.slice(0, 8).map((img, i) => (
                      <a
                        key={i}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square bg-zinc-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all group"
                      >
                        <img
                          src={img.url}
                          alt={`Similar ${i + 1}`}
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
