'use client';

import { AvatarNameDescription } from '@/components/avatar-name-description';
import { KnowledgeBaseFormField } from '@/components/knowledge-base-item';
import { ResourceWorkspaceFormField } from '@/components/resource-workspace-form-field';
import { LlmSettingFieldItems } from '@/components/llm-setting-items/next';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useTranslate } from '@/hooks/common-hooks';
import { prefixName } from '@/utils/form';
import { getDirAttribute } from '@/utils/text-direction';
import { useFormContext, useWatch } from 'react-hook-form';

interface ChatBasicSettingProps {
  prefix?: string;
  option?: Record<string, any>;
  hideName?: boolean;
  workspaceId?: string;
}

export default function ChatBasicSetting({
  prefix = '',
  hideName = false,
  workspaceId,
}: ChatBasicSettingProps) {
  const { t } = useTranslate('chat');
  const form = useFormContext();

  const prologueValue = useWatch({
    control: form.control,
    name: prefixName(prefix, 'prompt_config.prologue'),
  });

  const llmSettingPrefix = prefixName(prefix, 'llm_setting');
  const selectedWorkspaceId = useWatch({
    control: form.control,
    name: prefixName(prefix, 'workspace_id'),
  });

  return (
    <div className="space-y-8">
      {hideName || (
        <AvatarNameDescription
          avatarField={prefixName(prefix, 'icon')}
          nameField={prefixName(prefix, 'name')}
          descriptionField={prefixName(prefix, 'description')}
        />
      )}
      {prefix || <ResourceWorkspaceFormField />}
      <LlmSettingFieldItems
        prefix={llmSettingPrefix}
        llmId={prefixName(prefix, 'llm_id')}
        showCollapse
        ownerTenantId={selectedWorkspaceId || workspaceId}
      ></LlmSettingFieldItems>

      <FormField
        control={form.control}
        name={prefixName(prefix, 'prompt_config.prologue')}
        render={({ field }) => (
          <FormItem>
            <FormLabel tooltip={t('setAnOpenerTip')}>
              {t('setAnOpener')}
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                dir={getDirAttribute(prologueValue || '')}
              ></Textarea>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <KnowledgeBaseFormField
        name={prefixName(prefix, 'dataset_ids')}
        workspaceId={selectedWorkspaceId || workspaceId}
      ></KnowledgeBaseFormField>
    </div>
  );
}
