import * as React from 'react';
import { cn } from '../../lib/utils';

export const DataToolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col xl:flex-row gap-4 items-center justify-between',
      className,
    )}
    {...props}
  />
));
DataToolbar.displayName = 'DataToolbar';

export const DataToolbarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-wrap items-center gap-3 w-full', className)}
    {...props}
  />
));
DataToolbarGroup.displayName = 'DataToolbarGroup';
