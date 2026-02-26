import React, { useState, useEffect } from 'react';
import { InfringementItem } from '../types';
import {
  Flag, CheckCircle, ExternalLink, MoreVertical,
  Clock, AlertCircle, XCircle, ShieldCheck, ImageOff, MessageSquare, Bell
} from 'lucide-react';
import PlatformIcon from './ui/PlatformIcon';
import { useDashboard } from '../context/DashboardContext';
import { canTransitionCaseStatus, needsMemberInput } from '../lib/case-status';
import { formatRevenueDisplay, getEffectivePriority } from '../lib/priority';

interface InfringementCardProps {
  item: InfringementItem;
  onDismiss: (e: React.MouseEvent) => void;
  onReport: (e: React.MouseEvent) => void;
  isSelected?: boolean;
}

const InfringementCard: React.FC<InfringementCardProps> = ({ item, onDismiss, onReport, isSelected }) => {
  const [isDismissOpen, setIsDismissOpen] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>(item.originalImage);
  const [imageLoadError, setImageLoadError] = useState<{ original: boolean; copycat: boolean }>({ original: false, copycat: false });
  const { getAssetURL, getUnreadUpdateCount } = useDashboard();
  const canDismiss = canTransitionCaseStatus(item.status, 'dismissed_by_member');

  const unreadCount = getUnreadUpdateCount(item.id);
  const priority = getEffectivePriority(item);
  const revenueDisplay = formatRevenueDisplay(item);
  const showNeedsInput = needsMemberInput(item.status);

  useEffect(() => {
    if (!item.originalImage && item.originalAssetId) {
      getAssetURL(item.originalAssetId)
        .then(url => setOriginalImageUrl(url))
        .catch(() => setImageLoadError(prev => ({ ...prev, original: true })));
    } else {
      setOriginalImageUrl(item.originalImage);
    }
  }, [item.originalImage, item.originalAssetId, getAssetURL]);

  return (
    <div className={`bg-surface border border-border rounded-xl shadow-sm flex flex-col h-full hover:border-secondary/50 transition-colors group ${isSelected ? 'border-primary ring-2 ring-primary/20' : ''}`}>
      {/* Image comparison — compact */}
      <div className="flex gap-px overflow-hidden rounded-t-xl">
        <div className="flex-1 aspect-[4/3] bg-zinc-900 relative overflow-hidden">
          {originalImageUrl && !imageLoadError.original ? (
            <img
              src={originalImageUrl}
              alt="Original"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              onError={() => setImageLoadError(prev => ({ ...prev, original: true }))}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary">
              <ImageOff size={20} />
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 text-[9px] font-medium uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
            Original
          </span>
        </div>
        <div className="flex-1 aspect-[4/3] bg-zinc-900 relative overflow-hidden">
          {item.copycatImage && !imageLoadError.copycat ? (
            <img
              src={item.copycatImage}
              alt="Copycat"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              onError={() => setImageLoadError(prev => ({ ...prev, copycat: true }))}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary">
              <ImageOff size={20} />
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 text-[9px] font-medium uppercase tracking-wider bg-red-500/80 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
            Infringing
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                priority === 'high' ? 'bg-red-500' :
                priority === 'medium' ? 'bg-orange-400' : 'bg-yellow-400'
              }`} />
              <h3 className="font-medium text-sm text-primary truncate">{item.brandName}</h3>
              {item.isTrademarked && (
                <span className="text-[9px] font-mono bg-background border border-border text-secondary px-1 py-0.5 rounded shrink-0">TM</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <PlatformIcon platform={item.platform} size={12} className="text-secondary shrink-0" />
              <span className="text-xs text-secondary truncate">{item.platform}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {showNeedsInput && (
              <div className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <Bell size={12} />
              </div>
            )}
            {unreadCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-500">
                <MessageSquare size={10} />
                <span className="text-[10px] font-bold">{unreadCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-secondary">Match </span>
            <span className={`font-mono font-medium ${item.similarityScore >= 90 ? 'text-red-500' : 'text-primary'}`}>
              {item.similarityScore}%
            </span>
          </div>
          <div>
            <span className="text-secondary">Visitors </span>
            <span className="font-mono font-medium text-primary">{item.siteVisitors.toLocaleString()}</span>
          </div>
          <div className="ml-auto">
            <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded border ${
              revenueDisplay.severity === 'high' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
              revenueDisplay.severity === 'medium' ? 'text-orange-500 bg-orange-500/10 border-orange-500/20' :
              'text-yellow-600 bg-yellow-500/10 border-yellow-500/20'
            }`}>
              {revenueDisplay.text}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="flex gap-2 mt-auto pt-2 border-t border-border">
          <button
            onClick={onReport}
            disabled={item.status !== 'detected'}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all
              ${item.status === 'pending_review'
                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 cursor-not-allowed'
                : item.status === 'needs_member_input'
                ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20 cursor-not-allowed'
                : item.status === 'in_progress'
                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20 cursor-not-allowed'
                : item.status === 'resolved_success'
                ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-not-allowed'
                : item.status === 'resolved_partial'
                ? 'bg-lime-500/10 text-lime-600 border border-lime-500/20 cursor-not-allowed'
                : item.status === 'resolved_failed'
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed'
                : item.status === 'dismissed_by_member' || item.status === 'dismissed_by_admin'
                ? 'bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-not-allowed'
                : 'bg-primary text-inverse hover:opacity-90'}`}
          >
            {item.status === 'pending_review' && <><Clock size={12} /> Awaiting Review</>}
            {item.status === 'needs_member_input' && <><Bell size={12} /> Needs Input</>}
            {item.status === 'in_progress' && <><AlertCircle size={12} /> Enforcing</>}
            {item.status === 'resolved_success' && <><ShieldCheck size={12} /> Successful</>}
            {item.status === 'resolved_partial' && <><CheckCircle size={12} /> Partial</>}
            {item.status === 'resolved_failed' && <><XCircle size={12} /> Failed</>}
            {(item.status === 'dismissed_by_member' || item.status === 'dismissed_by_admin') && <><XCircle size={12} /> Dismissed</>}
            {item.status === 'detected' && <><Flag size={12} /> Enforce</>}
          </button>

          {canDismiss && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsDismissOpen(!isDismissOpen); }}
                className="h-full px-2.5 border border-border rounded-lg bg-background text-secondary hover:text-primary hover:border-secondary/50 transition-colors"
              >
                <MoreVertical size={14} />
              </button>

              {isDismissOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-28 bg-background border border-border shadow-xl py-1 z-20 rounded-lg animate-in zoom-in-95">
                  <button
                    onClick={onDismiss}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-surface transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsDismissOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfringementCard;
