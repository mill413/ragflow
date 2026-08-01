import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';

import CopyToClipboard from '@/components/copy-to-clipboard';
import Spotlight from '@/components/spotlight';
import { TableEmpty } from '@/components/table-skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import message from '@/components/ui/message';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createManagedApiToken,
  deleteManagedApiToken,
  listApiTokenWorkspaces,
  listManagedApiTokens,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';

import { AdminRefreshButton } from './components/admin-refresh-button';
import { DetailInformationCard } from './components/detail-information-card';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { getSortIcon } from './utils';

const ApiTokenKeys = {
  all: () => ['admin/api-tokens'] as const,
  workspaces: () => ['admin/api-token-workspaces'] as const,
};

const columnHelper = createColumnHelper<AdminService.ManagedApiToken>();

type TokenActionsProps = {
  token: AdminService.ManagedApiToken;
  onDelete: (token: AdminService.ManagedApiToken) => void;
};

function TokenActions({ token, onDelete }: TokenActionsProps) {
  const { t } = useTranslation();

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete(token);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        title={t('admin.apiTokenManagementPage.delete')}
        onClick={handleDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

export default function AdminApiTokens() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [workspaceTypeFilters, setWorkspaceTypeFilters] = useState<string[]>(
    [],
  );
  const [workspaceFilters, setWorkspaceFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminService.ManagedApiToken>();
  const [workspaceId, setWorkspaceId] = useState('');
  const [created, setCreated] = useState<AdminService.CreatedApiToken>();

  const { data: tokens = [] } = useQuery({
    queryKey: ApiTokenKeys.all(),
    queryFn: async () => (await listManagedApiTokens()).data.data,
  });
  const { data: workspaces = [] } = useQuery({
    queryKey: ApiTokenKeys.workspaces(),
    queryFn: async () => (await listApiTokenWorkspaces()).data.data,
  });

  const invalidateTokens = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ApiTokenKeys.all() });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: createManagedApiToken,
    onSuccess: async (response) => {
      await invalidateTokens();
      setFormOpen(false);
      setCreated(response.data.data);
      message.success(t('admin.apiTokenManagementPage.created'));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteManagedApiToken,
    onSuccess: async () => {
      await invalidateTokens();
      setDeleting(undefined);
      message.success(t('admin.apiTokenManagementPage.deleted'));
    },
  });

  const openCreate = useCallback(() => {
    setWorkspaceId('');
    setFormOpen(true);
  }, []);
  const openDelete = useCallback((token: AdminService.ManagedApiToken) => {
    setDeleting(token);
  }, []);
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };
  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
  };
  const handleDeleteOpenChange = (open: boolean) => {
    if (!open) setDeleting(undefined);
  };
  const handleSecretOpenChange = (open: boolean) => {
    if (!open) setCreated(undefined);
  };
  const closeForm = () => {
    handleFormOpenChange(false);
  };
  const closeSecret = () => {
    handleSecretOpenChange(false);
  };
  const handleSave = () => {
    if (!workspaceId) return;
    createMutation.mutate({ workspaceId });
  };
  const handleDelete = () => {
    if (deleting) deleteMutation.mutate(deleting.id);
  };
  const handleResetFilters = () => {
    setWorkspaceTypeFilters([]);
    setWorkspaceFilters([]);
    setSourceFilters([]);
  };

  const filteredTokens = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return tokens.filter((token) => {
      const searchable = [
        token.token,
        token.workspace_name,
        token.workspace_id,
        token.resource_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return (
        (!keyword || searchable.includes(keyword)) &&
        matchesSelectedFilter(token.workspace_type, workspaceTypeFilters) &&
        matchesSelectedFilter(token.workspace_id, workspaceFilters) &&
        matchesSelectedFilter(token.source, sourceFilters)
      );
    });
  }, [query, sourceFilters, tokens, workspaceFilters, workspaceTypeFilters]);

  const workspaceLabel = useCallback(
    (workspace: AdminService.ApiTokenWorkspace) =>
      `${t(
        `admin.apiTokenManagementPage.workspaceTypes.${workspace.type}`,
      )}-${workspace.name}`,
    [t],
  );
  const workspaceTypeLabel = useCallback(
    (type: AdminService.ManagedApiToken['workspace_type']) =>
      t(`admin.apiTokenManagementPage.workspaceTypes.${type}`),
    [t],
  );
  const sourceLabel = useCallback(
    (source: AdminService.ManagedApiToken['source']) =>
      t(`admin.apiTokenManagementPage.sources.${source}`),
    [t],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('token', {
        header: t('admin.apiTokenManagementPage.token'),
        cell: ({ getValue }) => (
          <div className="flex min-w-72 items-center gap-2">
            <span className="break-all font-mono text-xs">{getValue()}</span>
            <CopyToClipboard text={getValue()} />
          </div>
        ),
      }),
      columnHelper.accessor('workspace_name', {
        header: t('admin.apiTokenManagementPage.workspace'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">
              {row.original.workspace_name}
            </div>
            <div
              className="truncate font-mono text-xs text-text-secondary"
              title={row.original.workspace_id}
            >
              {row.original.workspace_id}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('workspace_type', {
        header: t('admin.apiTokenManagementPage.workspaceType'),
        cell: ({ getValue }) => (
          <Badge variant="secondary">{workspaceTypeLabel(getValue())}</Badge>
        ),
      }),
      columnHelper.accessor('source', {
        header: t('admin.apiTokenManagementPage.source'),
        cell: ({ getValue }) => sourceLabel(getValue()),
      }),
      columnHelper.accessor('create_date', {
        header: t('admin.apiTokenManagementPage.createdAt'),
        cell: ({ getValue }) => formatDate(getValue()) || '-',
      }),
      columnHelper.accessor('update_date', {
        header: t('admin.apiTokenManagementPage.updatedAt'),
        cell: ({ getValue }) => formatDate(getValue()) || '-',
      }),
      columnHelper.display({
        id: 'actions',
        header: t('admin.actions'),
        cell: ({ row }) => (
          <TokenActions token={row.original} onDelete={openDelete} />
        ),
      }),
    ],
    [openDelete, sourceLabel, t, workspaceTypeLabel],
  );

  const table = useReactTable({
    data: filteredTokens,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
  });
  const handlePaginationChange = (page: number, pageSize: number) => {
    table.setPagination({ pageIndex: page - 1, pageSize });
  };

  const personalCount = tokens.filter(
    (token) => token.workspace_type === 'personal',
  ).length;
  const teamCount = tokens.filter(
    (token) => token.workspace_type === 'team',
  ).length;
  const resourceCount = tokens.filter(
    (token) => token.source !== 'workspace',
  ).length;

  return (
    <>
      <Card className="!shadow-none relative flex h-full flex-col overflow-hidden rounded-xl border-0.5 border-border-button bg-transparent">
        <Spotlight />
        <ScrollArea className="size-full">
          <CardHeader className="space-y-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <CardTitle>{t('admin.apiTokenManagementPage.title')}</CardTitle>
                <div className="mt-2 max-w-3xl text-sm text-text-secondary">
                  {t('admin.apiTokenManagementPage.description')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <AdminRefreshButton queryKeys={[ApiTokenKeys.all()]} />
                <Button className="h-10 px-4" onClick={openCreate}>
                  <Plus />
                  {t('admin.apiTokenManagementPage.create')}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailInformationCard
                icon={KeyRound}
                label={t('admin.apiTokenManagementPage.total')}
                value={tokens.length}
              />
              <DetailInformationCard
                icon={UserRound}
                label={t('admin.apiTokenManagementPage.personalTotal')}
                value={personalCount}
              />
              <DetailInformationCard
                icon={UsersRound}
                label={t('admin.apiTokenManagementPage.teamTotal')}
                value={teamCount}
              />
              <DetailInformationCard
                icon={ShieldCheck}
                label={t('admin.apiTokenManagementPage.resourceTotal')}
                value={resourceCount}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminTableMultiFilters
                filters={[
                  {
                    id: 'workspace-type',
                    label: t('admin.apiTokenManagementPage.workspaceType'),
                    options: ['personal', 'team', 'unknown'].map((type) => ({
                      value: type,
                      label: workspaceTypeLabel(
                        type as AdminService.ManagedApiToken['workspace_type'],
                      ),
                    })),
                    value: workspaceTypeFilters,
                    onChange: setWorkspaceTypeFilters,
                  },
                  {
                    id: 'workspace',
                    label: t('admin.apiTokenManagementPage.workspace'),
                    options: createFilterOptions(
                      tokens,
                      (token) => token.workspace_id,
                      (id) =>
                        tokens.find((token) => token.workspace_id === id)
                          ?.workspace_name || id,
                    ),
                    value: workspaceFilters,
                    onChange: setWorkspaceFilters,
                  },
                  {
                    id: 'source',
                    label: t('admin.apiTokenManagementPage.source'),
                    options: createFilterOptions(
                      tokens,
                      (token) => token.source,
                      (source) =>
                        sourceLabel(
                          source as AdminService.ManagedApiToken['source'],
                        ),
                    ),
                    value: sourceFilters,
                    onChange: setSourceFilters,
                  },
                ]}
                resetLabel={t('admin.reset')}
                onReset={handleResetFilters}
              />
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="h-10 pl-9"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder={t('admin.apiTokenManagementPage.search')}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Table rootClassName="max-w-full [contain:inline-size]">
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
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
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
          </CardContent>

          <CardFooter className="flex items-center justify-end">
            <RAGFlowPagination
              total={filteredTokens.length}
              current={table.getState().pagination.pageIndex + 1}
              pageSize={table.getState().pagination.pageSize}
              onChange={handlePaginationChange}
            />
          </CardFooter>
        </ScrollArea>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.apiTokenManagementPage.create')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.apiTokenManagementPage.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('admin.apiTokenManagementPage.workspace')}</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'admin.apiTokenManagementPage.workspacePlaceholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspaceLabel(workspace)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              {t('admin.cancel')}
            </Button>
            <Button
              disabled={!workspaceId || createMutation.isPending}
              onClick={handleSave}
            >
              {t('admin.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={handleDeleteOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.apiTokenManagementPage.delete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.apiTokenManagementPage.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(created)} onOpenChange={handleSecretOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.apiTokenManagementPage.secretTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.apiTokenManagementPage.secretDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border-button bg-bg-input p-3">
            <code className="min-w-0 flex-1 break-all text-sm">
              {created?.secret}
            </code>
            {created?.secret && <CopyToClipboard text={created.secret} />}
          </div>
          <DialogFooter>
            <Button onClick={closeSecret}>
              {t('admin.apiTokenManagementPage.savedSecret')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
