import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Archive } from 'lucide-react';
import { cn } from './Button';

const StatusBadge = ({ status, className }) => {
  const config = {
    urgent: {
      colors: 'bg-status-urgent text-white',
      icon: AlertTriangle,
      label: 'Urgent',
    },
    progress: {
      colors: 'bg-status-progress text-white',
      icon: Clock,
      label: 'In Progress',
    },
    resolved: {
      colors: 'bg-status-resolved text-white',
      icon: CheckCircle,
      label: 'Resolved',
    },
    closed: {
      colors: 'bg-status-closed text-white',
      icon: Archive,
      label: 'Closed',
    },
  };

  const normalized = { 'Submitted': 'progress', 'In Progress': 'progress', 'Resolved': 'resolved', 'Rejected': 'closed', 'Closed': 'closed' }[status] || status;
  const { colors, icon: Icon, label } = config[normalized] || config.progress;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', colors, className)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

export { StatusBadge };
