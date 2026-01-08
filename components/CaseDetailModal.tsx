import React, { useState } from 'react';
import { InfringementItem } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import PlatformIcon from './ui/PlatformIcon';
import StatusBadge from './ui/StatusBadge';
import { 
  ExternalLink, Copy, Camera, FileText, Download, 
  ShieldAlert, CheckCircle, XCircle, Send, Globe, Server
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
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'takedown'>('overview');

  if (!item) return null;

  const generateDMCATemplate = () => {
    return `To: Legal Department, ${item.platform}
    
Re: Notice of Intellectual Property Infringement

I am writing on behalf of ${item.brandName}, the owner of the intellectual property rights described below. I have a good faith belief that the material identified below is not authorized by the copyright owner, its agent, or the law.

1. Copyright Owner: ${item.brandName}
2. Description of Original Work: Official product listing and imagery protected by trademark/copyright.
   Original URL: https://${item.brandName.toLowerCase()}.com/products/original
3. Description of Infringing Material: Unauthorized reproduction of product imagery and trademarked branding.
   Infringing URL: ${item.infringingUrl}
   Seller Name: ${item.sellerName}
4. Action Requested: Immediate removal of the infringing listing.

I declare under penalty of perjury that the information in this notification is accurate and that I am authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.

Sincerely,
[Your Name]
Brand Protection Officer
${new Date().toLocaleDateString()}`;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Case #${item.id} - ${item.sellerName}`}
      size="xl"
    >
      <div className="flex flex-col h-[calc(80vh-100px)]">
        {/* Case Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface/30">
          <div className="flex items-center gap-4">
            <PlatformIcon platform={item.platform} size={20} showLabel className="text-primary font-medium" />
            <div className="h-4 w-px bg-border"></div>
            <StatusBadge status={item.status} />
            <span className="text-xs text-secondary font-mono">Detected: {item.detectedAt}</span>
          </div>
          <a 
            href={item.infringingUrl} 
            target="_blank" 
            rel="noreferrer"
            className="text-xs flex items-center gap-1 text-primary hover:underline"
          >
            Visit Listing <ExternalLink size={12} />
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {[
            { id: 'overview', label: 'Analysis & Compare' },
            { id: 'evidence', label: 'Evidence Pack' },
            { id: 'takedown', label: 'Takedown Actions' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Side by Side */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Original Asset</span>
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded border border-green-500/20">Protected</span>
                  </div>
                  <div className="aspect-square bg-surface border border-border rounded-lg overflow-hidden relative group">
                    <img src={item.originalImage} alt="Original" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Infringing Listing</span>
                    <span className="text-xs font-mono text-red-500">{item.similarityScore}% Match</span>
                  </div>
                  <div className="aspect-square bg-surface border-2 border-red-500/30 rounded-lg overflow-hidden relative group">
                    <img src={item.copycatImage} alt="Infringement" className="w-full h-full object-cover" />
                    {/* Visual Overlay for AI Detection zones could go here */}
                    <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md text-white p-2 rounded text-xs">
                      AI identified logo match and 98% texture similarity.
                    </div>
                  </div>
                </div>
              </div>

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
                   <p className="font-mono text-lg text-primary">{item.country}</p>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Template Section */}
                 <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                       <label className="text-sm font-medium">Generated DMCA Notice</label>
                       <button className="text-xs flex items-center gap-1 text-primary hover:text-secondary">
                          <Copy size={12} /> Copy to Clipboard
                       </button>
                    </div>
                    <textarea 
                      className="w-full h-[400px] p-4 bg-surface border border-border rounded-lg font-mono text-xs leading-relaxed resize-none focus:outline-none focus:border-primary"
                      readOnly
                      value={generateDMCATemplate()}
                    />
                 </div>

                 {/* Actions Sidebar */}
                 <div className="space-y-4">
                    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                       <h4 className="font-medium text-sm">Recommended Action</h4>
                       <p className="text-xs text-secondary">Based on the similarity score (100%) and seller history, we recommend immediate takedown.</p>
                       
                       <Button 
                         variant="primary" 
                         className="w-full justify-center" 
                         icon={Send}
                         onClick={() => {
                             onConfirm(item.id);
                             onClose();
                         }}
                       >
                         Send Automated Report
                       </Button>
                       
                       <div className="h-px bg-border my-2"></div>

                       <Button 
                         variant="outline" 
                         className="w-full justify-center"
                         onClick={() => window.open(`mailto:abuse@${item.platform.replace(/\s/g, '').toLowerCase()}.com`)}
                       >
                         Open Email Client
                       </Button>
                    </div>

                    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
                        <h4 className="font-medium text-sm">Alternative Actions</h4>
                        <Button 
                            variant="ghost" 
                            className="w-full justify-start px-0 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            icon={XCircle}
                            onClick={() => {
                                onDismiss(item.id);
                                onClose();
                            }}
                        >
                            Dismiss as False Positive
                        </Button>
                    </div>
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </Modal>
  );
};

export default CaseDetailModal;