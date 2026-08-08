import React from 'react';
import { cn } from './Button';

const Input = React.forwardRef(({ className, label, error, ...props }, ref) => {
  const id = props.id || props.name;
  
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(
          "w-full h-11 px-3 py-2 bg-white border rounded-xl text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow disabled:opacity-50 disabled:bg-gray-50",
          error ? "border-status-urgent focus:ring-status-urgent" : "border-surface-border",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-status-urgent" role="alert">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export { Input };
