import { BulkOperateBar } from '@/components/bulk-operate-bar';
import { FileUploadDialog } from '@/components/file-upload-dialog';
import ListFilterBar from '@/components/list-filter-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRowSelection } from '@/hooks/logic-hooks/use-row-selection';
import { useFetchFileList, useFileWorkspace } from '@/hooks/use-file-request';
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { Routes } from '@/routes';
import { LucidePlus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { CreateFolderDialog } from './create-folder-dialog';
import { FileBreadcrumb } from './file-breadcrumb';
import { FilesTable } from './files-table';
import {
  useHandleConnectToKnowledge,
  UseHandleConnectToKnowledgeReturnType,
} from './hooks';
import { MoveDialog } from './move-dialog';
import { useBulkOperateFile } from './use-bulk-operate-file';
import { useHandleCreateFolder } from './use-create-folder';
import { useHandleMoveFile } from './use-move-file';
import { useSelectBreadcrumbItems } from './use-navigate-to-folder';
import { useHandleUploadFile } from './use-upload-file';

export default function Files() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: userInfo } = useFetchUserInfo();
  const { workspaceId, targetWorkspace, isWorkspaceOverview } =
    useFileWorkspace();
  const previousWorkspaceId = useRef(workspaceId);
  const canManageFiles =
    !isWorkspaceOverview &&
    targetWorkspace?.type === 'personal' &&
    targetWorkspace.value === userInfo.id;

  useEffect(() => {
    if (previousWorkspaceId.current !== workspaceId) {
      previousWorkspaceId.current = workspaceId;
      navigate(Routes.Files, { replace: true });
    }
  }, [navigate, workspaceId]);
  const {
    fileUploadVisible,
    hideFileUploadModal,
    showFileUploadModal,
    fileUploadLoading,
    onFileUploadOk,
  } = useHandleUploadFile();

  const {
    folderCreateModalVisible,
    showFolderCreateModal,
    hideFolderCreateModal,
    folderCreateLoading,
    onFolderCreateOk,
  } = useHandleCreateFolder();

  const {
    pagination,
    files,
    total,
    loading,
    setPagination,
    searchString,
    handleInputChange,
  } = useFetchFileList();

  const {
    rowSelection,
    setRowSelection,
    rowSelectionIsEmpty,
    clearRowSelection,
    selectedCount,
  } = useRowSelection();

  const {
    showMoveFileModal,
    moveFileVisible,
    onMoveFileOk,
    hideMoveFileModal,
    moveFileLoading,
  } = useHandleMoveFile({ clearRowSelection });

  const connectKnowledgeModal: UseHandleConnectToKnowledgeReturnType =
    useHandleConnectToKnowledge();

  const { list } = useBulkOperateFile({
    files,
    rowSelection,
    showMoveFileModal,
    setRowSelection,
    showConnectToKnowledgeModal:
      connectKnowledgeModal.showConnectToKnowledgeModal,
  });

  const breadcrumbItems = useSelectBreadcrumbItems();

  const leftPanel = (
    <div>
      {breadcrumbItems.length > 0 ? (
        <FileBreadcrumb></FileBreadcrumb>
      ) : (
        t('fileManager.files')
      )}
    </div>
  );

  return (
    <article
      className="size-full min-w-0 flex flex-col"
      data-testid="files-list"
    >
      <header className="mb-4 min-w-0 px-5 pt-8">
        <ListFilterBar
          leftPanel={leftPanel}
          searchString={searchString}
          onSearchChange={handleInputChange}
          showFilter={false}
          icon={'file'}
        >
          {canManageFiles && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <LucidePlus />
                  {t('knowledgeDetails.addFile')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuItem onClick={showFileUploadModal}>
                  {t('fileManager.uploadFile')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={showFolderCreateModal}>
                  {t('fileManager.newFolder')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </ListFilterBar>

        {!rowSelectionIsEmpty && (
          <BulkOperateBar className="mt-4" list={list} count={selectedCount} />
        )}
      </header>

      <div className="flex-1 px-5 flex flex-col overflow-hidden">
        <FilesTable
          files={files}
          total={total}
          pagination={pagination}
          setPagination={setPagination}
          loading={loading}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          showMoveFileModal={showMoveFileModal}
          connectKnowledgeModal={connectKnowledgeModal}
          readOnly={!canManageFiles}
        />
      </div>

      {fileUploadVisible && (
        <FileUploadDialog
          hideModal={hideFileUploadModal}
          onOk={onFileUploadOk}
          loading={fileUploadLoading}
        ></FileUploadDialog>
      )}
      {folderCreateModalVisible && (
        <CreateFolderDialog
          loading={folderCreateLoading}
          visible={folderCreateModalVisible}
          hideModal={hideFolderCreateModal}
          onOk={onFolderCreateOk}
        ></CreateFolderDialog>
      )}
      {moveFileVisible && (
        <MoveDialog
          hideModal={hideMoveFileModal}
          onOk={onMoveFileOk}
          loading={moveFileLoading}
        ></MoveDialog>
      )}
    </article>
  );
}
