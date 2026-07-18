import { useMemo } from 'react';

import { useWorkspace, AllWorkspacesId } from '@/hooks/use-workspace';
import { SelectWithSearch } from '@/components/originui/select-with-search';
import { RAGFlowFormItem } from '@/components/ragflow-form';
import { useTranslation } from 'react-i18next';

type ResourceWorkspaceFormFieldProps = {
  name?: string;
  horizontal?: boolean;
};

export function ResourceWorkspaceFormField({
  name = 'workspace_id',
  horizontal = false,
}: ResourceWorkspaceFormFieldProps) {
  const { t } = useTranslation();
  const { options } = useWorkspace();
  const writableOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          option.value !== AllWorkspacesId &&
          option.capabilities?.create_shared_resource,
      ),
    [options],
  );

  if (!writableOptions.length) return null;

  return (
    <RAGFlowFormItem
      name={name}
      label={t('setting.workspace')}
      horizontal={horizontal}
    >
      <SelectWithSearch
        options={writableOptions}
        triggerClassName="w-full"
        testId="resource-workspace-select"
      />
    </RAGFlowFormItem>
  );
}
