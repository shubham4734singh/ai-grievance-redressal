import React from 'react';
import { cn } from './Button';
import { Button } from './Button';

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center bg-surface-card border border-surface-border rounded-xl shadow-sm', className)}>
      {Icon && (
        <div className="w-12 h-12 mb-4 text-primary-500 bg-primary-50 rounded-full flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-600 mb-6 max-w-sm mx-auto">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export { EmptyState };
