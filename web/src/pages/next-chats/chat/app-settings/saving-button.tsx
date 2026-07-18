import { ButtonLoading } from '@/components/ui/button';
import { ReadOnlySaveTooltip } from '@/components/read-only-save-tooltip';
import { useTranslation } from 'react-i18next';

type SaveButtonProps = {
  loading: boolean;
  readOnly?: boolean;
};

export function SavingButton({ loading, readOnly = false }: SaveButtonProps) {
  const { t } = useTranslation();

  return (
    <ReadOnlySaveTooltip readOnly={readOnly}>
      <ButtonLoading
        data-testid="chat-settings-save"
        type="submit"
        loading={loading}
        disabled={readOnly}
      >
        {t('common.save')}
      </ButtonLoading>
    </ReadOnlySaveTooltip>
  );
}
