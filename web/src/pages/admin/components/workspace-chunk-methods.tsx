import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Blocks } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import message from '@/components/ui/message';
import { Switch } from '@/components/ui/switch';
import {
  listWorkspaceChunkMethods,
  updateWorkspaceChunkMethod,
} from '@/services/admin-service';

export function WorkspaceChunkMethods({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['admin/workspaceChunkMethods', workspaceId];
  const { data: methods = [], isFetching } = useQuery({
    queryKey,
    queryFn: async () =>
      (await listWorkspaceChunkMethods(workspaceId!)).data.data,
    enabled: Boolean(workspaceId),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({
      parserId,
      enabled,
    }: {
      parserId: string;
      enabled: boolean;
    }) => updateWorkspaceChunkMethod(workspaceId!, parserId, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      message.success(t('admin.chunkMethodVisibility.updated'));
    },
  });

  return (
    <section className="border-b border-border-button py-5">
      <div className="mb-1 text-sm font-medium">
        {t('admin.chunkMethodVisibility.title')}
      </div>
      <p className="mb-3 text-xs text-text-secondary">
        {t('admin.chunkMethodVisibility.description')}
      </p>
      <div className="space-y-2">
        {methods.map((method) => (
          <div
            className="flex items-center gap-3 rounded-md border border-border-button px-4 py-3"
            key={method.parser_id}
          >
            <Blocks className="size-4 shrink-0 text-text-secondary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {t(
                  `knowledgeConfiguration.parserLabel.${method.parser_id}`,
                  method.label,
                )}
              </div>
              <div className="text-xs text-text-secondary">
                {t('admin.chunkMethodVisibility.methodDescription')}
              </div>
            </div>
            <Switch
              aria-label={method.label}
              checked={method.enabled}
              disabled={isFetching || mutation.isPending}
              onCheckedChange={(enabled) =>
                mutation.mutate({ parserId: method.parser_id, enabled })
              }
            />
          </div>
        ))}
        {!isFetching && methods.length === 0 && (
          <div className="text-sm text-text-secondary">
            {t('admin.chunkMethodVisibility.empty')}
          </div>
        )}
      </div>
    </section>
  );
}
