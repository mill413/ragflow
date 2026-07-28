import SvgIcon from '@/components/svg-icon';
import { Button } from '@/components/ui/button';
import { useFetchLangfuseConfig } from '@/hooks/use-user-setting-request';
import { Eye, Settings2 } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LangfuseConfigurationDialog } from './langfuse-configuration-dialog';
import { useSaveLangfuseConfiguration } from './use-save-langfuse-configuration';

export function LangfuseEntry() {
  const {
    saveLangfuseConfigurationOk,
    showSaveLangfuseConfigurationModal,
    hideSaveLangfuseConfigurationModal,
    saveLangfuseConfigurationVisible,
    loading,
  } = useSaveLangfuseConfiguration();
  const { t } = useTranslation();
  const { data } = useFetchLangfuseConfig();

  const handleView = useCallback(() => {
    if (!data?.host || !data.project_id) {
      return;
    }
    const projectUrl = new URL(
      `project/${data.project_id}`,
      `${data.host.replace(/\/+$/, '')}/`,
    );
    window.open(projectUrl, '_blank', 'noopener,noreferrer');
  }, [data?.host, data?.project_id]);

  return (
    <div className="flex items-center gap-2">
      {data?.project_id && (
        <Button variant="outline" size="sm" onClick={handleView}>
          <Eye />
          {t('setting.view')}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={showSaveLangfuseConfigurationModal}
      >
        <SvgIcon name="langfuse" width={18} height={18} />
        Langfuse
        <Settings2 />
      </Button>
      {saveLangfuseConfigurationVisible && (
        <LangfuseConfigurationDialog
          hideModal={hideSaveLangfuseConfigurationModal}
          onOk={saveLangfuseConfigurationOk}
          loading={loading}
        ></LangfuseConfigurationDialog>
      )}
    </div>
  );
}
