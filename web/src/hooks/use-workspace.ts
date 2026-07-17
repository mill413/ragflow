import {
  useFetchTenantInfo,
  useListTenant,
} from '@/hooks/use-user-setting-request';
import { useCallback, useEffect, useMemo, useState } from 'react';

const WorkspaceStorageKey = 'activeWorkspaceId';
const WorkspaceChangeEvent = 'ragflow-workspace-change';

export const useWorkspace = () => {
  const { data: personal } = useFetchTenantInfo();
  const { data: teams } = useListTenant();
  const options = useMemo(
    () =>
      [
        {
          value: personal.tenant_id,
          label: personal.name || '个人空间',
          type: 'personal' as const,
        },
        ...teams.map((team) => ({
          value: team.tenant_id,
          label: team.name || team.nickname,
          type: 'team' as const,
        })),
      ].filter((item) => Boolean(item.value)),
    [personal, teams],
  );
  const [workspaceId, setWorkspaceIdState] = useState(
    () => localStorage.getItem(WorkspaceStorageKey) || '',
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
  return {
    workspaceId: selected?.value || '',
    workspaceType: selected?.type || 'personal',
    options,
    setWorkspaceId,
  };
};
