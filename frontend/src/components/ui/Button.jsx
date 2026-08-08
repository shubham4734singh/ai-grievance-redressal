import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Button = React.forwardRef(({ 
  className, variant = 'primary', size = 'md', loading = false, fullWidth = false, 
  iconLeft, iconRight, as: Component = 'button', children, disabled, ...props 
}, ref) => {
  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-white border border-surface-border text-primary-500 hover:bg-primary-50',
    ghost: 'bg-transparent text-primary-500 hover:bg-primary-50',
    danger: 'bg-status-urgent text-white hover:bg-[#B93A3A]',
  };
  
  const sizes = {
    sm: 'h-9 px-3 text-sm min-h-[44px] md:min-h-0',
    md: 'h-11 px-5 text-base min-h-[44px]',
    lg: 'h-12 px-6 text-base min-h-[44px]',
  };

  return (
    <Component
      ref={ref}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && iconLeft && <span className="mr-2">{iconLeft}</span>}
      {children}
      {!loading && iconRight && <span className="ml-2">{iconRight}</span>}
    </Component>
  );
});

Button.displayName = 'Button';
export { Button };
