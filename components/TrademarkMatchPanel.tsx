import React from 'react';
import { TrademarkMatch } from '../types';
import { Shield, Tag, Package, ChevronRight } from 'lucide-react';

interface TrademarkMatchPanelProps {
  matches: TrademarkMatch[];
  className?: string;
}

const TrademarkMatchPanel: React.FC<TrademarkMatchPanelProps> = ({ matches, className = '' }) => {
  if (!matches || matches.length === 0) {
    return null;
  }

  const totalMatches = matches.length;
  const totalProducts = matches.reduce((acc, m) => acc + m.matchingProducts.length, 0);

  return (
    <div className={`bg-surface border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-surface/50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="text-primary" size={16} />
          <span className="font-medium text-sm text-primary">Trademark Matches</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-secondary">
            <span className="font-mono font-bold text-primary">{totalMatches}</span> trademark{totalMatches !== 1 ? 's' : ''}
          </span>
          <span className="text-border">|</span>
          <span className="text-secondary">
            <span className="font-mono font-bold text-primary">{totalProducts}</span> product match{totalProducts !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      {/* Match List */}
      <div className="divide-y divide-border">
        {matches.map((match, index) => (
          <div key={index} className="px-4 py-3 hover:bg-background/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded shrink-0">
                <Tag className="text-primary" size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-primary">{match.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded">
                    Registered
                  </span>
                </div>
                <p className="text-xs text-secondary mb-2">
                  Found in: <span className="text-primary font-medium">{match.foundIn}</span>
                </p>
                {match.matchingProducts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package size={12} className="text-secondary" />
                    {match.matchingProducts.map((product, pIndex) => (
                      <span
                        key={pIndex}
                        className="text-[10px] px-2 py-0.5 bg-background border border-border rounded text-secondary"
                      >
                        {product}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight size={14} className="text-secondary shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrademarkMatchPanel;
