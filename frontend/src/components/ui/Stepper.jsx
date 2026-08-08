import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './Button';

const Stepper = ({ steps, currentStep, className }) => {
  // steps = array of string labels e.g. ['Submitted', 'Reviewed', 'Assigned', 'In Progress', 'Resolved']
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-surface-border -z-10 hidden md:block"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full space-y-4 md:space-y-0">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <div key={step} className="flex md:flex-col items-center gap-3 md:gap-2 relative z-10 bg-surface-card md:bg-transparent md:px-2">
                {/* Mobile connecting line */}
                {index !== steps.length - 1 && (
                  <div className="absolute left-3.5 top-8 bottom-[-16px] w-0.5 bg-surface-border md:hidden -z-10"></div>
                )}
                
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  isCompleted ? "bg-status-resolved border-status-resolved text-white" :
                  isCurrent ? "bg-white border-primary-500 text-primary-500" :
                  "bg-white border-surface-border text-gray-400"
                )}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                
                <span className={cn(
                  "text-sm font-medium",
                  (isCurrent || isCompleted) ? "text-gray-900" : "text-gray-500"
                )}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { Stepper };
