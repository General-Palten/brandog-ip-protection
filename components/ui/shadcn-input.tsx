import * as React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface ShadInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

const ShadInput = React.forwardRef<HTMLInputElement, ShadInputProps>(
  ({ className, icon: Icon, ...props }, ref) => {
    if (Icon) {
      return (
        <div className="relative group">
          <Icon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-primary transition-colors"
            size={16}
          />
          <input
            ref={ref}
            className={cn(
              'w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors',
              className,
            )}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);

ShadInput.displayName = 'ShadInput';

export { ShadInput };
