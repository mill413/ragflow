import {
  useFetchTenantInfo,
  useFetchUserInfo,
  useListTenant,
} from '@/hooks/use-user-setting-request';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const WorkspaceStorageKey = 'activeWorkspaceId';
const WorkspaceChangeEvent = 'ragflow-workspace-change';

export const useWorkspace = () => {
  const { t } = useTranslation();
  const { data: user } = useFetchUserInfo();
  const { data: personal } = useFetchTenantInfo();
  const { data: teams } = useListTenant();
  const options = useMemo(
    () =>
      [
        {
          value: personal.tenant_id,
          label: t('knowledgeList.personalWorkspace', {
            name:
              user.nickname ||
              user.email ||
              personal.name ||
              t('setting.workspace'),
          }),
          type: 'personal' as const,
          capabilities: { create_shared_resource: true },
        },
        ...teams.map((team) => ({
          value: team.tenant_id,
          label: t('knowledgeList.teamWorkspace', {
            name: team.name || team.nickname,
          }),
          type: 'team' as const,
          capabilities: team.capabilities,
        })),
      ].filter((item) => Boolean(item.value)),
    [personal, teams, t, user.email, user.nickname],
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
    canCreateSharedResource: Boolean(
      selected?.capabilities?.create_shared_resource,
    ),
    options,
    setWorkspaceId,
  };
};
