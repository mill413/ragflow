import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ReadOnlySaveTooltipProps = {
  readOnly: boolean;
  children: ReactNode;
};

export function ReadOnlySaveTooltip({
  readOnly,
  children,
}: ReadOnlySaveTooltipProps) {
  const { t } = useTranslation();

  if (!readOnly) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-not-allowed [&>button]:pointer-events-none"
          tabIndex={0}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('common.readOnlySaveTip')}</TooltipContent>
    </Tooltip>
  );
}
