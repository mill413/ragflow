import { z } from 'zod';

import { AvatarUpload } from '@/components/avatar-upload';
import { RAGFlowFormItem } from '@/components/ragflow-form';
import { ResourceWorkspaceFormField } from '@/components/resource-workspace-form-field';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchAgent } from '@/hooks/use-agent-request';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

const formSchema = z.object({
  title: z.string().min(1, {}),
  avatar: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  workspace_id: z.string(),
});

export type SettingFormSchemaType = z.infer<typeof formSchema>;

export const AgentSettingId = 'agentSettingId';

type SettingFormProps = {
  submit: (values: SettingFormSchemaType) => void;
};

export function SettingForm({ submit }: SettingFormProps) {
  const { t } = useTranslate('flow.settings');
  const { data } = useFetchAgent();

  const form = useForm<SettingFormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      workspace_id: '',
    },
  });

  useEffect(() => {
    form.reset({
      title: data?.title,
      description: data?.description,
      avatar: data.avatar,
      workspace_id: data?.user_id,
    });
  }, [data, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submit)}
        className="space-y-8"
        id={AgentSettingId}
      >
        <RAGFlowFormItem name="title" label={t('title')}>
          <Input />
        </RAGFlowFormItem>
        <RAGFlowFormItem name="avatar" label={t('photo')}>
          <AvatarUpload></AvatarUpload>
        </RAGFlowFormItem>
        <RAGFlowFormItem name="description" label={t('description')}>
          <Textarea rows={4} />
        </RAGFlowFormItem>

        <ResourceWorkspaceFormField />
      </form>
    </Form>
  );
}
