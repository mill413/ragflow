import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type DetailInformationCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  className?: string;
  valueClassName?: string;
};

export function DetailInformationCard({
  label,
  value,
  icon: Icon,
  className,
  valueClassName,
}: DetailInformationCardProps) {
  const title =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : undefined;

  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border-0.5 border-border-button bg-bg-input p-3',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span className="min-w-0 truncate">{label}</span>
        <Icon className="ml-auto size-4 shrink-0" />
      </div>
      <div
        className={cn(
          'mt-2 break-words text-sm font-medium text-text-primary',
          valueClassName,
        )}
        title={title}
      >
        {value}
      </div>
    </div>
  );
}
