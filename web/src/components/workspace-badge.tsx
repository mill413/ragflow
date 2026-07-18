import { SharedBadge } from '@/components/shared-badge';
import { IWorkspaceResource } from '@/interfaces/database/workspace';
import { useTranslation } from 'react-i18next';

export function WorkspaceBadge({
  workspace_type,
  workspace_name,
  creator_name,
}: Pick<
  IWorkspaceResource,
  'workspace_type' | 'workspace_name' | 'creator_name'
>) {
  const { t } = useTranslation();

  return (
    <SharedBadge>
      {workspace_type === 'team'
        ? t('knowledgeList.teamWorkspace', { name: workspace_name })
        : t('knowledgeList.personalWorkspace', {
            name: creator_name || workspace_name,
          })}
    </SharedBadge>
  );
}
