'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FileUploader } from '@/components/file-uploader';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FileMimeType } from '@/constants/common';
import { TagRenameId } from '@/constants/knowledge';
import { useCreationWorkspaceOptions } from '@/hooks/use-workspace';
import { IModalProps } from '@/interfaces/common';
import { useEffect } from 'react';
import { NameFormField, NameFormSchema } from '../name-form-field';
import { WorkspaceFormField } from '@/components/workspace-form-field';

export const FormSchema = z.object({
  fileList: z.array(z.instanceof(File)),
  ...NameFormSchema,
  workspace_id: z.string().min(1),
});

export type FormSchemaType = z.infer<typeof FormSchema>;
export function UploadAgentForm({ hideModal, onOk }: IModalProps<any>) {
  const { defaultWorkspaceId, writableOptions } = useCreationWorkspaceOptions(
    'create_collaborative_resource',
  );
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', workspace_id: defaultWorkspaceId },
  });

  async function onSubmit(data: FormSchemaType) {
    const ret = await onOk?.(data);
    if (ret) {
      hideModal?.();
    }
  }

  useEffect(() => {
    form.setValue('workspace_id', defaultWorkspaceId);
  }, [defaultWorkspaceId, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        id={TagRenameId}
      >
        <NameFormField></NameFormField>
        <WorkspaceFormField options={writableOptions} />
        <FormField
          control={form.control}
          name="fileList"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>DSL</FormLabel>
              <FormControl>
                <FileUploader
                  data-testid="agent-import-file"
                  className="text-ellipsis overflow-hidden"
                  value={field.value}
                  onValueChange={field.onChange}
                  maxFileCount={1}
                  showFolderTab={false}
                  accept={{ '*.json': [FileMimeType.Json] }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
