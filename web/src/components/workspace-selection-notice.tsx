import { CircleArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function WorkspaceSelectionNotice() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex size-full items-center justify-center rounded-lg border border-border-button"
    >
      <div className="max-w-xl px-6 text-center">
        <CircleArrowUp className="mx-auto size-8 text-accent-primary" />
        <h3 className="mt-3 text-base font-medium text-text-primary">
          {t('common.selectWorkspaceBeforeConfiguration')}
        </h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {t('common.selectWorkspaceAboveTip')}
        </p>
      </div>
    </div>
  );
}
