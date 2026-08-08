import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Archive } from 'lucide-react';
import { cn } from './Button';

const StatusBadge = ({ status, className }) => {
  const config = {
    'Submitted': {
      colors: 'bg-yellow-100 text-yellow-800',
      icon: Clock,
      label: 'Submitted',
    },
    'In Progress': {
      colors: 'bg-blue-100 text-blue-800',
      icon: Clock,
      label: 'In Progress',
    },
    'Resolved': {
      colors: 'bg-green-100 text-green-800',
      icon: CheckCircle,
      label: 'Resolved',
    },
    'Rejected': {
      colors: 'bg-red-100 text-red-800',
      icon: Archive,
      label: 'Rejected',
    },
  };

  const { colors, icon: Icon, label } = config[status] || { colors: 'bg-gray-100 text-gray-800', icon: Clock, label: status };

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', colors, className)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

export { StatusBadge };
