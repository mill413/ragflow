import {
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  Activity,
  Building2,
  CalendarPlus,
  Clock3,
  EyeOff,
  Gauge,
  KeyRound,
  Languages,
  LogIn,
  LucidePencil,
  ShieldCheck,
  StickyNote,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import message from '@/components/ui/message';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  getUserDetails,
  listDepartments,
  listUserResources,
  updateUser,
  updateUserQuota,
} from '@/services/admin-service';
import { rsaPsw } from '@/utils';
import { formatDate } from '@/utils/date';
import { isValidPassword } from '@/utils/password';

import { TableEmpty } from '@/components/table-skeleton';
import EnterpriseFeature from './components/enterprise-feature';
import DepartmentTreeSelect from './components/department-tree-select';
import { UserStatusBadge, UserStatusText } from './components/user-status';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';
import { CurrentUserInfoContext } from './layouts/root-layout';
import { getSortIcon, parseBooleanish } from './utils';
import { DetailInformationCard } from './components/detail-information-card';
import { AdminDetailTabsTrigger } from './components/detail-tabs-trigger';
import { StorageSize } from './components/storage-size';
import {
  AdminFileTreeName,
  type AdminFileTreeRow,
  buildAdminFileTreeRows,
} from './components/file-tree';
import { UserModelConfiguration } from './components/user-model-configuration';
import {
  ResourceQuotaCards,
  ResourceQuotaDialog,
} from './components/resource-quota';
import { WorkspaceChunkMethods } from './components/workspace-chunk-methods';

export const WORKSPACE_RESOURCE_TYPES: AdminService.ManagedResourceType[] = [
  'dataset',
  'chat',
  'search',
  'agent',
  'memory',
  'file',
];
type ResourceColumn = {
  key: keyof AdminService.ManagedResourceItem;
  label: string;
  numeric?: boolean;
  render: (resource: AdminService.ManagedResourceItem) => ReactNode;
};

type SortState = {
  key: keyof AdminService.ManagedResourceItem;
  direction: 'asc' | 'desc';
};

function workspaceLabel(
  resource: AdminService.ManagedResourceItem,
  t: ReturnType<typeof useTranslation>['t'],
) {
  return `${t(
    resource.workspace_type === 'team'
      ? 'admin.teamWorkspace'
      : 'admin.personalWorkspace',
  )}-${resource.workspace_name}`;
}

export function WorkspaceResourceTable({
  data,
  resourceType,
}: {
  data: AdminService.ManagedResourceItem[];
  resourceType: AdminService.ManagedResourceType;
}) {
  const { t } = useTranslation();
  const [nameFilters, setNameFilters] = useState<string[]>([]);
  const [workspaceFilters, setWorkspaceFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<SortState>({
    key: 'update_date',
    direction: 'desc',
  });
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (resourceType !== 'file') return;
    const rootIds = data
      .filter((resource) => resource.parent_id === resource.id)
      .map((resource) => resource.id);
    setExpandedFileIds((current) => {
      if (rootIds.every((id) => current.has(id))) return current;
      return new Set([...current, ...rootIds]);
    });
  }, [data, resourceType]);

  const columns = useMemo<ResourceColumn[]>(() => {
    const commonColumns: ResourceColumn[] = [
      {
        key: 'name',
        label: t('admin.name'),
        render: (resource) => resource.name,
      },
      {
        key: 'workspace_name',
        label: t('admin.workspaceOwner'),
        render: (resource) => workspaceLabel(resource, t),
      },
    ];
    const updatedAt: ResourceColumn = {
      key: 'update_date',
      label: t('admin.lastUpdateTime'),
      render: (resource) => formatDate(resource.update_date) || '-',
    };

    switch (resourceType) {
      case 'dataset':
        return [
          ...commonColumns,
          {
            key: 'doc_num',
            label: t('admin.knowledgeMonitoring.documentCount'),
            numeric: true,
            render: (resource) => resource.doc_num ?? 0,
          },
          {
            key: 'chunk_num',
            label: t('admin.knowledgeMonitoring.chunkCount'),
            numeric: true,
            render: (resource) => resource.chunk_num ?? 0,
          },
          {
            key: 'storage_bytes',
            label: t('admin.knowledgeMonitoring.storage'),
            numeric: true,
            render: (resource) => (
              <StorageSize bytes={resource.storage_bytes ?? 0} />
            ),
          },
          updatedAt,
        ];
      case 'chat':
        return [
          ...commonColumns,
          {
            key: 'dataset_count',
            label: t('admin.resourceManagementPage.referencedDatasets'),
            numeric: true,
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'session_count',
            label: t('admin.resourceManagementPage.sessions'),
            numeric: true,
            render: (resource) => resource.session_count ?? 0,
          },
          updatedAt,
        ];
      case 'search':
        return [
          ...commonColumns,
          {
            key: 'dataset_count',
            label: t('admin.resourceManagementPage.referencedDatasets'),
            numeric: true,
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'document_count',
            label: t('admin.resourceManagementPage.referencedDocuments'),
            numeric: true,
            render: (resource) => resource.document_count ?? 0,
          },
          {
            key: 'creator_name',
            label: t('admin.creator'),
            render: (resource) => resource.creator_name || '-',
          },
          updatedAt,
        ];
      case 'agent':
        return [
          ...commonColumns,
          {
            key: 'canvas_type',
            label: t('admin.resourceManagementPage.canvasType'),
            render: (resource) => resource.canvas_type || '-',
          },
          {
            key: 'release',
            label: t('admin.resourceManagementPage.releaseStatus'),
            render: (resource) => (
              <Badge variant={resource.release ? 'success' : 'secondary'}>
                {t(
                  resource.release
                    ? 'admin.resourceManagementPage.released'
                    : 'admin.resourceManagementPage.unreleased',
                )}
              </Badge>
            ),
          },
          {
            key: 'session_count',
            label: t('admin.resourceManagementPage.sessions'),
            numeric: true,
            render: (resource) => resource.session_count ?? 0,
          },
          updatedAt,
        ];
      case 'memory':
        return [
          ...commonColumns,
          {
            key: 'memory_type',
            label: t('admin.resourceManagementPage.memoryType'),
            render: (resource) => resource.memory_type ?? '-',
          },
          {
            key: 'storage_type',
            label: t('admin.resourceManagementPage.storageType'),
            render: (resource) => resource.storage_type || '-',
          },
          {
            key: 'memory_size',
            label: t('admin.resourceManagementPage.capacity'),
            numeric: true,
            render: (resource) => (
              <StorageSize bytes={resource.memory_size ?? 0} />
            ),
          },
          updatedAt,
        ];
      case 'file':
        return [
          ...commonColumns,
          {
            key: 'file_type',
            label: t('admin.resourceManagementPage.fileType'),
            render: (resource) => resource.file_type || '-',
          },
          {
            key: 'size',
            label: t('admin.knowledgeMonitoring.fileSize'),
            numeric: true,
            render: (resource) => <StorageSize bytes={resource.size ?? 0} />,
          },
          {
            key: 'creator_name',
            label: t('admin.creator'),
            render: (resource) => resource.creator_name || '-',
          },
          updatedAt,
        ];
    }
  }, [resourceType, t]);

  const filteredData = useMemo(
    () =>
      data.filter(
        (resource) =>
          matchesSelectedFilter(resource.name, nameFilters) &&
          matchesSelectedFilter(workspaceLabel(resource, t), workspaceFilters),
      ),
    [data, nameFilters, t, workspaceFilters],
  );
  const sortedData = useMemo(
    () =>
      [...filteredData].sort((left, right) => {
        const leftValue = left[sort.key];
        const rightValue = right[sort.key];
        const result = String(leftValue ?? '').localeCompare(
          String(rightValue ?? ''),
          undefined,
          { numeric: true },
        );
        return sort.direction === 'asc' ? result : -result;
      }),
    [filteredData, sort],
  );
  const filtersActive = nameFilters.length > 0 || workspaceFilters.length > 0;
  const fileRows = useMemo(
    () =>
      resourceType === 'file'
        ? buildAdminFileTreeRows(data, {
            sort,
            expandedIds: expandedFileIds,
            matches: (resource) =>
              matchesSelectedFilter(resource.name, nameFilters) &&
              matchesSelectedFilter(
                workspaceLabel(resource, t),
                workspaceFilters,
              ),
            expandMatches: filtersActive,
          })
        : [],
    [
      data,
      expandedFileIds,
      filtersActive,
      nameFilters,
      resourceType,
      sort,
      t,
      workspaceFilters,
    ],
  );
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = useMemo<AdminFileTreeRow[]>(
    () =>
      resourceType === 'file'
        ? fileRows
        : sortedData
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((resource) => ({
              resource,
              depth: 0,
              hasChildren: false,
              expanded: false,
              workspaceRoot: false,
            })),
    [currentPage, fileRows, pageSize, resourceType, sortedData],
  );
  const toggleSort = (key: keyof AdminService.ManagedResourceItem) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const resetFilters = () => {
    setNameFilters([]);
    setWorkspaceFilters([]);
    setPage(1);
  };
  const toggleFileExpanded = (resourceId: string) => {
    setExpandedFileIds((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  return (
    <section className="min-w-0 w-full space-y-4 overflow-hidden [contain:inline-size]">
      <AdminTableMultiFilters
        filters={[
          {
            id: `${resourceType}-name`,
            label: t('admin.name'),
            options: createFilterOptions(data, (resource) => resource.name),
            value: nameFilters,
            onChange: (value) => {
              setNameFilters(value);
              setPage(1);
            },
          },
          {
            id: `${resourceType}-workspace`,
            label: t('admin.workspaceOwner'),
            options: createFilterOptions(data, (resource) =>
              workspaceLabel(resource, t),
            ),
            value: workspaceFilters,
            onChange: (value) => {
              setWorkspaceFilters(value);
              setPage(1);
            },
          },
        ]}
        resetLabel={t('admin.reset')}
        onReset={resetFilters}
      />
      <Table
        rootClassName="max-w-full [contain:inline-size]"
        className="min-w-[900px]"
      >
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={column.numeric ? 'text-center' : undefined}
              >
                <Button variant="ghost" onClick={() => toggleSort(column.key)}>
                  {column.label}
                  {getSortIcon(
                    sort.key === column.key ? sort.direction : false,
                  )}
                </Button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.resource.id}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={column.numeric ? 'text-center' : undefined}
                  >
                    {resourceType === 'file' && column.key === 'name' ? (
                      <AdminFileTreeName
                        row={row}
                        onToggle={toggleFileExpanded}
                      />
                    ) : (
                      column.render(row.resource)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmpty columnsLength={columns.length} />
          )}
        </TableBody>
      </Table>
      {resourceType !== 'file' && (
        <RAGFlowPagination
          total={filteredData.length}
          current={currentPage}
          pageSize={pageSize}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
        />
      )}
    </section>
  );
}

type UserDetailSheetProps = {
  email?: string;
  onOpenChange: (open: boolean) => void;
};

function UserDetailSheet({ email, onOpenChange }: UserDetailSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [{ userInfo }] = useContext(CurrentUserInfoContext);
  const [editOpen, setEditOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: '',
    password: '',
    departmentId: '',
    isActive: true,
    isSuperuser: false,
    remark: '',
  });

  const { data: { detail, resources } = {} } = useQuery({
    queryKey: ['admin/userDetail', email],
    queryFn: async () => {
      const [userDetails, userResources] = await Promise.all([
        getUserDetails(email!),
        listUserResources(email!),
      ]);

      return {
        detail: userDetails.data.data[0],
        resources: userResources.data.data,
      };
    },
    enabled: Boolean(email),
    retry: false,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['admin/departments'],
    queryFn: async () => (await listDepartments()).data.data,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateUser(email!, {
        nickname: editForm.nickname.trim(),
        password: isValidPassword(editForm.password)
          ? (rsaPsw(editForm.password) as string)
          : undefined,
        departmentId: editForm.departmentId || null,
        isActive: editForm.isActive,
        isSuperuser: editForm.isSuperuser,
        remark: editForm.remark.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
      queryClient.invalidateQueries({ queryKey: ['admin/userDetail'] });
      message.success(t('admin.userUpdated'));
      setEditOpen(false);
    },
  });
  const quotaMutation = useMutation({
    mutationFn: (quota: AdminService.ResourceQuotaLimits) =>
      updateUserQuota(email!, quota),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/userDetail'] });
      message.success(t('admin.resourceQuota.updated'));
      setQuotaOpen(false);
    },
  });
  const openEdit = () => {
    if (!detail) return;
    setEditForm({
      nickname: detail.nickname || '',
      password: '',
      departmentId: detail.department_id || '',
      isActive: parseBooleanish(detail.is_active),
      isSuperuser: detail.is_superuser,
      remark: detail.remark || '',
    });
    setEditOpen(true);
  };
  const isMe = detail?.email === userInfo?.email;
  const informationItems: Array<{
    label: string;
    value: ReactNode;
    icon: LucideIcon;
  }> = [
    {
      label: t('admin.nickname'),
      value: detail?.nickname || '-',
      icon: UserRound,
    },
    {
      label: t('admin.department'),
      value: detail?.department_path || t('admin.noDepartment'),
      icon: Building2,
    },
    {
      label: t('admin.status'),
      value: <UserStatusBadge active={detail?.is_active} />,
      icon: Activity,
    },
    {
      label: t('admin.userType'),
      value: (
        <Badge variant="secondary">
          {t(detail?.is_superuser ? 'admin.superuser' : 'admin.normalUser')}
        </Badge>
      ),
      icon: ShieldCheck,
    },
    {
      label: t('admin.password'),
      value: detail?.password_plain || '-',
      icon: KeyRound,
    },
    {
      label: t('admin.lastLoginTime'),
      value: formatDate(detail?.last_login_time) || '-',
      icon: LogIn,
    },
    {
      label: t('admin.createTime'),
      value: formatDate(detail?.create_date) || '-',
      icon: CalendarPlus,
    },
    {
      label: t('admin.lastUpdateTime'),
      value: formatDate(detail?.update_date) || '-',
      icon: Clock3,
    },
    {
      label: t('admin.language'),
      value: detail?.language || '-',
      icon: Languages,
    },
    {
      label: t('admin.isAnonymous'),
      value: t(
        parseBooleanish(detail?.is_anonymous) ? 'admin.yes' : 'admin.no',
      ),
      icon: EyeOff,
    },
  ];

  return (
    <>
      <Sheet
        open={Boolean(email)}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false);
          if (!open) setQuotaOpen(false);
          onOpenChange(open);
        }}
      >
        <SheetContent className="w-[min(900px,80vw)] max-w-none overflow-hidden p-0">
          <SheetHeader className="border-b border-border-button px-6 py-5">
            <div className="flex items-center gap-3 pr-8">
              <RAGFlowAvatar
                avatar={detail?.avatar}
                name={detail?.email || email}
                isPerson
              />
              <div className="min-w-0">
                <SheetTitle className="truncate">
                  {detail?.nickname || detail?.email || email}
                </SheetTitle>
                <SheetDescription className="truncate">
                  {detail?.email || email}
                  {detail?.id ? ` · ${detail.id}` : ''}
                </SheetDescription>
              </div>
              <EnterpriseFeature>
                {() =>
                  detail?.role && (
                    <Badge className="shrink-0" variant="secondary">
                      {detail.role}
                    </Badge>
                  )
                }
              </EnterpriseFeature>
              <Button
                className="ml-auto shrink-0"
                variant="outline"
                disabled={!detail}
                onClick={() => setQuotaOpen(true)}
              >
                <Gauge />
                {t('admin.resourceQuota.configure')}
              </Button>
              <Button
                className="shrink-0"
                variant="outline"
                disabled={!detail}
                onClick={openEdit}
              >
                <LucidePencil />
                {t('admin.editUser')}
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-97px)] min-w-0 px-6">
            <section className="border-b border-border-button py-5">
              <div className="mb-3 text-sm font-medium">
                {t('admin.userInformation')}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {informationItems.map(({ label, value, icon }) => (
                  <DetailInformationCard
                    key={label}
                    label={label}
                    value={value}
                    icon={icon}
                  />
                ))}
              </div>
              {detail?.remark && (
                <DetailInformationCard
                  className="mt-3"
                  icon={StickyNote}
                  label={t('admin.remark')}
                  value={detail.remark}
                  valueClassName="whitespace-pre-wrap font-normal"
                />
              )}
            </section>

            <section className="border-b border-border-button py-5">
              <div className="mb-3 text-sm font-medium">
                {t('admin.resourceQuota.title')}
              </div>
              <ResourceQuotaCards quota={detail?.quota} scopeType="personal" />
            </section>

            <WorkspaceChunkMethods workspaceId={detail?.id} />

            <section className="min-w-0 py-5">
              <Tabs
                className="min-w-0 w-full [contain:inline-size]"
                defaultValue="dataset"
              >
                <TabsList className="mb-4 h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                  {WORKSPACE_RESOURCE_TYPES.map((resourceType) => (
                    <AdminDetailTabsTrigger
                      key={resourceType}
                      value={resourceType}
                    >
                      {t(`admin.resourceType.${resourceType}`)}
                      <Badge className="ml-1" variant="secondary">
                        {resources?.[resourceType]?.length ?? 0}
                      </Badge>
                    </AdminDetailTabsTrigger>
                  ))}
                  <AdminDetailTabsTrigger value="model">
                    {t('admin.userModelConfiguration')}
                    <Badge className="ml-1" variant="secondary">
                      {(resources?.model?.defaults.filter(
                        (model) => model.model_name,
                      ).length ?? 0) + (resources?.model?.models.length ?? 0)}
                    </Badge>
                  </AdminDetailTabsTrigger>
                </TabsList>

                {WORKSPACE_RESOURCE_TYPES.map((resourceType) => (
                  <TabsContent key={resourceType} value={resourceType}>
                    <WorkspaceResourceTable
                      data={resources?.[resourceType] ?? []}
                      resourceType={resourceType}
                    />
                  </TabsContent>
                ))}
                <TabsContent value="model">
                  <UserModelConfiguration configuration={resources?.model} />
                </TabsContent>
              </Tabs>
            </section>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('admin.editUser')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 px-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('admin.nickname')}</Label>
              <Input
                value={editForm.nickname}
                onChange={(event) =>
                  setEditForm((form) => ({
                    ...form,
                    nickname: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.department')}</Label>
              <DepartmentTreeSelect
                departments={departments}
                value={editForm.departmentId}
                placeholder={t('admin.noDepartment')}
                onChange={(departmentId) =>
                  setEditForm((form) => ({ ...form, departmentId }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.status')}</Label>
              <Select
                disabled={isMe}
                value={editForm.isActive ? 'active' : 'inactive'}
                onValueChange={(value) =>
                  setEditForm((form) => ({
                    ...form,
                    isActive: value === 'active',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <UserStatusText active />
                  </SelectItem>
                  <SelectItem value="inactive">
                    <UserStatusText active={false} />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.userType')}</Label>
              <Select
                disabled={isMe}
                value={editForm.isSuperuser ? 'admin' : 'user'}
                onValueChange={(value) =>
                  setEditForm((form) => ({
                    ...form,
                    isSuperuser: value === 'admin',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('admin.superuser')}</SelectItem>
                  <SelectItem value="user">{t('admin.normalUser')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('admin.password')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t('admin.passwordUnchangedPlaceholder')}
                value={editForm.password}
                onChange={(event) =>
                  setEditForm((form) => ({
                    ...form,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('admin.remark')}</Label>
              <Textarea
                rows={3}
                value={editForm.remark}
                onChange={(event) =>
                  setEditForm((form) => ({
                    ...form,
                    remark: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {t('admin.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResourceQuotaDialog
        open={quotaOpen}
        quota={detail?.quota}
        scopeType="personal"
        saving={quotaMutation.isPending}
        onOpenChange={setQuotaOpen}
        onSave={(quota) => quotaMutation.mutate(quota)}
      />
    </>
  );
}

export default UserDetailSheet;
