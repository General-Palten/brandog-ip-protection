import React, { useState, useEffect } from 'react';
import { InfringementItem } from '../types';
import { useDashboard } from '../context/DashboardContext';
import PlatformIcon from './ui/PlatformIcon';
import StatusBadge from './ui/StatusBadge';
import { ImageOff, ExternalLink, MessageSquare, AlertTriangle, AlertCircle } from 'lucide-react';

interface InfringementTableProps {
  items: InfringementItem[];
  onRowClick: (item: InfringementItem) => void;
}

const InfringementTable: React.FC<InfringementTableProps> = ({ items, onRowClick }) => {
  const { getAssetURL, getUnreadUpdateCount } = useDashboard();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Load images from IndexedDB for items with originalAssetId
  useEffect(() => {
    const loadImages = async () => {
      const urls: Record<string, string> = {};
      for (const item of items) {
        if (item.originalAssetId && !item.originalImage) {
          try {
            const url = await getAssetURL(item.originalAssetId);
            urls[item.id] = url;
          } catch {
            urls[item.id] = '';
          }
        } else {
          urls[item.id] = item.copycatImage || item.originalImage || '';
        }
      }
      setImageUrls(urls);
    };
    loadImages();
  }, [items, getAssetURL]);

  const getRiskLevel = (score: number, revenue: number) => {
    if (score >= 95 || revenue >= 1000) return 'high';
    if (score >= 80 || revenue >= 500) return 'medium';
    return 'low';
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              Infringement
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider w-20">
              Image
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              Infringer Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              Price
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              Risk
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => {
            const unreadCount = getUnreadUpdateCount(item.id);
            const riskLevel = getRiskLevel(item.similarityScore, item.revenueLost);
            const imageUrl = imageUrls[item.id] || item.copycatImage || '';

            return (
              <tr
                key={item.id}
                onClick={() => onRowClick(item)}
                className="hover:bg-surface/50 transition-colors cursor-pointer"
              >
                {/* Infringement Column */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-primary">{item.brandName}</span>
                      {item.isTrademarked && (
                        <span className="text-[9px] font-mono bg-background border border-border text-secondary px-1 py-0.5">TM</span>
                      )}
                      {unreadCount > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-blue-500">
                          <MessageSquare size={10} />
                          <span className="text-[10px] font-bold">{unreadCount}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={item.platform} size={12} />
                      <span className="text-xs text-secondary">{item.platform}</span>
                      <span className="text-xs text-secondary">•</span>
                      <span className="text-xs font-mono text-secondary">{item.similarityScore}% match</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </td>

                {/* Image Column */}
                <td className="px-4 py-3">
                  <div className="w-14 h-14 bg-background border border-border rounded overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Infringement"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary">
                        <ImageOff size={16} />
                      </div>
                    )}
                  </div>
                </td>

                {/* Infringer Details Column */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-primary">{item.sellerName || 'Unknown Seller'}</span>
                    <span className="text-xs text-secondary">{item.country}</span>
                    {item.infringingUrl && (
                      <a
                        href={item.infringingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                      >
                        View listing <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </td>

                {/* Price Column */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm text-primary">
                      ${item.revenueLost.toLocaleString()}
                    </span>
                    <span className="text-xs text-secondary">Est. loss</span>
                  </div>
                </td>

                {/* Risk Column */}
                <td className="px-4 py-3">
                  <div className={`flex items-center gap-2 px-2 py-1 rounded w-fit ${
                    riskLevel === 'high'
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : riskLevel === 'medium'
                      ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                      : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                  }`}>
                    {riskLevel === 'high' ? (
                      <AlertTriangle size={12} />
                    ) : (
                      <AlertCircle size={12} />
                    )}
                    <span className="text-xs font-medium capitalize">{riskLevel}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InfringementTable;
