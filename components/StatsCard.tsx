import React from 'react';
import { Info, ArrowUpRight } from 'lucide-react';

interface StatsCardProps {
  icon?: React.ElementType;
  title: React.ReactNode;
  value: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const StatsCard: React.FC<StatsCardProps> = ({ icon: Icon, title, value, action }) => {
  return (
    <div className="bg-surface border border-border rounded-none overflow-hidden flex flex-col h-full min-h-[120px] hover:border-secondary/50 transition-colors group">
      <div className="p-5 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-secondary group-hover:text-primary transition-colors">
            {Icon && <Icon size={16} />}
            <div className="font-medium text-sm">{title}</div>
          </div>
          {action ? (
            <button 
              onClick={action.onClick}
              className="p-1 text-secondary hover:text-primary hover:bg-surface rounded-md transition-colors"
            >
              <ArrowUpRight size={14} />
            </button>
          ) : (
            <div className="text-secondary/50">
              <Info size={14} />
            </div>
          )}
        </div>
        
        <div className="mt-2">
          <span className="text-3xl font-mono font-medium text-primary tracking-tight">{value}</span>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;