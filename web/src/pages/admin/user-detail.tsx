import { type ReactNode, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Activity,
  Building2,
  CalendarPlus,
  Clock3,
  EyeOff,
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
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  listUserAgents,
  listUserDatasets,
  updateUser,
} from '@/services/admin-service';
import { rsaPsw } from '@/utils';
import { formatDate } from '@/utils/date';

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

const ASSET_NAMES = ['dataset', 'flow'];

const datasetColumnHelper =
  createColumnHelper<AdminService.ListUserDatasetItem>();
const agentColumnHelper = createColumnHelper<AdminService.ListUserAgentItem>();

function UserDatasetTable(props: {
  data?: AdminService.ListUserDatasetItem[];
}) {
  const { t } = useTranslation();
  const [nameFilters, setNameFilters] = useState<string[]>([]);
  const filteredData = (props.data ?? []).filter((dataset) =>
    matchesSelectedFilter(dataset.name, nameFilters),
  );

  const columnDefs = useMemo(
    () => [
      datasetColumnHelper.accessor('name', {
        header: t('admin.name'),
        cell: ({ row, cell }) => (
          <div className="flex items-center gap-2">
            <RAGFlowAvatar
              avatar={row.original.avatar}
              name={cell.getValue()}
            />
            <span>{cell.getValue()}</span>
          </div>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: filteredData,
    columns: columnDefs,

    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
      <AdminTableMultiFilters
        filters={[
          {
            id: 'dataset-name',
            label: t('admin.name'),
            options: createFilterOptions(
              props.data ?? [],
              (dataset) => dataset.name,
            ),
            value: nameFilters,
            onChange: setNameFilters,
          },
        ]}
        resetLabel={t('admin.reset')}
        onReset={() => setNameFilters([])}
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {getSortIcon(header.column.getIsSorted())}
                    </Button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmpty columnsLength={columnDefs.length} />
          )}
        </TableBody>
      </Table>

      <RAGFlowPagination
        total={filteredData.length}
        current={table.getState().pagination.pageIndex + 1}
        pageSize={table.getState().pagination.pageSize}
        onChange={(page, pageSize) => {
          table.setPagination({
            pageIndex: page - 1,
            pageSize,
          });
        }}
      />
    </section>
  );
}

function UserAgentTable(props: { data?: AdminService.ListUserAgentItem[] }) {
  const { t } = useTranslation();
  const [titleFilters, setTitleFilters] = useState<string[]>([]);
  const filteredData = (props.data ?? []).filter((agent) =>
    matchesSelectedFilter(agent.title, titleFilters),
  );

  const columnDefs = useMemo(
    () => [
      agentColumnHelper.accessor('title', {
        header: t('admin.agentTitle'),
        cell: ({ row, cell }) => (
          <div className="flex items-center gap-2">
            <RAGFlowAvatar
              avatar={row.original.avatar}
              name={cell.getValue()}
            />
            <span>{cell.getValue()}</span>
          </div>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: filteredData,
    columns: columnDefs,

    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
      <AdminTableMultiFilters
        filters={[
          {
            id: 'agent-title',
            label: t('admin.agentTitle'),
            options: createFilterOptions(
              props.data ?? [],
              (agent) => agent.title,
            ),
            value: titleFilters,
            onChange: setTitleFilters,
          },
        ]}
        resetLabel={t('admin.reset')}
        onReset={() => setTitleFilters([])}
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {getSortIcon(header.column.getIsSorted())}
                    </Button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmpty columnsLength={columnDefs.length} />
          )}
        </TableBody>
      </Table>

      <RAGFlowPagination
        total={filteredData.length}
        current={table.getState().pagination.pageIndex + 1}
        pageSize={table.getState().pagination.pageSize}
        onChange={(page, pageSize) => {
          table.setPagination({
            pageIndex: page - 1,
            pageSize,
          });
        }}
      />
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
  const [editForm, setEditForm] = useState({
    nickname: '',
    password: '',
    departmentId: '',
    isActive: true,
    isSuperuser: false,
    remark: '',
  });

  const { data: { detail, datasets, agents } = {} } = useQuery({
    queryKey: ['admin/userDetail', email],
    queryFn: async () => {
      const [userDetails, userDatasets, userAgents] = await Promise.all([
        getUserDetails(email!),
        listUserDatasets(email!),
        listUserAgents(email!),
      ]);

      return {
        detail: userDetails.data.data[0],
        datasets: userDatasets.data.data,
        agents: userAgents.data.data,
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
        password: editForm.password
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
          onOpenChange(open);
        }}
      >
        <SheetContent className="w-[min(900px,80vw)] max-w-none p-0">
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
                onClick={openEdit}
              >
                <LucidePencil />
                {t('admin.editUser')}
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-97px)] px-6">
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

            <section className="py-5">
              <Tabs defaultValue="dataset">
                <TabsList className="mb-4 justify-start gap-4 bg-transparent p-0">
                  {ASSET_NAMES.map((name) => (
                    <TabsTrigger
                      key={name}
                      className="border-0.5 border-border-button text-text-secondary data-[state=active]:bg-bg-card"
                      value={name}
                    >
                      {t(`header.${name}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="dataset">
                  <UserDatasetTable data={datasets} />
                </TabsContent>

                <TabsContent value="flow">
                  <UserAgentTable data={agents} />
                </TabsContent>
              </Tabs>
            </section>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
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
    </>
  );
}

export default UserDetailSheet;
