import { CardContainer } from '@/components/card-container';
import { EmptyCardType } from '@/components/empty/constant';
import { EmptyAppCard } from '@/components/empty/empty';
import ListFilterBar from '@/components/list-filter-bar';
import { Button } from '@/components/ui/button';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { WorkspaceTargetDialog } from '@/components/workspace-target-dialog';
import { useTranslate } from '@/hooks/common-hooks';
import { useWritableWorkspaceAction } from '@/hooks/use-workspace';
import { pick } from 'lodash';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AddOrEditModal } from './add-or-edit-modal';
import { defaultMemoryFields } from './constants';
import { useFetchMemoryList, useRenameMemory, useSelectFilters } from './hooks';
import { ICreateMemoryProps, IMemory } from './interface';
import { MemoryCard } from './memory-card';

export default function MemoryList() {
  const {
    canRunInWritableWorkspace,
    runInWritableWorkspace,
    workspaceDialogProps,
  } = useWritableWorkspaceAction('create_collaborative_resource');
  // const { data } = useFetchFlowList();
  const { t } = useTranslate('memories');
  const [addOrEditType, setAddOrEditType] = useState<'add' | 'edit'>('add');
  // const [isEdit, setIsEdit] = useState(false);
  const {
    data: list,
    pagination,
    searchString,
    handleInputChange,
    setPagination,
    refetch: refetchList,
    filterValue,
    handleFilterSubmit,
  } = useFetchMemoryList();

  const {
    openCreateModal,
    showMemoryRenameModal,
    hideMemoryModal,
    searchRenameLoading,
    onMemoryRenameOk,
    initialMemory,
  } = useRenameMemory();

  const onMemoryConfirm = (data: ICreateMemoryProps) => {
    onMemoryRenameOk(data, () => {
      refetchList();
    });
  };
  const openCreateModalFun = useCallback(() => {
    runInWritableWorkspace(() => {
      setAddOrEditType('add');
      showMemoryRenameModal(defaultMemoryFields as unknown as IMemory);
    });
  }, [runInWritableWorkspace, showMemoryRenameModal]);
  const handlePageChange = useCallback(
    (page: number, pageSize?: number) => {
      setPagination({ page, pageSize });
    },
    [setPagination],
  );

  const [searchUrl, setMemoryUrl] = useSearchParams();
  const { filters } = useSelectFilters();
  const isCreate = searchUrl.get('isCreate') === 'true';
  useEffect(() => {
    if (isCreate && canRunInWritableWorkspace) {
      openCreateModalFun();
      searchUrl.delete('isCreate');
      setMemoryUrl(searchUrl);
    }
  }, [
    isCreate,
    canRunInWritableWorkspace,
    openCreateModalFun,
    searchUrl,
    setMemoryUrl,
  ]);

  return (
    <>
      <WorkspaceTargetDialog {...workspaceDialogProps} />
      {list?.data?.memory_list?.length || searchString ? (
        <article
          className="size-full min-w-0 flex flex-col"
          data-testid="memory-list"
        >
          <header className="mb-4 min-w-0 px-5 pt-8">
            <ListFilterBar
              icon="memory"
              title={t('memory')}
              onSearchChange={handleInputChange}
              searchString={searchString}
              filters={filters}
              onChange={handleFilterSubmit}
              value={filterValue}
            >
              {canRunInWritableWorkspace && (
                <Button onClick={() => openCreateModalFun()}>
                  <Plus className="size-[1em]" />
                  {t('createMemory')}
                </Button>
              )}
            </ListFilterBar>
          </header>

          {list?.data?.memory_list?.length ? (
            <>
              <CardContainer className="flex-1 overflow-auto px-5">
                {list?.data.memory_list.map((x) => (
                  <MemoryCard
                    key={x.id}
                    data={x}
                    showMemoryRenameModal={() => {
                      setAddOrEditType('edit');
                      showMemoryRenameModal(x);
                    }}
                  />
                ))}
              </CardContainer>

              <footer className="mt-4 px-5 pb-5">
                <RAGFlowPagination
                  {...pick(pagination, 'current', 'pageSize')}
                  total={list?.data.total_count}
                  onChange={handlePageChange}
                />
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-5">
              <EmptyAppCard
                showIcon
                size="large"
                isSearch
                type={EmptyCardType.Memory}
                onClick={
                  canRunInWritableWorkspace
                    ? () => openCreateModalFun()
                    : undefined
                }
              />
            </div>
          )}
        </article>
      ) : (
        <article
          className="size-full min-w-0 flex items-center justify-center px-5"
          data-testid="memory-list"
        >
          <EmptyAppCard
            showIcon
            size="large"
            type={EmptyCardType.Memory}
            onClick={
              canRunInWritableWorkspace ? () => openCreateModalFun() : undefined
            }
          />
        </article>
      )}
      {/* {openCreateModal && (
        <RenameDialog
          hideModal={hideMemoryRenameModal}
          onOk={onMemoryRenameConfirm}
          initialName={initialMemoryName}
          loading={searchRenameLoading}
          title={<HomeIcon name="memory" width={'24'} />}
        ></RenameDialog>
      )} */}
      {openCreateModal && (
        <AddOrEditModal
          initialMemory={initialMemory}
          isCreate={addOrEditType === 'add'}
          open={openCreateModal}
          loading={searchRenameLoading}
          onClose={hideMemoryModal}
          onSubmit={onMemoryConfirm}
        />
      )}
    </>
  );
}
