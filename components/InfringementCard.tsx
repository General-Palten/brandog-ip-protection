import React, { useState, useEffect } from 'react';
import { InfringementItem } from '../types';
import {
  GitCommit, Users, Monitor, DollarSign,
  ChevronDown, Flag, CheckCircle, ExternalLink, MoreVertical,
  Clock, AlertCircle, XCircle, ShieldCheck, ImageOff, MessageSquare
} from 'lucide-react';
import PlatformIcon from './ui/PlatformIcon';
import BentoCard from './ui/BentoCard';
import { useDashboard } from '../context/DashboardContext';

interface InfringementCardProps {
  item: InfringementItem;
  onDismiss: (e: React.MouseEvent) => void;
  onReport: (e: React.MouseEvent) => void;
}

const InfringementCard: React.FC<InfringementCardProps> = ({ item, onDismiss, onReport }) => {
  const [isDismissOpen, setIsDismissOpen] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>(item.originalImage);
  const [imageLoadError, setImageLoadError] = useState<{ original: boolean; copycat: boolean }>({ original: false, copycat: false });
  const { getAssetURL, getUnreadUpdateCount } = useDashboard();

  // Get unread message count for this case
  const unreadCount = getUnreadUpdateCount(item.id);

  // Load original image from IndexedDB if originalAssetId is present and originalImage is empty
  useEffect(() => {
    if (!item.originalImage && item.originalAssetId) {
      getAssetURL(item.originalAssetId)
        .then(url => setOriginalImageUrl(url))
        .catch(err => {
          console.error('Failed to load original asset:', err);
          setImageLoadError(prev => ({ ...prev, original: true }));
        });
    } else {
      setOriginalImageUrl(item.originalImage);
    }
  }, [item.originalImage, item.originalAssetId, getAssetURL]);

  return (
    <BentoCard className="h-full hover:border-primary/50 transition-colors duration-300 group">
      <div className="flex flex-col h-full gap-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="font-semibold text-lg text-primary truncate tracking-tight">{item.brandName}</h3>
            {item.isTrademarked && (
              <span className="text-[10px] font-mono bg-background border border-border text-secondary px-1.5 py-0.5 rounded-none shrink-0">TM</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Unread messages indicator */}
            {unreadCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-500">
                <MessageSquare size={12} />
                <span className="text-[10px] font-bold">{unreadCount}</span>
              </div>
            )}
            <div className="px-2 py-1 rounded border border-border bg-primary/5 text-[10px] font-mono text-secondary">
               #ID-{item.id}
            </div>
          </div>
        </div>

        {/* Comparison Images */}
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-secondary mb-2 uppercase tracking-wider font-medium">Original</p>
            <div className="aspect-square bg-background border border-border overflow-hidden relative rounded-none">
              {originalImageUrl && !imageLoadError.original ? (
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="w-full h-full object-cover"
                  onError={() => setImageLoadError(prev => ({ ...prev, original: true }))}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-secondary gap-2">
                  <ImageOff size={24} />
                  <span className="text-[10px]">No image</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-red-500 mb-2 uppercase tracking-wider font-medium">Infringement</p>
            <div className="aspect-square bg-background border border-red-500/30 overflow-hidden relative rounded-none">
               {item.platform === 'TikTok Shop' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
                          <div className="ml-0.5 w-0 h-0 border-t-4 border-t-transparent border-l-[8px] border-l-black border-b-4 border-b-transparent"></div>
                      </div>
                  </div>
               )}
              {item.copycatImage && !imageLoadError.copycat ? (
                <img
                  src={item.copycatImage}
                  alt="Copycat"
                  className="w-full h-full object-cover grayscale-[20%] contrast-125"
                  onError={() => setImageLoadError(prev => ({ ...prev, copycat: true }))}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2">
                  <ImageOff size={24} />
                  <span className="text-[10px]">No image</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid - Brutalist Style */}
        <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-border border-dashed">
            {/* Match Score */}
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Match</span>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.similarityScore >= 90 ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                    <span className="font-mono text-xl font-medium text-primary">{item.similarityScore}%</span>
                </div>
            </div>

             {/* Traffic */}
             <div className="flex flex-col gap-1">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Visitors</span>
                <span className="font-mono text-xl font-medium text-primary">{item.siteVisitors.toLocaleString().replace(/,/g, ' ')}</span>
            </div>

            {/* Platform */}
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Source</span>
                <div className="flex items-center gap-2">
                    <PlatformIcon platform={item.platform} size={14} className="text-secondary" />
                    <span className="text-sm font-medium text-primary truncate">{item.platform}</span>
                </div>
            </div>

            {/* Risk */}
             <div className="flex flex-col gap-1">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Risk</span>
                <span className="font-mono text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 w-fit rounded-none">
                  ${item.revenueLost.toLocaleString()}
                </span>
            </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-auto">
          <button
            onClick={onReport}
            disabled={item.status !== 'detected'}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-none text-sm font-medium transition-all
              ${item.status === 'pending_review'
                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 cursor-not-allowed'
                : item.status === 'in_progress'
                ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20 cursor-not-allowed'
                : item.status === 'resolved'
                ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-not-allowed'
                : item.status === 'rejected'
                ? 'bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-not-allowed'
                : 'bg-primary text-inverse hover:opacity-90 shadow-sm'}`}
          >
            {item.status === 'pending_review' && <><Clock size={14} /> Pending Review</>}
            {item.status === 'in_progress' && <><AlertCircle size={14} /> In Progress</>}
            {item.status === 'resolved' && <><ShieldCheck size={14} /> Resolved</>}
            {item.status === 'rejected' && <><XCircle size={14} /> Rejected</>}
            {item.status === 'detected' && <><Flag size={14} /> Request Takedown</>}
          </button>

          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDismissOpen(!isDismissOpen); }}
              className="h-full px-3 border border-border rounded-none bg-surface text-secondary hover:text-primary hover:border-secondary transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            
            {isDismissOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-32 bg-background border border-border shadow-xl py-1 z-20 rounded-none animate-in zoom-in-95">
                <button 
                  onClick={onDismiss}
                  className="w-full text-left px-4 py-2 text-xs font-mono uppercase text-red-500 hover:bg-surface transition-colors"
                >
                  Dismiss
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsDismissOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-mono uppercase text-secondary hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </BentoCard>
  );
};

export default InfringementCard;