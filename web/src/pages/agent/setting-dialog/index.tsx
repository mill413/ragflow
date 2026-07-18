import { ButtonLoading } from '@/components/ui/button';
import { ReadOnlySaveTooltip } from '@/components/read-only-save-tooltip';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFetchAgent, useSetAgent } from '@/hooks/use-agent-request';
import { IModalProps } from '@/interfaces/common';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AgentSettingId,
  SettingForm,
  SettingFormSchemaType,
} from './setting-form';

export function SettingDialog({ hideModal }: IModalProps<any>) {
  const { t } = useTranslation();
  const { setAgent } = useSetAgent();
  const { data } = useFetchAgent();
  const readOnly = data?.capabilities?.update !== true;

  const submit = useCallback(
    async (values: SettingFormSchemaType) => {
      const ret = await setAgent({
        ...values,
        avatar: values.avatar ?? undefined,
      });
      if (ret?.code === 0) {
        hideModal?.();
      }
    },
    [hideModal, setAgent],
  );

  return (
    <Dialog open onOpenChange={hideModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common.edit')}</DialogTitle>
        </DialogHeader>
        <SettingForm submit={submit}></SettingForm>
        <DialogFooter>
          <ReadOnlySaveTooltip readOnly={readOnly}>
            <ButtonLoading
              type="submit"
              form={AgentSettingId}
              loading={false}
              disabled={readOnly}
            >
              {t('common.save')}
            </ButtonLoading>
          </ReadOnlySaveTooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
