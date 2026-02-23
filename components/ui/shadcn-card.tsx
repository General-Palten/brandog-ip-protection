import * as React from 'react';
import { cn } from '../../lib/utils';

export const ShadCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-xl border border-border bg-background text-primary', className)} {...props} />
  )
);
ShadCard.displayName = 'ShadCard';

export const ShadCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);
ShadCardHeader.displayName = 'ShadCardHeader';

export const ShadCardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
ShadCardTitle.displayName = 'ShadCardTitle';

export const ShadCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-secondary', className)} {...props} />
);
ShadCardDescription.displayName = 'ShadCardDescription';

export const ShadCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
);
ShadCardContent.displayName = 'ShadCardContent';
