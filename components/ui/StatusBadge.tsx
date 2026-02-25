import React from 'react';
import { InfringementStatus } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { Clock, CheckCircle, XCircle, AlertCircle, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: InfringementStatus;
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-500' };

  const getIcon = () => {
    switch(status) {
      case 'detected': return <AlertCircle size={12} />;
      case 'pending_review': return <Clock size={12} />;
      case 'needs_member_input': return <AlertCircle size={12} />;
      case 'in_progress': return <Clock size={12} />;
      case 'resolved_success': return <CheckCircle size={12} />;
      case 'resolved_partial': return <ShieldCheck size={12} />;
      case 'resolved_failed': return <XCircle size={12} />;
      case 'dismissed_by_member': return <XCircle size={12} />;
      case 'dismissed_by_admin': return <XCircle size={12} />;
      default: return null;
    }
  };

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border font-medium uppercase tracking-wide ${padding} ${config.className}`}>
      {getIcon()}
      {config.label}
    </span>
  );
};

export default StatusBadge;