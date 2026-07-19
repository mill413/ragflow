import * as React from 'react';

import { TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export const AdminDetailTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn(
      'border border-border-button bg-bg-input text-text-secondary shadow-none',
      'hover:border-accent-primary/50 hover:text-text-primary',
      'data-[state=active]:border-accent-primary data-[state=active]:bg-accent-primary/10',
      'data-[state=active]:text-accent-primary data-[state=active]:shadow-none',
      className,
    )}
    {...props}
  />
));

AdminDetailTabsTrigger.displayName = 'AdminDetailTabsTrigger';
