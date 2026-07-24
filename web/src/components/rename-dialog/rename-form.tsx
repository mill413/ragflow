'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { TagRenameId } from '@/constants/knowledge';
import { useCreationWorkspaceOptions } from '@/hooks/use-workspace';
import { IModalProps } from '@/interfaces/common';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceFormField } from '../workspace-form-field';

type RenameFormProps = Omit<IModalProps<any>, 'onOk'> & {
  initialName?: string;
  showWorkspace?: boolean;
  onOk?: (name: string, workspaceId?: string) => unknown;
};

export function RenameForm({
  initialName,
  hideModal,
  onOk,
  showWorkspace = false,
}: RenameFormProps) {
  const { t } = useTranslation();
  const { defaultWorkspaceId, writableOptions } = useCreationWorkspaceOptions(
    'create_collaborative_resource',
  );
  const FormSchema = z.object({
    name: z
      .string()
      .min(1, {
        message: t('common.namePlaceholder'),
      })
      .trim(),
    workspace_id: showWorkspace ? z.string().min(1) : z.string().optional(),
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', workspace_id: defaultWorkspaceId },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const ret = await onOk?.(data.name, data.workspace_id);
    if (ret) {
      hideModal?.();
    }
  }

  useEffect(() => {
    if (initialName) {
      form.setValue('name', initialName);
    }
  }, [form, initialName]);

  useEffect(() => {
    if (showWorkspace) {
      form.setValue('workspace_id', defaultWorkspaceId);
    }
  }, [defaultWorkspaceId, form, showWorkspace]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        id={TagRenameId}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('common.name')}</FormLabel>
              <FormControl>
                <Input
                  data-testid="rename-name-input"
                  placeholder={t('common.namePlaceholder')}
                  {...field}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showWorkspace && <WorkspaceFormField options={writableOptions} />}
      </form>
    </Form>
  );
}
