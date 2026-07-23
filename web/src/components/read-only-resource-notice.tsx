import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ReadOnlyResourceNotice({ resource }: { resource: string }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-border-button bg-bg-card px-3 py-2 text-sm text-text-secondary"
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>{t('common.readOnlyResourceTip', { resource })}</span>
    </div>
  );
}
