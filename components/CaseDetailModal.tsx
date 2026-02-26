import React, { useState, useEffect } from 'react';
import { InfringementItem, CaseUpdate, InfringementPriority } from '../types';
import { CASE_UPDATE_TYPES } from '../constants';
import Modal from './ui/Modal';
import Button from './ui/Button';
import PlatformIcon from './ui/PlatformIcon';
import StatusBadge from './ui/StatusBadge';
import ImageCarousel from './ui/ImageCarousel';
import TrademarkMatchPanel from './TrademarkMatchPanel';
import { useDashboard } from '../context/DashboardContext';
import { needsMemberInput, canRetry, isDetectionStatus } from '../lib/case-status';
import { getCountryName } from './WorldMap';
import { getEffectivePriority, formatRevenueDisplay } from '../lib/priority';
import {
  ExternalLink, Copy, Camera, FileText,
  ShieldAlert, CheckCircle, XCircle, Send, Server, ImageOff,
  Shield, Clock, MessageSquare, User, Zap, Bell, RefreshCw, AlertTriangle
} from 'lucide-react';

interface CaseDetailModalProps {
  item: InfringementItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  item, isOpen, onClose, onConfirm, onDismiss
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'takedown' | 'progress'>('overview');
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [imageLoadError, setImageLoadError] = useState<{ original: boolean; copycat: boolean }>({ original: false, copycat: false });
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const {
    getAssetURL,
    markUpdatesAsRead,
    takedownRequests,
    addCaseUpdate,
    respondToAdminRequest,
    withdrawRequest,
    requestRetry,
    setInfringementPriority
  } = useDashboard();

  // Handle sending message to lawyer
  const handleSendMessage = () => {
    if (!messageText.trim() || !item) return;

    setIsSending(true);
    // Simulate a small delay for UX
    setTimeout(() => {
      addCaseUpdate(item.id, 'custom', messageText.trim(), 'brand_owner');
      setMessageText('');
      setIsSending(false);
    }, 300);
  };

  // Get takedown request and updates for this case - derived from takedownRequests for reactivity
  const takedownRequest = item ? takedownRequests.find(req => req.caseId === item.id) : undefined;
  const caseUpdates = takedownRequest?.updates || [];
  const unreadCount = caseUpdates.filter(u => !u.isRead).length;

  // Mark updates as read when viewing progress tab
  useEffect(() => {
    if (activeTab === 'progress' && item && unreadCount > 0) {
      markUpdatesAsRead(item.id);
    }
  }, [activeTab, item, unreadCount, markUpdatesAsRead]);

  // Load original image from IndexedDB if originalAssetId is present
  useEffect(() => {
    if (!item) {
      setOriginalImageUrl('');
      return;
    }

    setImageLoadError({ original: false, copycat: false });

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
  }, [item, getAssetURL]);

  if (!item) return null;

  // Derived state for the new workflow
  const showNeedsInput = needsMemberInput(item.status);
  const showRetryButton = canRetry(item.status);
  const showRequestButton = isDetectionStatus(item.status);
  const priority = getEffectivePriority(item);
  const revenueDisplay = formatRevenueDisplay(item);

  // Handle respond to admin request
  const handleRespondToAdmin = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    await respondToAdminRequest(item.id, messageText.trim());
    setMessageText('');
    setIsSending(false);
    onClose();
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    await withdrawRequest(item.id);
    onClose();
  };

  // Handle retry
  const handleRetry = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    await requestRetry(item.id, messageText.trim());
    setMessageText('');
    setIsSending(false);
    onClose();
  };

  // Handle priority change
  const handlePriorityChange = async (newPriority: InfringementPriority) => {
    await setInfringementPriority(item.id, newPriority);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Case #${item.id} - ${item.sellerName}`}
      size="4xl"
    >
      <div className="flex flex-col max-h-[calc(85vh-100px)]">
        {/* Case Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface/30">
          <div className="flex items-center gap-4">
            {/* Priority indicator */}
            <div className={`w-3 h-3 rounded-full ${
              priority === 'high' ? 'bg-red-500' :
              priority === 'medium' ? 'bg-orange-400' : 'bg-yellow-400'
            }`} title={`${priority} priority`} />
            <PlatformIcon platform={item.platform} size={20} showLabel className="text-primary font-medium" />
            <div className="h-4 w-px bg-border"></div>
            <StatusBadge status={item.status} />
            {item.autoTakedown && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded text-xs font-medium">
                <Zap size={12} />
                Auto-Takedown
              </span>
            )}
            <span className="text-xs text-secondary font-mono">Detected: {item.detectedAt}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Priority selector (only in Detections/Pending) */}
            {(isDetectionStatus(item.status) || item.status === 'pending_review' || showNeedsInput) && (
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as InfringementPriority)}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-primary focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            )}
            <a
              href={item.infringingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs flex items-center gap-1 text-primary hover:underline"
            >
              Visit Listing <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Needs Input Banner */}
        {showNeedsInput && (
          <div className="px-6 py-3 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-3">
            <Bell className="text-orange-500" size={18} />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Action Required</p>
              <p className="text-xs text-orange-600 dark:text-orange-400/80">Admin has requested more information. Please respond below.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {[
            { id: 'overview', label: 'Analysis & Compare' },
            { id: 'evidence', label: 'Evidence Pack' },
            { id: 'takedown', label: 'Takedown Actions' },
            { id: 'progress', label: 'Case Progress', badge: unreadCount }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[18px] text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Image Comparison - Enhanced with Carousel when multiple images */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Original Asset</span>
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded border border-green-500/20">Protected</span>
                  </div>
                  <div className="h-48 bg-surface border border-border rounded-lg overflow-hidden relative group">
                    {originalImageUrl && !imageLoadError.original ? (
                      <>
                        <img
                          src={originalImageUrl}
                          alt="Original"
                          className="w-full h-full object-contain"
                          onError={() => setImageLoadError(prev => ({ ...prev, original: true }))}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-secondary gap-2">
                        <ImageOff size={32} />
                        <span className="text-xs">No image available</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Infringing Listing</span>
                    <span className="text-xs font-mono text-red-500">{item.similarityScore}% Match</span>
                  </div>
                  {/* Use ImageCarousel if multiple images available */}
                  {item.images && item.images.length > 1 ? (
                    <ImageCarousel
                      images={item.images}
                      alt="Infringement"
                      className="h-48"
                    />
                  ) : (
                    <div className="h-48 bg-surface border-2 border-red-500/30 rounded-lg overflow-hidden relative group">
                      {item.copycatImage && !imageLoadError.copycat ? (
                        <>
                          <img
                            src={item.copycatImage}
                            alt="Infringement"
                            className="w-full h-full object-contain"
                            onError={() => setImageLoadError(prev => ({ ...prev, copycat: true }))}
                          />
                          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md text-white p-2 rounded text-xs">
                            AI identified {item.similarityScore}% similarity match.
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-red-400 gap-2">
                          <ImageOff size={32} />
                          <span className="text-xs">No image available</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Trademark Match Panel - Show if matches exist */}
              {item.trademarkMatches && item.trademarkMatches.length > 0 && (
                <TrademarkMatchPanel matches={item.trademarkMatches} />
              )}

              {/* AI Analysis Text - Show if available */}
              {item.analysisText && (
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded shrink-0">
                      <Shield className="text-blue-500" size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-primary mb-1">AI Analysis</h4>
                      <p className="text-xs text-secondary leading-relaxed">{item.analysisText}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Infringing URL */}
              {item.infringingUrl && (
                <div className="p-3 bg-surface border border-border rounded-lg">
                  <label className="block text-xs text-secondary mb-1">Infringing URL</label>
                  <div className="flex items-center gap-2">
                    <a
                      href={item.infringingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-primary hover:underline truncate flex-1"
                    >
                      {item.infringingUrl}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.infringingUrl || '');
                      }}
                      className="p-1.5 text-secondary hover:text-primary hover:bg-background rounded transition-colors shrink-0"
                      title="Copy URL"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={item.infringingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-secondary hover:text-primary hover:bg-background rounded transition-colors shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}

              {/* Data Grid */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-surface border border-border rounded-lg">
                <div>
                   <label className="block text-xs text-secondary mb-1">Estimated Revenue Loss</label>
                   <p className="font-mono text-lg text-primary">${item.revenueLost.toLocaleString()}</p>
                </div>
                <div>
                   <label className="block text-xs text-secondary mb-1">Traffic / Mo</label>
                   <p className="font-mono text-lg text-primary">{item.siteVisitors.toLocaleString()}</p>
                </div>
                <div>
                   <label className="block text-xs text-secondary mb-1">Seller Location</label>
                   <p className="font-mono text-lg text-primary">{getCountryName(item.country)}</p>
                </div>
              </div>

              {/* WHOIS / Technical */}
              <div className="space-y-3">
                 <h4 className="text-sm font-medium flex items-center gap-2">
                    <Server size={14} /> Technical Fingerprint
                 </h4>
                 <div className="bg-zinc-950 text-zinc-400 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-border">
                    <div className="grid grid-cols-[120px_1fr] gap-y-2">
                        <span>Registrar:</span> <span className="text-zinc-200">{item.whois?.registrar || 'Unknown'}</span>
                        <span>Creation Date:</span> <span className="text-zinc-200">{item.whois?.creationDate}</span>
                        <span>Hosting:</span> <span className="text-zinc-200">{item.hosting?.provider}</span>
                        <span>IP Address:</span> <span className="text-zinc-200">{item.hosting?.ipAddress}</span>
                        <span>DNS Status:</span> <span className="text-green-500">Active / Resolving</span>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* EVIDENCE TAB */}
          {activeTab === 'evidence' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 border border-border rounded-lg bg-surface/30 hover:bg-surface transition-colors cursor-pointer group">
                    <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-background border border-border rounded">
                           <Camera size={20} className="text-primary" />
                        </div>
                        <span className="text-[10px] text-secondary font-mono">{item.detectedAt}</span>
                    </div>
                    <p className="font-medium text-sm">Full Page Screenshot</p>
                    <p className="text-xs text-secondary mt-1">Automated capture of product page.</p>
                    <div className="mt-3 flex gap-2">
                        <button className="text-xs bg-background border border-border px-2 py-1 rounded hover:text-primary transition-colors">View</button>
                        <button className="text-xs bg-background border border-border px-2 py-1 rounded hover:text-primary transition-colors">Download</button>
                    </div>
                 </div>

                 <div className="p-4 border border-border rounded-lg bg-surface/30 hover:bg-surface transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-background border border-border rounded">
                           <FileText size={20} className="text-primary" />
                        </div>
                         <span className="text-[10px] text-secondary font-mono">{item.detectedAt}</span>
                    </div>
                    <p className="font-medium text-sm">Source Code Dump</p>
                    <p className="text-xs text-secondary mt-1">HTML/DOM snapshot for verification.</p>
                    <div className="mt-3 flex gap-2">
                        <button className="text-xs bg-background border border-border px-2 py-1 rounded hover:text-primary transition-colors">Download HTML</button>
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                 <div className="flex gap-3">
                    <ShieldAlert className="text-amber-600 shrink-0" size={20} />
                    <div>
                       <h4 className="text-sm font-medium text-amber-800 dark:text-amber-500">Chain of Custody</h4>
                       <p className="text-xs text-amber-700/80 dark:text-amber-500/70 mt-1">
                          This evidence was automatically collected and hash-stamped by Brandog's secure crawler. 
                          <br/>Evidence Hash: <span className="font-mono">8f2a...9d12</span>
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* TAKEDOWN TAB */}
          {activeTab === 'takedown' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Takedown Process Explanation */}
              <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg shrink-0">
                    <Shield className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h4 className="font-medium text-primary mb-3">How Our Takedown Process Works</h4>
                    <ul className="space-y-2 text-sm text-secondary">
                      <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>We will issue a formal takedown request on your behalf</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>Our legal team will communicate directly with the platform through their official DMCA and privacy channels</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>You will receive updates throughout the process in the Case Progress tab</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Latest Update Summary (if takedown requested) */}
              {takedownRequest && caseUpdates.length > 0 && (
                <div className="p-4 bg-surface border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare size={14} className="text-primary" />
                      Latest Update
                    </h4>
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="text-xs text-primary hover:underline"
                    >
                      View all updates ({caseUpdates.length})
                    </button>
                  </div>
                  {(() => {
                    const latestUpdate = caseUpdates[caseUpdates.length - 1];
                    const config = CASE_UPDATE_TYPES.find(c => c.type === latestUpdate.type);
                    return (
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded ${config?.isPositive ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                          {config?.isPositive ? <CheckCircle size={16} /> : <Clock size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-primary">{config?.label || 'Update'}</p>
                          <p className="text-xs text-secondary mt-1">{latestUpdate.message}</p>
                          <p className="text-xs text-secondary/60 mt-2 font-mono">
                            {new Date(latestUpdate.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Action Buttons - Dynamic based on status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* For Detected status: Request Enforcement */}
                {showRequestButton && (
                  <>
                    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Take Action</h4>
                      <p className="text-xs text-secondary">
                        Submit this case for enforcement processing by our team.
                      </p>
                      <Button
                        variant="primary"
                        className="w-full justify-center"
                        icon={Send}
                        onClick={() => {
                          onConfirm(item.id);
                          onClose();
                        }}
                      >
                        Request Enforcement
                      </Button>
                    </div>

                    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Alternative Actions</h4>
                      <p className="text-xs text-secondary">
                        If this detection is incorrect, you can dismiss it.
                      </p>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-red-500 hover:bg-red-500/10 hover:text-red-600"
                        icon={XCircle}
                        onClick={() => {
                          onDismiss(item.id);
                          onClose();
                        }}
                      >
                        Dismiss Case
                      </Button>
                    </div>
                  </>
                )}

                {/* For Needs Member Input status: Respond or Withdraw */}
                {showNeedsInput && (
                  <>
                    <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-lg space-y-3 md:col-span-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Bell className="text-orange-500" size={16} />
                        Admin Requested More Information
                      </h4>
                      <p className="text-xs text-secondary">
                        Please provide additional information or context to help us process your case.
                      </p>
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Provide additional context, evidence references, or answers to admin's questions..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          icon={Send}
                          onClick={handleRespondToAdmin}
                          disabled={!messageText.trim() || isSending}
                        >
                          {isSending ? 'Sending...' : 'Submit Response'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-500 hover:bg-red-500/10"
                          icon={XCircle}
                          onClick={handleWithdraw}
                        >
                          Withdraw Request
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* For Failed status: Retry option */}
                {showRetryButton && (
                  <>
                    <div className="p-4 bg-red-500/5 border border-red-500/30 rounded-lg space-y-3 md:col-span-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={16} />
                        Takedown Failed
                      </h4>
                      <p className="text-xs text-secondary">
                        The takedown attempt was unsuccessful. You can request a retry with additional information.
                      </p>
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Explain why a retry might succeed (new evidence, different approach, etc.)..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 resize-none"
                        rows={3}
                      />
                      <Button
                        variant="primary"
                        icon={RefreshCw}
                        onClick={handleRetry}
                        disabled={!messageText.trim() || isSending}
                      >
                        {isSending ? 'Requesting...' : 'Request Retry'}
                      </Button>
                      {item.retryCount && item.retryCount > 0 && (
                        <p className="text-xs text-secondary">
                          This case has been retried {item.retryCount} time{item.retryCount > 1 ? 's' : ''}.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* For Pending/In Progress: Show status */}
                {(item.status === 'pending_review' || item.status === 'in_progress') && (
                  <>
                    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Case Status</h4>
                      <p className="text-xs text-secondary">
                        {item.status === 'pending_review'
                          ? 'Your request is awaiting review by our team.'
                          : 'Our team is actively working on this case.'}
                      </p>
                      <StatusBadge status={item.status} size="md" />
                    </div>

                    {item.status === 'pending_review' && (
                      <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                        <h4 className="font-medium text-sm">Change Your Mind?</h4>
                        <p className="text-xs text-secondary">
                          You can withdraw your request before it's processed.
                        </p>
                        <Button
                          variant="ghost"
                          className="text-red-500 hover:bg-red-500/10"
                          icon={XCircle}
                          onClick={handleWithdraw}
                        >
                          Withdraw Request
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* For Success/Partial: Show results */}
                {(item.status === 'resolved_success' || item.status === 'resolved_partial') && (
                  <div className="p-4 bg-green-500/5 border border-green-500/30 rounded-lg space-y-3 md:col-span-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle className="text-green-500" size={16} />
                      {item.status === 'resolved_success' ? 'Takedown Successful' : 'Partial Success'}
                    </h4>
                    <p className="text-xs text-secondary">
                      {item.status === 'resolved_success'
                        ? 'The infringing content has been successfully removed.'
                        : 'Some of the infringing content was removed. Check case progress for details.'}
                    </p>
                    <StatusBadge status={item.status} size="md" />
                  </div>
                )}

                {/* For Dismissed: Show status */}
                {(item.status === 'dismissed_by_member' || item.status === 'dismissed_by_admin') && (
                  <div className="p-4 bg-surface border border-border rounded-lg space-y-3 md:col-span-2">
                    <h4 className="font-medium text-sm">Case Dismissed</h4>
                    <p className="text-xs text-secondary">
                      {item.status === 'dismissed_by_member'
                        ? 'You dismissed this case.'
                        : 'This case was dismissed by admin.'}
                      {item.dismissReason && (
                        <span className="block mt-1">
                          Reason: {item.dismissReason === 'licensed_authorized' ? 'Licensed/Authorized'
                            : item.dismissReason === 'not_our_product' ? 'Not our product'
                            : item.dismissReason === 'insufficient_evidence' ? 'Insufficient evidence'
                            : item.dismissReasonText || 'Other'}
                        </span>
                      )}
                    </p>
                    <StatusBadge status={item.status} size="md" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CASE PROGRESS TAB */}
          {activeTab === 'progress' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-primary flex items-center gap-2">
                  <Clock size={18} />
                  Case Updates
                </h3>
                {takedownRequest && (
                  <span className="text-xs text-secondary font-mono">
                    {caseUpdates.length} update{caseUpdates.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Timeline of Updates */}
              {!takedownRequest ? (
                <div className="py-12 text-center border border-dashed border-border rounded-lg">
                  <Clock className="mx-auto mb-3 text-secondary" size={32} />
                  <p className="text-secondary text-sm">No takedown has been requested yet.</p>
                  <p className="text-xs text-secondary mt-1">Request a takedown to see progress updates here.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab('takedown')}
                  >
                    Go to Takedown Actions
                  </Button>
                </div>
              ) : (
                <>
                  {caseUpdates.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-lg">
                      <MessageSquare className="mx-auto mb-3 text-secondary" size={32} />
                      <p className="text-secondary text-sm">No updates yet.</p>
                      <p className="text-xs text-secondary mt-1">Our team will post updates as your case progresses.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {caseUpdates.slice().reverse().map((update, index) => {
                        const config = CASE_UPDATE_TYPES.find(c => c.type === update.type);
                        const isLatest = index === 0;
                        const isBrandOwner = update.createdBy === 'brand_owner';

                        return (
                          <div
                            key={update.id}
                            className={`p-4 border rounded-lg transition-all ${
                              isBrandOwner
                                ? 'border-purple-500/30 bg-purple-500/5 ml-8'
                                : isLatest
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border bg-surface/30'
                            } ${!update.isRead ? 'ring-2 ring-primary/20' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded ${
                                isBrandOwner
                                  ? 'bg-purple-500/10 text-purple-500'
                                  : config?.isPositive
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-blue-500/10 text-blue-500'
                              }`}>
                                {isBrandOwner ? <User size={16} /> : config?.isPositive ? <CheckCircle size={16} /> : <Clock size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-sm text-primary">
                                    {isBrandOwner ? 'Your Message' : config?.label || 'Update'}
                                  </span>
                                  {isLatest && (
                                    <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded uppercase font-mono">
                                      Latest
                                    </span>
                                  )}
                                  {!update.isRead && (
                                    <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded uppercase font-mono">
                                      New
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-secondary">{update.message}</p>
                                <p className="text-xs text-secondary/60 mt-2 font-mono">
                                  {new Date(update.createdAt).toLocaleString()}
                                  {update.createdBy === 'system' && ' • System'}
                                  {update.createdBy === 'lawyer' && ' • Legal Team'}
                                  {update.createdBy === 'brand_owner' && ' • You'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="pt-4 border-t border-border">
                    <label className="block text-sm font-medium text-primary mb-2">
                      Send a message to the legal team
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message here... (e.g., questions about the case, additional evidence, etc.)"
                        className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-primary/50 resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        variant="primary"
                        icon={Send}
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || isSending}
                        className="self-end"
                      >
                        {isSending ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                    <p className="text-xs text-secondary mt-2">
                      Press Enter to send, Shift+Enter for new line
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </Modal>
  );
};

export default CaseDetailModal;
