import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  HardDrive,
  Library,
  LucideClipboardList,
  LucideExternalLink,
  LucideTrash2,
  LucideUserLock,
  LucideUserPlus,
  UserCheck,
  UsersRound,
} from 'lucide-react';

import { rsaPsw } from '@/utils';
import { cn, formatBytes } from '@/lib/utils';

import Spotlight from '@/components/spotlight';
import { TableEmpty } from '@/components/table-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { Routes } from '@/routes';
import { LucideSearch } from 'lucide-react';

import useChangePasswordForm from './forms/change-password-form';
import useCreateUserForm from './forms/user-form';
import { UserStatusBadge, UserStatusText } from './components/user-status';

import {
  createUser,
  deleteUser,
  grantSuperuser,
  getUserLoginUrl,
  listDepartments,
  listRoles,
  listUsers,
  revokeSuperuser,
  updateUserPassword,
  updateUserDepartment,
  updateUserRole,
  updateUserStatus,
} from '@/services/admin-service';

import {
  createFuzzySearchFn,
  createMultiSelectFilterFn,
  EMPTY_DATA,
  getSortIcon,
  IS_ENTERPRISE,
  parseBooleanish,
} from './utils';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DepartmentTreeSelect from './components/department-tree-select';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { createFilterOptions } from './components/table-filter-utils';
import { CurrentUserInfoContext } from './layouts/root-layout';

const columnHelper = createColumnHelper<AdminService.ListUsersItem>();
const globalFilterFn = createFuzzySearchFn<AdminService.ListUsersItem>([
  'email',
  'nickname',
  'department_path',
]);

const USER_TABLE_COLUMN_CLASSES: Record<string, string> = {
  email: 'min-w-44',
  nickname: 'min-w-24',
  password_plain: 'min-w-40',
  department_path: 'min-w-40',
  is_active: 'w-32 min-w-32',
  is_superuser: 'w-36 min-w-36',
  teams_total: 'w-24 min-w-24 text-center',
  created_datasets: 'w-28 min-w-28 text-center',
  uploaded_documents: 'w-24 min-w-24 text-center',
  uploaded_storage_bytes: 'w-28 min-w-28 text-center',
  actions: 'w-44 min-w-44',
};

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, a, input, textarea, select, [role="button"], [role="combobox"], [role="menuitem"], [role="option"]',
      ),
    )
  );
}

function AdminUserManagement() {
  const [{ userInfo }] = useContext(CurrentUserInfoContext);

  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [userToMakeAction, setUserToMakeAction] =
    useState<AdminService.ListUsersItem | null>(null);

  const changePasswordForm = useChangePasswordForm();
  const createUserForm = useCreateUserForm();

  const { data: roleList } = useQuery({
    queryKey: ['admin/listRoles'],
    queryFn: async () => (await listRoles()).data.data.roles,
    enabled: IS_ENTERPRISE,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const { data: usersList } = useQuery({
    queryKey: ['admin/listUsers'],
    queryFn: async () => (await listUsers()).data.data,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const { data: departments } = useQuery({
    queryKey: ['admin/departments'],
    queryFn: async () => (await listDepartments()).data.data,
    retry: false,
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      // message.success(t('admin.userDeletedSuccessfully'));
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
      setDeleteModalOpen(false);
      setUserToMakeAction(null);
    },
    retry: false,
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      updateUserPassword(email, rsaPsw(password) as string),
    onSuccess: () => {
      // message.success(t('admin.passwordChangedSuccessfully'));
      setPasswordModalOpen(false);
      setUserToMakeAction(null);
    },
    retry: false,
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      updateUserRole(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
    },
    retry: false,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      role,
      departmentId,
    }: {
      email: string;
      password: string;
      role?: string;
      departmentId?: string;
    }) => {
      await createUser(email, rsaPsw(password) as string, departmentId);

      if (IS_ENTERPRISE && role) {
        await updateUserRoleMutation.mutateAsync({ email, role });
      }
    },
    onSuccess: () => {
      // message.success(t('admin.userCreatedSuccessfully'));
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
      setCreateUserModalOpen(false);
      createUserForm.form.reset();
    },
    retry: false,
  });

  const setSuperuserMutation = useMutation({
    mutationFn: ({
      email,
      type,
    }: {
      email: string;
      type: 'grant' | 'revoke';
    }) => {
      return type === 'grant' ? grantSuperuser(email) : revokeSuperuser(email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
    },
    retry: false,
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: ({
      email,
      departmentId,
    }: {
      email: string;
      departmentId?: string;
    }) => updateUserDepartment(email, departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
    },
    retry: false,
  });

  const openUserHome = useCallback(async (email: string) => {
    const target = window.open('about:blank', '_blank');
    try {
      const { url } = (await getUserLoginUrl(email)).data.data;
      if (target)
        target.location.href = new URL(url, window.location.origin).toString();
    } catch (error) {
      target?.close();
      throw error;
    }
  }, []);

  const openUserDetail = useCallback(
    (email: string) =>
      navigate(`${Routes.AdminUserManagement}/${encodeURIComponent(email)}`),
    [navigate],
  );

  // Update user status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: (data: { email: string; isActive: boolean }) =>
      updateUserStatus(data.email, data.isActive ? 'on' : 'off'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
    },
    retry: false,
  });

  const columnDefs = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: t('admin.email'),
      }),
      columnHelper.accessor('nickname', {
        header: t('admin.nickname'),
      }),

      columnHelper.accessor('password_plain', {
        header: t('admin.password'),
        cell: ({ cell }) => cell.getValue() || '-',
      }),

      columnHelper.accessor('department_path', {
        header: t('admin.department'),
        cell: ({ row }) => (
          <DepartmentTreeSelect
            departments={departments ?? []}
            disabled={updateDepartmentMutation.isPending}
            value={row.original.department_id}
            placeholder={t('admin.noDepartment')}
            className="w-40"
            onChange={(departmentId) =>
              updateDepartmentMutation.mutate({
                email: row.original.email,
                departmentId: departmentId || undefined,
              })
            }
          />
        ),
        filterFn: createMultiSelectFilterFn(),
      }),

      ...(IS_ENTERPRISE
        ? [
            columnHelper.accessor('role', {
              header: t('admin.role'),
              cell: ({ row, cell }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="min-w-16">
                      {cell.getValue()}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    {roleList?.map(({ id, role_name }) => (
                      <DropdownMenuItem
                        key={id}
                        onClick={() => {
                          updateUserRoleMutation.mutate({
                            email: row.original.email,
                            role: role_name,
                          });
                        }}
                      >
                        {role_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
              filterFn: createMultiSelectFilterFn(),
            }),
          ]
        : []),

      columnHelper.accessor('is_active', {
        header: t('admin.status'),
        cell: ({ cell, row }) => {
          const isMe = row.original.email === userInfo?.email;

          if (isMe) {
            return <UserStatusBadge active={cell.getValue()} />;
          }

          return (
            <Select
              disabled={updateUserStatusMutation.isPending}
              value={cell.getValue()}
              onValueChange={(value) =>
                updateUserStatusMutation.mutate({
                  email: row.original.email,
                  isActive: parseBooleanish(value),
                })
              }
            >
              <SelectTrigger className="w-32 [&>span]:truncate">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="0">
                  <UserStatusText active={false} />
                </SelectItem>

                <SelectItem value="1">
                  <UserStatusText active />
                </SelectItem>
              </SelectContent>
            </Select>
          );
        },
        filterFn: createMultiSelectFilterFn(),
      }),

      columnHelper.accessor('is_superuser', {
        header: t('admin.userType'),
        filterFn: createMultiSelectFilterFn((value) =>
          value ? 'superuser' : 'normal',
        ),
        cell: ({ cell, row }) => {
          const isMe = row.original.email === userInfo?.email;

          if (isMe) {
            return <Badge variant="secondary">{t('admin.superuser')}</Badge>;
          }

          return (
            <Select
              disabled={
                setSuperuserMutation.isPending ||
                row.original.email === userInfo?.email
              }
              value={cell.getValue() ? 'superuser' : 'normal'}
              onValueChange={(value) => {
                setSuperuserMutation.mutate({
                  email: row.original.email,
                  type: value === 'superuser' ? 'grant' : 'revoke',
                });
              }}
            >
              <SelectTrigger className="w-36 [&>span]:truncate">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="normal">{t('admin.normalUser')}</SelectItem>
                <SelectItem value="superuser">
                  {t('admin.superuser')}
                </SelectItem>
              </SelectContent>
            </Select>
          );
        },
      }),

      columnHelper.accessor('teams_total', {
        header: t('admin.userMonitoring.teams'),
      }),

      columnHelper.accessor('created_datasets', {
        header: t('admin.userMonitoring.datasets'),
      }),

      columnHelper.accessor('uploaded_documents', {
        header: t('admin.userMonitoring.documents'),
      }),

      columnHelper.accessor('uploaded_storage_bytes', {
        header: t('admin.userMonitoring.storage'),
        cell: ({ cell }) => formatBytes(cell.getValue(), { decimals: 1 }),
      }),

      columnHelper.display({
        id: 'actions',
        header: t('admin.actions'),
        cell: ({ row }) => {
          const isMe = row.original.email === userInfo?.email;

          return (
            <div className="flex items-center whitespace-nowrap opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
              <Button
                variant="transparent"
                size="icon"
                className="border-0"
                title={t('admin.userDetails')}
                aria-label={t('admin.userDetails')}
                onClick={() => openUserDetail(row.original.email)}
              >
                <LucideClipboardList />
              </Button>

              <Button
                variant="transparent"
                size="icon"
                className="border-0"
                title={t('admin.openRagflow')}
                aria-label={t('admin.openRagflow')}
                onClick={() => openUserHome(row.original.email)}
              >
                <LucideExternalLink />
              </Button>

              {!isMe && (
                <>
                  <Button
                    variant="transparent"
                    size="icon"
                    className="border-0"
                    title={t('admin.changePassword')}
                    aria-label={t('admin.changePassword')}
                    onClick={() => {
                      setUserToMakeAction(row.original);
                      setPasswordModalOpen(true);
                    }}
                  >
                    <LucideUserLock />
                  </Button>
                  <Button
                    variant="danger"
                    size="icon"
                    className="border-0"
                    title={t('admin.deleteUser')}
                    aria-label={t('admin.deleteUser')}
                    onClick={() => {
                      setUserToMakeAction(row.original);
                      setDeleteModalOpen(true);
                    }}
                  >
                    <LucideTrash2 />
                  </Button>
                </>
              )}
            </div>
          );
        },
      }),
    ],
    [
      t,
      roleList,
      updateUserRoleMutation,
      userInfo?.email,
      updateUserStatusMutation,
      setSuperuserMutation,
      updateDepartmentMutation,
      departments,
      openUserHome,
      openUserDetail,
    ],
  );

  const table = useReactTable({
    data: usersList ?? EMPTY_DATA,
    columns: columnDefs,

    globalFilterFn,

    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    autoResetPageIndex: false,
  });

  const filteredUserCount = table.getFilteredRowModel().rows.length;

  useLayoutEffect(() => {
    if (table.getState().pagination.pageIndex >= table.getPageCount()) {
      table.setPageIndex(Math.max(0, table.getPageCount() - 1));
    }
  }, [filteredUserCount, table]);

  const totalUsers = usersList?.length ?? 0;
  const activeUsers =
    usersList?.filter((user) => parseBooleanish(user.is_active)).length ?? 0;
  const createdDatasets =
    usersList?.reduce((total, user) => total + user.created_datasets, 0) ?? 0;
  const uploadedStorage =
    usersList?.reduce(
      (total, user) => total + user.uploaded_storage_bytes,
      0,
    ) ?? 0;

  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-4">
      <AdminTableMultiFilters
        filters={[
          ...(IS_ENTERPRISE
            ? [
                {
                  id: 'role',
                  label: t('admin.role'),
                  options: (roleList ?? []).map(({ role_name }) => ({
                    value: role_name,
                    label: role_name,
                  })),
                  value:
                    (table.getColumn('role')?.getFilterValue() as string[]) ??
                    [],
                  onChange: (value: string[]) =>
                    table.getColumn('role')?.setFilterValue(value),
                },
              ]
            : []),
          {
            id: 'department_path',
            label: t('admin.department'),
            options: createFilterOptions(
              usersList ?? [],
              (user) => user.department_path,
            ),
            value:
              (table
                .getColumn('department_path')
                ?.getFilterValue() as string[]) ?? [],
            onChange: (value) =>
              table.getColumn('department_path')?.setFilterValue(value),
          },
          {
            id: 'is_active',
            label: t('admin.status'),
            options: [
              { value: '1', label: t('admin.active') },
              { value: '0', label: t('admin.inactive') },
            ],
            value:
              (table.getColumn('is_active')?.getFilterValue() as string[]) ??
              [],
            onChange: (value) =>
              table.getColumn('is_active')?.setFilterValue(value),
          },
          {
            id: 'is_superuser',
            label: t('admin.userType'),
            options: [
              { value: 'normal', label: t('admin.normalUser') },
              { value: 'superuser', label: t('admin.superuser') },
            ],
            value:
              (table.getColumn('is_superuser')?.getFilterValue() as string[]) ??
              [],
            onChange: (value) =>
              table.getColumn('is_superuser')?.setFilterValue(value),
          },
        ]}
        resetLabel={t('admin.reset')}
        onReset={() => table.resetColumnFilters()}
      />

      <div className="relative w-56">
        <LucideSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <Input
          className="h-10 border-border-button bg-bg-input pl-10"
          placeholder={t('header.search')}
          value={table.getState().globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
      </div>
    </div>
  );

  return (
    <>
      <Card className="!shadow-none relative h-full bg-transparent overflow-hidden">
        <Spotlight />

        <ScrollArea
          className="size-full"
          viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
        >
          <CardHeader className="space-y-5">
            <div className="flex items-center justify-between gap-6">
              <div>
                <CardTitle>{t('admin.userManagement')}</CardTitle>
                <div className="mt-2 text-sm text-text-secondary">
                  {t('admin.userMonitoring.description')}
                </div>
              </div>
              <Button
                className="h-10 px-4"
                onClick={() => setCreateUserModalOpen(true)}
              >
                <LucideUserPlus />
                {t('admin.newUser')}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  t('admin.userMonitoring.totalUsersLabel'),
                  totalUsers,
                  UsersRound,
                ],
                [
                  t('admin.userMonitoring.activeUsersLabel'),
                  activeUsers,
                  UserCheck,
                ],
                [t('admin.userMonitoring.datasets'), createdDatasets, Library],
                [
                  t('admin.userMonitoring.storage'),
                  formatBytes(uploadedStorage, { decimals: 1 }),
                  HardDrive,
                ],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof UsersRound;
                return (
                  <div
                    key={String(label)}
                    className="rounded-lg border-0.5 border-border-button bg-bg-input p-4"
                  >
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{String(label)}</span>
                      <MetricIcon className="size-4" />
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {String(value)}
                    </div>
                  </div>
                );
              })}
            </div>

            {tableToolbar}
          </CardHeader>

          <CardContent>
            <div className="w-full min-w-0 max-w-full overflow-x-auto">
              <Table className="min-w-[1660px]">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={cn(
                            'whitespace-nowrap px-3',
                            USER_TABLE_COLUMN_CLASSES[header.column.id],
                          )}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <Button
                              variant="ghost"
                              className="-ml-3 whitespace-nowrap"
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
                      <TableRow
                        key={row.id}
                        className="group/row cursor-pointer"
                        tabIndex={0}
                        aria-label={`${t('admin.userDetails')}：${row.original.email}`}
                        onClick={(event: MouseEvent<HTMLTableRowElement>) => {
                          if (!isInteractiveTarget(event.target)) {
                            openUserDetail(row.original.email);
                          }
                        }}
                        onKeyDown={(
                          event: KeyboardEvent<HTMLTableRowElement>,
                        ) => {
                          if (
                            event.key === 'Enter' &&
                            !isInteractiveTarget(event.target)
                          ) {
                            openUserDetail(row.original.email);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'whitespace-nowrap px-3',
                              USER_TABLE_COLUMN_CLASSES[cell.column.id],
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableEmpty key="empty" columnsLength={columnDefs.length} />
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-end">
            <RAGFlowPagination
              total={filteredUserCount}
              current={table.getState().pagination.pageIndex + 1}
              pageSize={table.getState().pagination.pageSize}
              onChange={(page, pageSize) => {
                table.setPagination({
                  pageIndex: page - 1,
                  pageSize,
                });
              }}
            />
          </CardFooter>
        </ScrollArea>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.deleteUser')}</DialogTitle>
          </DialogHeader>

          <section className="px-6">
            <DialogDescription>
              {t('admin.deleteUserConfirmation')}
            </DialogDescription>

            <div className="rounded-lg mt-6 p-4 border-0.5 border-border-button">
              {userToMakeAction?.email}
            </div>
          </section>

          <DialogFooter className="gap-4 px-6 py-4">
            <Button
              className="px-4 h-10 dark:border-border-button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteUserMutation.isPending}
            >
              {t('admin.cancel')}
            </Button>

            <Button
              className="px-4 h-10"
              variant="destructive"
              onClick={() =>
                userToMakeAction &&
                deleteUserMutation.mutate(userToMakeAction?.email)
              }
              disabled={deleteUserMutation.isPending}
              loading={deleteUserMutation.isPending}
            >
              {t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent
          onAnimationEnd={() => {
            if (!passwordModalOpen) {
              changePasswordForm.form.reset();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('admin.changePassword')}</DialogTitle>
          </DialogHeader>

          <section className="px-6">
            <changePasswordForm.FormComponent
              key="changePasswordForm"
              email={userToMakeAction?.email || ''}
              onSubmit={({ newPassword }) => {
                if (userToMakeAction) {
                  changePasswordMutation.mutate({
                    email: userToMakeAction.email,
                    password: newPassword,
                  });
                }
              }}
            />
          </section>

          <DialogFooter className="gap-4 px-6 py-4">
            <Button
              className="px-4 h-10 dark:border-border-button"
              variant="outline"
              onClick={() => {
                setPasswordModalOpen(false);
                setUserToMakeAction(null);
              }}
              disabled={changePasswordMutation.isPending}
            >
              {t('admin.cancel')}
            </Button>

            <Button
              form={changePasswordForm.id}
              className="px-4 h-10"
              variant="default"
              type="submit"
              disabled={changePasswordMutation.isPending}
              loading={changePasswordMutation.isPending}
            >
              {t('admin.changePassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog
        open={createUserModalOpen}
        onOpenChange={() => {
          setCreateUserModalOpen(false);
          createUserForm.form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.createNewUser')}</DialogTitle>
          </DialogHeader>

          <section className="px-6">
            <createUserForm.FormComponent
              id={createUserForm.id}
              onSubmit={createUserMutation.mutate}
            />
          </section>

          <DialogFooter className="gap-4 px-6 py-4">
            <Button
              className="px-4 h-10 dark:border-border-button"
              variant="outline"
              onClick={() => {
                setCreateUserModalOpen(false);
                createUserForm.form.reset();
              }}
              disabled={createUserMutation.isPending}
            >
              {t('admin.cancel')}
            </Button>

            <Button
              form={createUserForm.id}
              type="submit"
              className="px-4 h-10"
              variant="default"
              disabled={createUserMutation.isPending}
              loading={createUserMutation.isPending}
            >
              {t('admin.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AdminUserManagement;
