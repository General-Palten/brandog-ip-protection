import React, { useState } from 'react';
import { Send, Link as LinkIcon, UploadCloud, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

// Mock data for history
const MOCK_HISTORY = [
  { id: '101', url: 'https://fake-shop.com/products/copy', platform: 'Shopify', type: 'Counterfeit Product', date: '2023-10-25', status: 'pending' },
  { id: '102', url: 'https://instagram.com/p/12345', platform: 'Instagram', type: 'Trademark Violation', date: '2023-10-22', status: 'reported' },
];

interface ReportBadActorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReportBadActorModal: React.FC<ReportBadActorModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState(MOCK_HISTORY);

  // Form states
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newReport = {
      id: Date.now().toString(),
      url: formattedUrl,
      platform: platform || 'Other',
      type: type || 'Copyright Infringement',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    };

    setHistory([newReport, ...history]);
    setSubmitted(true);

    setUrl('');
    setPlatform('');
    setType('');
    setDescription('');

    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Bad Actor" size="xl">
      <div className="p-6 space-y-6">
        {submitted ? (
          <div className="py-8 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Send size={32} />
            </div>
            <h2 className="text-xl font-medium text-primary mb-2">Report Queued</h2>
            <p className="text-secondary max-w-sm mx-auto">
              Our automated system has queued this for processing. You can track it below.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 text-primary text-sm font-medium underline underline-offset-4 hover:text-secondary transition-colors"
            >
              Submit another report
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Infringing URL</label>
              <div className="relative group">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors" size={16} />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com/product..."
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select Platform...</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Amazon">Amazon</option>
                  <option value="AliExpress">AliExpress</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Meta Ads">Facebook / Meta</option>
                  <option value="TikTok Shop">TikTok</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Violation Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select Type...</option>
                  <option value="Copyright Infringement">Copyright Infringement</option>
                  <option value="Trademark Violation">Trademark Violation</option>
                  <option value="Counterfeit Product">Counterfeit Product</option>
                  <option value="Impersonation">Impersonation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 bg-background border border-border rounded-lg text-sm text-primary placeholder-secondary/50 focus:outline-none focus:border-primary transition-colors resize-none"
                placeholder="Provide specific details about the infringement..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Evidence</label>
              <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-secondary hover:text-primary hover:border-secondary hover:bg-surface/50 transition-all cursor-pointer" tabIndex={0} role="button">
                <UploadCloud size={20} className="mb-2" />
                <span className="text-sm font-medium">Click to upload files</span>
                <span className="text-xs text-secondary/70 mt-1">or drag and drop here</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button variant="primary" icon={Send} type="submit">
                Submit Takedown
              </Button>
            </div>
          </form>
        )}

        {/* Submission History */}
        {history.length > 0 && (
          <div className="border-t border-border pt-6">
            <h3 className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">Submission History</h3>
            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
              {history.map((item) => (
                <div key={item.id} className="p-3 border border-border rounded-lg bg-surface/30 hover:bg-surface transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] text-secondary font-mono bg-surface border border-border px-1.5 rounded">{item.date}</span>
                    {item.status === 'reported' ? (
                      <span className="text-[10px] text-green-500 flex items-center gap-1 font-medium"><CheckCircle size={10} /> Reported</span>
                    ) : (
                      <span className="text-[10px] text-amber-500 flex items-center gap-1 font-medium"><Clock size={10} /> Pending</span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-primary truncate mb-1" title={item.type}>{item.type}</h4>
                  <div className="flex items-center gap-2 text-xs text-secondary mb-2">
                    <span className="truncate">{item.platform}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 truncate w-full hover:underline"
                  >
                    <ExternalLink size={10} />
                    <span className="truncate">{item.url}</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReportBadActorModal;
