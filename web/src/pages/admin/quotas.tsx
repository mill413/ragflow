import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Files,
  Gauge,
  HardDrive,
  Pencil,
  Search,
  ShieldAlert,
} from 'lucide-react';

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
import { Input } from '@/components/ui/input';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  listResourceQuotas,
  updateResourceQuota,
} from '@/services/admin-service';

import { DetailInformationCard } from './components/detail-information-card';
import {
  ResourceQuotaDialog,
} from './components/resource-quota';
import { StorageSize } from './components/storage-size';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { matchesSelectedFilter } from './components/table-filter-utils';
import { getSortIcon } from './utils';

type QuotaSortKey =
  | 'name'
  | 'scope_type'
  | 'workspace_name'
  | 'file_count_used'
  | 'file_count_limit'
  | 'storage_bytes_used'
  | 'storage_bytes_limit';

type QuotaState = 'unlimited' | 'configured' | 'overLimit';

const PAGE_SIZE = 20;

function getQuotaState(quota: AdminService.ResourceQuota): QuotaState {
  const overFileLimit =
    quota.file_count_limit !== null &&
    quota.file_count_used > quota.file_count_limit;
  const overStorageLimit =
    quota.storage_bytes_limit !== null &&
    quota.storage_bytes_used > quota.storage_bytes_limit;
  if (overFileLimit || overStorageLimit) return 'overLimit';
  if (
    quota.file_count_limit !== null ||
    quota.storage_bytes_limit !== null
  ) {
    return 'configured';
  }
  return 'unlimited';
}

export default function AdminQuotas() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [scopeFilters, setScopeFilters] = useState<string[]>([]);
  const [stateFilters, setStateFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<AdminService.ResourceQuotaItem>();
  const [sort, setSort] = useState<{
    key: QuotaSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  const { data: quotas = [], isFetching } = useQuery({
    queryKey: ['admin/resource-quotas'],
    queryFn: async () => (await listResourceQuotas()).data.data,
  });

  const mutation = useMutation({
    mutationFn: (limits: Pick<
      AdminService.ResourceQuota,
      'file_count_limit' | 'storage_bytes_limit'
    >) => updateResourceQuota(editing!.scope_type, editing!.scope_id, limits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/resource-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['admin/userDetail'] });
      queryClient.invalidateQueries({ queryKey: ['admin/teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin/resources'] });
      setEditing(undefined);
      message.success(t('admin.resourceQuota.updated'));
    },
  });

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return quotas
      .filter((quota) => {
        const searchable = [
          quota.name,
          quota.scope_id,
          quota.workspace_name,
          quota.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();
        return (
          (!keyword || searchable.includes(keyword)) &&
          matchesSelectedFilter(quota.scope_type, scopeFilters) &&
          matchesSelectedFilter(getQuotaState(quota), stateFilters)
        );
      })
      .sort((left, right) => {
        const result = String(left[sort.key] ?? '').localeCompare(
          String(right[sort.key] ?? ''),
          undefined,
          { numeric: true },
        );
        return sort.direction === 'asc' ? result : -result;
      });
  }, [query, quotas, scopeFilters, sort, stateFilters]);

  useEffect(() => setPage(1), [query, scopeFilters, stateFilters]);

  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const configuredCount = quotas.filter(
    (quota) => getQuotaState(quota) !== 'unlimited',
  ).length;
  const overLimitCount = quotas.filter(
    (quota) => getQuotaState(quota) === 'overLimit',
  ).length;
  const totalStorage = quotas
    .filter((quota) => quota.scope_type !== 'dataset')
    .reduce((sum, quota) => sum + quota.storage_bytes_used, 0);

  const toggleSort = (key: QuotaSortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortButton = (label: string, key: QuotaSortKey) => (
    <Button variant="ghost" onClick={() => toggleSort(key)}>
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );
  const scopeLabel = (scope: AdminService.ResourceQuotaScopeType) =>
    t(`admin.quotaManagementPage.scopeTypes.${scope}`);
  const stateBadge = (quota: AdminService.ResourceQuota) => {
    const state = getQuotaState(quota);
    return (
      <Badge
        variant={
          state === 'overLimit'
            ? 'destructive'
            : state === 'configured'
              ? 'success'
              : 'secondary'
        }
      >
        {t(`admin.quotaManagementPage.states.${state}`)}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <Card className="!shadow-none relative h-full flex flex-col overflow-hidden rounded-xl border-0.5 border-border-button bg-transparent">
        <Spotlight />
        <ScrollArea className="size-full">
          <CardHeader className="space-y-5">
            <div>
              <CardTitle>{t('admin.quotaManagementPage.title')}</CardTitle>
              <div className="mt-2 max-w-3xl text-sm text-text-secondary">
                {t('admin.quotaManagementPage.description')}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailInformationCard
                icon={Gauge}
                label={t('admin.quotaManagementPage.total')}
                value={quotas.length}
              />
              <DetailInformationCard
                icon={Files}
                label={t('admin.quotaManagementPage.configured')}
                value={configuredCount}
              />
              <DetailInformationCard
                icon={ShieldAlert}
                label={t('admin.quotaManagementPage.overLimit')}
                value={overLimitCount}
              />
              <DetailInformationCard
                icon={HardDrive}
                label={t('admin.quotaManagementPage.workspaceStorage')}
                value={<StorageSize bytes={totalStorage} />}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminTableMultiFilters
                filters={[
                  {
                    id: 'scope-type',
                    label: t('admin.quotaManagementPage.scopeType'),
                    options: (['personal', 'team', 'dataset'] as const).map(
                      (scope) => ({ value: scope, label: scopeLabel(scope) }),
                    ),
                    value: scopeFilters,
                    onChange: setScopeFilters,
                  },
                  {
                    id: 'quota-state',
                    label: t('admin.quotaManagementPage.state'),
                    options: (
                      ['unlimited', 'configured', 'overLimit'] as const
                    ).map((state) => ({
                      value: state,
                      label: t(`admin.quotaManagementPage.states.${state}`),
                    })),
                    value: stateFilters,
                    onChange: setStateFilters,
                  },
                ]}
                resetLabel={t('admin.reset')}
                onReset={() => {
                  setScopeFilters([]);
                  setStateFilters([]);
                }}
              />
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="h-10 pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('admin.quotaManagementPage.search')}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table
                rootClassName="max-w-full [contain:inline-size]"
                className="min-w-[1120px]"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {sortButton(t('admin.name'), 'name')}
                    </TableHead>
                    <TableHead>
                      {sortButton(
                        t('admin.quotaManagementPage.scopeType'),
                        'scope_type',
                      )}
                    </TableHead>
                    <TableHead>
                      {sortButton(
                        t('admin.quotaManagementPage.workspace'),
                        'workspace_name',
                      )}
                    </TableHead>
                    <TableHead className="text-center">
                      {sortButton(
                        t('admin.quotaManagementPage.fileUsage'),
                        'file_count_used',
                      )}
                    </TableHead>
                    <TableHead className="text-center">
                      {sortButton(
                        t('admin.quotaManagementPage.fileLimit'),
                        'file_count_limit',
                      )}
                    </TableHead>
                    <TableHead className="text-center">
                      {sortButton(
                        t('admin.quotaManagementPage.storageUsage'),
                        'storage_bytes_used',
                      )}
                    </TableHead>
                    <TableHead className="text-center">
                      {sortButton(
                        t('admin.quotaManagementPage.storageLimit'),
                        'storage_bytes_limit',
                      )}
                    </TableHead>
                    <TableHead className="text-center">
                      {t('admin.quotaManagementPage.state')}
                    </TableHead>
                    <TableHead className="text-center">
                      {t('admin.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isFetching ? 'opacity-60' : undefined}>
                  {rows.length ? (
                    rows.map((quota) => (
                      <TableRow key={`${quota.scope_type}-${quota.scope_id}`}>
                        <TableCell>
                          <div className="font-medium">{quota.name}</div>
                          <div className="max-w-48 truncate text-xs text-text-secondary">
                            {quota.email || quota.scope_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {scopeLabel(quota.scope_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {quota.scope_type === 'dataset'
                            ? quota.workspace_name
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {quota.file_count_used}
                        </TableCell>
                        <TableCell className="text-center">
                          {quota.file_count_limit ??
                            t('admin.resourceQuota.unlimited')}
                        </TableCell>
                        <TableCell className="text-center">
                          <StorageSize bytes={quota.storage_bytes_used} />
                        </TableCell>
                        <TableCell className="text-center">
                          {quota.storage_bytes_limit === null ? (
                            t('admin.resourceQuota.unlimited')
                          ) : (
                            <StorageSize bytes={quota.storage_bytes_limit} />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {stateBadge(quota)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t('admin.resourceQuota.configure')}
                            aria-label={t('admin.resourceQuota.configure')}
                            onClick={() => setEditing(quota)}
                          >
                            <Pencil />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmpty columnsLength={9} />
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end">
            <RAGFlowPagination
              total={filtered.length}
              current={page}
              pageSize={pageSize}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
            />
          </CardFooter>
        </ScrollArea>
      </Card>

      <ResourceQuotaDialog
        open={Boolean(editing)}
        quota={editing}
        saving={mutation.isPending}
        onOpenChange={(open) => !open && setEditing(undefined)}
        onSave={(limits) => mutation.mutate(limits)}
      />
    </TooltipProvider>
  );
}
