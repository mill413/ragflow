import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideDot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseBooleanish } from '../utils';

type UserStatusProps = {
  active: unknown;
  className?: string;
};

export function UserStatusText({ active, className }: UserStatusProps) {
  const { t } = useTranslation();
  const isActive = parseBooleanish(active);

  return (
    <span
      className={cn(
        'flex items-center',
        isActive ? 'text-state-success' : 'text-state-error',
        className,
      )}
    >
      <LucideDot className="mr-1 size-[1em] stroke-[8]" />
      {t(isActive ? 'admin.active' : 'admin.inactive')}
    </span>
  );
}

export function UserStatusBadge({ active, className }: UserStatusProps) {
  const { t } = useTranslation();
  const isActive = parseBooleanish(active);

  return (
    <Badge
      variant={isActive ? 'success' : 'destructive'}
      className={cn('pl-[.5em]', className)}
    >
      <LucideDot className="mr-1 size-[1em] stroke-[8]" />
      {t(isActive ? 'admin.active' : 'admin.inactive')}
    </Badge>
  );
}
