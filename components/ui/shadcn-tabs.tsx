import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

/* ── ShadTabs — wrapper with bottom border ──────────────────────────────────── */

export const ShadTabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-b border-border', className)}
    {...props}
  />
));
ShadTabs.displayName = 'ShadTabs';

/* ── ShadTabsList — scrollable flex row for triggers ────────────────────────── */

export const ShadTabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center gap-1 overflow-x-auto pb-px scrollbar-thin',
      className,
    )}
    {...props}
  />
));
ShadTabsList.displayName = 'ShadTabsList';

/* ── ShadTabsTrigger — individual tab button ────────────────────────────────── */

const triggerVariants = cva(
  'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 border-b-2',
  {
    variants: {
      active: {
        true: 'border-primary text-primary',
        false:
          'border-transparent text-secondary hover:text-primary hover:border-border',
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface ShadTabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof triggerVariants> {
  icon?: LucideIcon;
  count?: number;
}

export const ShadTabsTrigger = React.forwardRef<
  HTMLButtonElement,
  ShadTabsTriggerProps
>(({ className, active, icon: Icon, count, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(triggerVariants({ active, className }))}
    {...props}
  >
    {Icon && <Icon size={14} />}
    {children}
    {count !== undefined && (
      <span
        className={cn(
          'px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center',
          active
            ? 'bg-primary text-inverse'
            : 'bg-surface text-secondary',
        )}
      >
        {count}
      </span>
    )}
  </button>
));
ShadTabsTrigger.displayName = 'ShadTabsTrigger';

/* ── ShadTabsContent — content panel (show/hide via children) ───────────────── */

export const ShadTabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props} />
));
ShadTabsContent.displayName = 'ShadTabsContent';
