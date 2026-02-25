import React from 'react';

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
}

const BentoCard: React.FC<BentoCardProps> = ({ 
  children, 
  className = '', 
  title, 
  subtitle, 
  action,
  noPadding = false 
}) => {
  return (
    <div className={`bg-surface border border-border rounded-xl shadow-sm flex flex-col ${className}`}>
      {(title || action) && (
        <div className="p-4 pb-1 flex justify-between items-start shrink-0">
          <div>
            {title && <div className="font-medium text-secondary text-sm flex items-center gap-2">{title}</div>}
            {subtitle && <p className="text-2xl font-mono mt-1 text-primary">{subtitle}</p>}
          </div>
          {action && <div className="relative z-10">{action}</div>}
        </div>
      )}
      <div className={`flex-1 flex flex-col min-h-0 ${noPadding ? '' : 'px-4 pb-4'} ${!noPadding && (title || action) ? 'pt-2' : !noPadding ? 'pt-4' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default BentoCard;