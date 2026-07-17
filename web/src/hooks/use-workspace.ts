import { useListWorkspace } from '@/hooks/use-user-setting-request';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const WorkspaceStorageKey = 'activeWorkspaceId';
const WorkspaceChangeEvent = 'ragflow-workspace-change';
export const AllWorkspacesId = '__all__';

export const useWorkspace = () => {
  const { t } = useTranslation();
  const { data: workspaces } = useListWorkspace();
  const options = useMemo(
    () => [
      {
        value: AllWorkspacesId,
        label: t('knowledgeList.allWorkspaces'),
        type: 'all' as const,
        capabilities: undefined,
      },
      ...workspaces.map((workspace) => ({
        value: workspace.tenant_id,
        label: t(
          workspace.workspace_type === 'team'
            ? 'knowledgeList.teamWorkspace'
            : 'knowledgeList.personalWorkspace',
          { name: workspace.name || t('setting.workspace') },
        ),
        type: workspace.workspace_type,
        capabilities: workspace.capabilities,
      })),
    ],
    [t, workspaces],
  );
  const [workspaceId, setWorkspaceIdState] = useState(
    () => localStorage.getItem(WorkspaceStorageKey) || AllWorkspacesId,
  );

  useEffect(() => {
    if (!options.length) return;
    if (!options.some((item) => item.value === workspaceId)) {
      setWorkspaceIdState(options[0].value);
      localStorage.setItem(WorkspaceStorageKey, options[0].value);
    }
  }, [options, workspaceId]);

  useEffect(() => {
    const sync = () =>
      setWorkspaceIdState(localStorage.getItem(WorkspaceStorageKey) || '');
    window.addEventListener(WorkspaceChangeEvent, sync);
    return () => window.removeEventListener(WorkspaceChangeEvent, sync);
  }, []);

  const setWorkspaceId = useCallback((value: string) => {
    localStorage.setItem(WorkspaceStorageKey, value);
    setWorkspaceIdState(value);
    window.dispatchEvent(new Event(WorkspaceChangeEvent));
  }, []);

  const selected =
    options.find((item) => item.value === workspaceId) || options[0];
  const isAllWorkspaces = selected?.value === AllWorkspacesId;
  return {
    workspaceId: selected?.value || AllWorkspacesId,
    workspaceFilterId: isAllWorkspaces ? undefined : selected?.value,
    workspaceType: selected?.type || 'all',
    isAllWorkspaces,
    canCreateSharedResource: Boolean(
      selected?.capabilities?.create_shared_resource,
    ),
    options,
    setWorkspaceId,
  };
};
