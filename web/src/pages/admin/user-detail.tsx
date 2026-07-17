import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { LucideArrowLeft, LucideDot, LucidePencil } from 'lucide-react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Routes } from '@/routes';

import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import Spotlight from '@/components/spotlight';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { CurrentUserInfoContext } from './layouts/root-layout';
import { getSortIcon, parseBooleanish } from './utils';

const ASSET_NAMES = ['dataset', 'flow'];

const datasetColumnHelper =
  createColumnHelper<AdminService.ListUserDatasetItem>();
const agentColumnHelper = createColumnHelper<AdminService.ListUserAgentItem>();

function UserDatasetTable(props: {
  data?: AdminService.ListUserDatasetItem[];
}) {
  const { t } = useTranslation();

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
      // #region
      /*
      datasetColumnHelper.accessor('name', {
        header: t('admin.name'),
        enableSorting: false,
      }),
      datasetColumnHelper.accessor('status', {
        header: t('admin.status'),
        cell: ({ cell }) => {
          return (
            <Badge
              variant={parseBooleanish(cell.getValue()) ? 'success' : 'destructive'}
              className="pl-[.35em]"
            >
              <LucideDot className="size-[1em] stroke-[8] mr-1" />
              {t(
                parseBooleanish(cell.getValue())
                  ? 'admin.active'
                  : 'admin.inactive',
              )}"
            </Badge>
          );
        },
        enableSorting: false,
      }),
      datasetColumnHelper.accessor('chunk_num', {
        header: t('admin.chunkNum'),
      }),
      datasetColumnHelper.accessor('doc_num', {
        header: t('admin.docNum'),
      }),
      datasetColumnHelper.accessor('token_num', {
        header: t('admin.tokenNum'),
      }),
      datasetColumnHelper.accessor('language', {
        header: t('admin.language'),
        enableSorting: false,
      }),
      datasetColumnHelper.accessor('create_date', {
        header: t('admin.createDate'),
      }),
      datasetColumnHelper.accessor('update_date', {
        header: t('admin.updateDate'),
      }),
      datasetColumnHelper.accessor('permission', {
        header: t('admin.permission'),
        enableSorting: false,
      }),
      */
      // #endregion
    ],
    [t],
  );

  const table = useReactTable({
    data: props.data ?? [],
    columns: columnDefs,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
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
        total={props.data?.length}
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
      // #region
      /*
      agentColumnHelper.accessor('title', {
        header: t('admin.agentTitle'),
      }),
      agentColumnHelper.accessor('permission', {
        header: t('admin.permission'),
      }),
      agentColumnHelper.accessor('canvas_category', {
        header: t('admin.canvasCategory'),
      }),
      */
      // #endregion
    ],
    [t],
  );

  const table = useReactTable({
    data: props.data ?? [],
    columns: columnDefs,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
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
        total={props.data?.length}
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

function AdminUserDetail() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
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
    queryKey: ['admin/userDetail', id],
    queryFn: async () => {
      const [userDetails, userDatasets, userAgents] = await Promise.all([
        getUserDetails(id!),
        listUserDatasets(id!),
        listUserAgents(id!),
      ]);

      return {
        detail: userDetails.data.data[0],
        datasets: userDatasets.data.data,
        agents: userAgents.data.data,
      };
    },
    enabled: !!id,
    retry: false,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['admin/departments'],
    queryFn: async () => (await listDepartments()).data.data,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateUser(id!, {
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

  return (
    <section className="px-10 py-5 size-full flex flex-col">
      <nav className="mb-5">
        <Button
          variant="outline"
          className="h-10 px-3 dark:bg-bg-input dark:border-border-button"
          onClick={() => navigate(`${Routes.AdminUserManagement}`)}
        >
          <LucideArrowLeft />
          <span>{t('admin.back')}</span>
        </Button>
      </nav>

      <Card className="!shadow-none relative h-0 basis-0 grow flex flex-col bg-transparent border-0.5 border-border-button overflow-hidden">
        <Spotlight />

        <CardHeader className="pb-10 border-b-0.5 dark:border-border-button space-y-8">
          <section className="flex items-center gap-4 text-base">
            <RAGFlowAvatar
              avatar={detail?.avatar}
              name={detail?.email}
              isPerson
            />

            <span>{detail?.email}</span>

            <Badge
              variant={
                parseBooleanish(detail?.is_active) ? 'success' : 'destructive'
              }
              className="pl-[.5em]"
            >
              <LucideDot className="size-[1em] stroke-[8] mr-1" />
              {t(
                parseBooleanish(detail?.is_active)
                  ? 'admin.active'
                  : 'admin.inactive',
              )}
            </Badge>

            <EnterpriseFeature>
              {() =>
                detail?.role && (
                  <Badge variant="secondary">{detail?.role}</Badge>
                )
              }
            </EnterpriseFeature>

            <Button className="ml-auto" variant="outline" onClick={openEdit}>
              <LucidePencil />
              {t('admin.editUser')}
            </Button>
          </section>

          <section className="flex items-start px-14 space-x-14">
            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.lastLoginTime')}
              </div>
              <div>{formatDate(detail?.last_login_time) || '-'}</div>
            </div>

            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.createTime')}
              </div>
              <div>{formatDate(detail?.create_date) || '-'}</div>
            </div>

            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.lastUpdateTime')}
              </div>
              <div>{formatDate(detail?.update_date) || '-'}</div>
            </div>

            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.language')}
              </div>
              <div>{detail?.language}</div>
            </div>

            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.isAnonymous')}
              </div>
              <div>{t(detail?.is_anonymous ? 'admin.yes' : 'admin.no')}</div>
            </div>

            <div>
              <div className="text-sm text-text-secondary mb-2">
                {t('admin.isSuperuser')}
              </div>
              <div>{t(detail?.is_superuser ? 'admin.yes' : 'admin.no')}</div>
            </div>
          </section>
        </CardHeader>

        <CardContent className="h-0 basis-0 grow pt-6">
          <Tabs className="h-full flex flex-col" defaultValue="dataset">
            <TabsList className="p-0 mb-2 gap-4 bg-transparent justify-start">
              {ASSET_NAMES.map((name) => (
                <TabsTrigger
                  key={name}
                  className="text-text-secondary border-0.5 border-border-button data-[state=active]:bg-bg-card"
                  value={name}
                >
                  {t(`header.${name}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="dataset" className="h-0 basis-0 grow">
              <ScrollArea className="h-full">
                <UserDatasetTable data={datasets} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="flow" className="h-0 basis-0 grow">
              <ScrollArea className="h-full">
                <UserAgentTable data={agents} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
                  <SelectItem value="active">{t('admin.active')}</SelectItem>
                  <SelectItem value="inactive">
                    {t('admin.inactive')}
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
    </section>
  );
}

export default AdminUserDetail;
