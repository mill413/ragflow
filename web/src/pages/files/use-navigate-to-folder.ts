import {
  useFetchParentFolderList,
  useFileWorkspace,
} from '@/hooks/use-file-request';
import { Routes } from '@/routes';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

export const useNavigateToOtherFolder = () => {
  const navigate = useNavigate();
  const { isAllWorkspaces, isRouteWorkspace, targetWorkspaceId } =
    useFileWorkspace();

  const navigateToOtherFolder = useCallback(
    (folderId: string) => {
      const search = new URLSearchParams({ folderId });
      if ((isAllWorkspaces || isRouteWorkspace) && targetWorkspaceId) {
        search.set('workspaceId', targetWorkspaceId);
      }
      navigate(`${Routes.Files}?${search.toString()}`);
    },
    [isAllWorkspaces, isRouteWorkspace, navigate, targetWorkspaceId],
  );

  return navigateToOtherFolder;
};

export const useSelectBreadcrumbItems = () => {
  const parentFolderList = useFetchParentFolderList();
  const { t } = useTranslation();
  const {
    isAllWorkspaces,
    isRouteWorkspace,
    targetWorkspace,
    targetWorkspaceId,
  } = useFileWorkspace();

  const workspaceSearch =
    (isAllWorkspaces || isRouteWorkspace) && targetWorkspaceId
      ? `workspaceId=${encodeURIComponent(targetWorkspaceId)}`
      : '';
  const breadcrumbFolders = (
    parentFolderList.length === 1 ? [] : parentFolderList
  ).filter((folder) => !isAllWorkspaces || folder.name !== '/');
  const folderItems = breadcrumbFolders.map((folder) => ({
    title: folder.name === '/' ? 'root' : folder.name,
    path: `${Routes.Files}?${workspaceSearch ? `${workspaceSearch}&` : ''}folderId=${folder.id}`,
  }));

  if (isAllWorkspaces && targetWorkspace) {
    return [
      {
        title: t('knowledgeList.allWorkspaces'),
        path: Routes.Files,
      },
      {
        title: targetWorkspace.label,
        path: `${Routes.Files}?${workspaceSearch}`,
      },
      ...folderItems,
    ];
  }

  return folderItems;
};
