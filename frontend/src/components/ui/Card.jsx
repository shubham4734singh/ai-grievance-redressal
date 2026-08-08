import React from 'react';
import { cn } from './Button';

const Card = React.forwardRef(({ className, title, density = 'citizen', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface-card border border-surface-border shadow-sm',
        density === 'admin' ? 'rounded-md p-4' : 'rounded-xl p-6 md:p-8',
        className
      )}
      {...props}
    >
      {title && (
        <h3 className={cn("font-semibold text-gray-900 mb-4", density === 'admin' ? 'text-base' : 'text-lg md:text-xl')}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
});

Card.displayName = 'Card';
export { Card };
