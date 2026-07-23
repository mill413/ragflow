import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Files,
  Eye,
  Gauge,
  HardDrive,
  ChevronDown,
  Pencil,
  Search,
  ShieldAlert,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import { TableEmpty } from '@/components/table-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ResourceQuotaDialog } from './components/resource-quota';
import { StorageSize } from './components/storage-size';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { matchesSelectedFilter } from './components/table-filter-utils';
import { getSortIcon } from './utils';

type QuotaSortKey =
  | 'name'
  | 'workspace_name'
  | 'file_count_used'
  | 'file_count_limit'
  | 'storage_bytes_used'
  | 'storage_bytes_limit';

type QuotaState = 'unlimited' | 'configured' | 'overLimit';

const PAGE_SIZE = 20;

function getQuotaState(quota: AdminService.ResourceQuota): QuotaState {
  const metrics = [
    'file_count',
    'storage_bytes',
    'team_count',
    'dataset_count',
    'chat_count',
    'search_count',
    'agent_count',
    'memory_count',
  ] as const;
  if (
    metrics.some((metric) => {
      const limit = quota[`${metric}_limit`];
      return limit !== null && quota[`${metric}_used`] > limit;
    })
  )
    return 'overLimit';
  return metrics.some((metric) => quota[`${metric}_limit`] !== null)
    ? 'configured'
    : 'unlimited';
}

function quotaPercentage(used: number, limit: number | null) {
  if (limit === null) return null;
  if (limit === 0) return used > 0 ? 100 : 0;
  return Math.round((used / limit) * 1000) / 10;
}

function QuotaMetricDetail({
  title,
  used,
  limit,
  storage = false,
}: {
  title: string;
  used: number;
  limit: number | null;
  storage?: boolean;
}) {
  const { t } = useTranslation();
  const percentage = quotaPercentage(used, limit);
  const remaining = limit === null ? null : Math.max(limit - used, 0);
  const exceeded = limit === null ? 0 : Math.max(used - limit, 0);
  const formatValue = (value: number) =>
    storage ? <StorageSize bytes={value} /> : value.toLocaleString();

  return (
    <section className="space-y-4 rounded-lg border-0.5 border-border-button bg-bg-input p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="font-medium">{title}</div>
        <div className="text-sm font-medium">
          {formatValue(used)} /{' '}
          {limit === null
            ? t('admin.resourceQuota.unlimited')
            : formatValue(limit)}
        </div>
      </div>
      {percentage === null ? (
        <div className="rounded-md bg-bg-card px-3 py-2 text-xs text-text-secondary">
          {t('admin.quotaManagementPage.unlimitedUsage')}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-bg-accent">
            <div
              className={
                exceeded > 0
                  ? 'h-full rounded-full bg-state-error'
                  : 'h-full rounded-full bg-accent-primary'
              }
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="text-right text-xs text-text-secondary">
            {t('admin.quotaManagementPage.usageRate', {
              percentage: percentage.toLocaleString(),
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-right">
        <div className="rounded-md bg-bg-card p-3">
          <div className="text-xs text-text-secondary">
            {t('admin.quotaManagementPage.used')}
          </div>
          <div className="mt-1 text-sm font-medium">{formatValue(used)}</div>
        </div>
        <div className="rounded-md bg-bg-card p-3">
          <div className="text-xs text-text-secondary">
            {t('admin.quotaManagementPage.remaining')}
          </div>
          <div className="mt-1 text-sm font-medium">
            {remaining === null
              ? t('admin.resourceQuota.unlimited')
              : formatValue(remaining)}
          </div>
        </div>
        <div className="rounded-md bg-bg-card p-3">
          <div className="text-xs text-text-secondary">
            {t('admin.quotaManagementPage.exceeded')}
          </div>
          <div
            className={
              exceeded > 0
                ? 'mt-1 text-sm font-medium text-state-error'
                : 'mt-1 text-sm font-medium'
            }
          >
            {formatValue(exceeded)}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuotaStateBadge({ quota }: { quota: AdminService.ResourceQuota }) {
  const { t } = useTranslation();
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
}

function QuotaTableSection({
  scopeType,
  quotas,
  loading,
  onView,
  onEdit,
}: {
  scopeType: AdminService.ResourceQuotaScopeType;
  quotas: AdminService.ResourceQuotaItem[];
  loading: boolean;
  onView: (quota: AdminService.ResourceQuotaItem) => void;
  onEdit: (quota: AdminService.ResourceQuotaItem) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<{
    key: QuotaSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });
  const showWorkspace = scopeType === 'dataset';

  useEffect(() => setPage(1), [quotas]);

  const sorted = useMemo(
    () =>
      [...quotas].sort((left, right) => {
        const result = String(left[sort.key] ?? '').localeCompare(
          String(right[sort.key] ?? ''),
          undefined,
          { numeric: true },
        );
        return sort.direction === 'asc' ? result : -result;
      }),
    [quotas, sort],
  );
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const sortButton = (label: string, key: QuotaSortKey) => (
    <Button
      variant="ghost"
      onClick={() =>
        setSort((current) => ({
          key,
          direction:
            current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }))
      }
    >
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );

  return (
    <Collapsible asChild>
      <section className="overflow-hidden rounded-lg border-0.5 border-border-button bg-bg-input">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-card"
          >
            <ChevronDown className="size-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0" />
            <span className="font-medium">
              {t(`admin.quotaManagementPage.tableTitles.${scopeType}`)}
            </span>
            <Badge className="ml-auto" variant="secondary">
              {quotas.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="overflow-x-auto border-t border-border-button">
            <Table
              rootClassName="max-w-full [contain:inline-size]"
              className={showWorkspace ? 'min-w-[1080px]' : 'min-w-[960px]'}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>{sortButton(t('admin.name'), 'name')}</TableHead>
                  {showWorkspace && (
                    <TableHead>
                      {sortButton(
                        t('admin.quotaManagementPage.workspace'),
                        'workspace_name',
                      )}
                    </TableHead>
                  )}
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
              <TableBody className={loading ? 'opacity-60' : undefined}>
                {rows.length ? (
                  rows.map((quota) => (
                    <TableRow
                      key={quota.scope_id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => onView(quota)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') onView(quota);
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{quota.name}</div>
                        <div className="max-w-48 truncate text-xs text-text-secondary">
                          {quota.email || quota.scope_id}
                        </div>
                      </TableCell>
                      {showWorkspace && (
                        <TableCell>{quota.workspace_name}</TableCell>
                      )}
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
                        <QuotaStateBadge quota={quota} />
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t('admin.quotaManagementPage.viewDetail')}
                          aria-label={t('admin.quotaManagementPage.viewDetail')}
                          onClick={() => onView(quota)}
                        >
                          <Eye />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t('admin.resourceQuota.configure')}
                          aria-label={t('admin.resourceQuota.configure')}
                          onClick={() => onEdit(quota)}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty columnsLength={showWorkspace ? 8 : 7} />
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end border-t border-border-button px-4 py-3">
            <RAGFlowPagination
              total={sorted.length}
              current={page}
              pageSize={pageSize}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
            />
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

export default function AdminQuotas() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [stateFilters, setStateFilters] = useState<string[]>([]);
  const [editing, setEditing] = useState<AdminService.ResourceQuotaItem>();
  const [detail, setDetail] = useState<AdminService.ResourceQuotaItem>();

  const { data: quotas = [], isFetching } = useQuery({
    queryKey: ['admin/resource-quotas'],
    queryFn: async () => (await listResourceQuotas()).data.data,
  });

  const mutation = useMutation({
    mutationFn: (limits: AdminService.ResourceQuotaLimits) =>
      updateResourceQuota(editing!.scope_type, editing!.scope_id, limits),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin/resource-quotas'] });
      queryClient.invalidateQueries({ queryKey: ['admin/userDetail'] });
      queryClient.invalidateQueries({ queryKey: ['admin/teams'] });
      queryClient.invalidateQueries({ queryKey: ['admin/resources'] });
      setDetail((current) =>
        current &&
        current.scope_type === editing?.scope_type &&
        current.scope_id === editing?.scope_id
          ? { ...current, ...response.data.data }
          : current,
      );
      setEditing(undefined);
      message.success(t('admin.resourceQuota.updated'));
    },
  });

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return quotas.filter((quota) => {
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
        matchesSelectedFilter(getQuotaState(quota), stateFilters)
      );
    });
  }, [query, quotas, stateFilters]);
  const quotasByScope = useMemo(
    () => ({
      personal: filtered.filter((quota) => quota.scope_type === 'personal'),
      team: filtered.filter((quota) => quota.scope_type === 'team'),
      dataset: filtered.filter((quota) => quota.scope_type === 'dataset'),
    }),
    [filtered],
  );

  const configuredCount = quotas.filter(
    (quota) => getQuotaState(quota) !== 'unlimited',
  ).length;
  const overLimitCount = quotas.filter(
    (quota) => getQuotaState(quota) === 'overLimit',
  ).length;
  const totalStorage = quotas
    .filter((quota) => quota.scope_type !== 'dataset')
    .reduce((sum, quota) => sum + quota.storage_bytes_used, 0);

  const scopeLabel = (scope: AdminService.ResourceQuotaScopeType) =>
    t(`admin.quotaManagementPage.scopeTypes.${scope}`);

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

          <CardContent className="space-y-5">
            {(['personal', 'team', 'dataset'] as const).map((scopeType) => (
              <QuotaTableSection
                key={scopeType}
                scopeType={scopeType}
                quotas={quotasByScope[scopeType]}
                loading={isFetching}
                onView={setDetail}
                onEdit={setEditing}
              />
            ))}
          </CardContent>
        </ScrollArea>
      </Card>

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(undefined)}
      >
        <DialogContent
          className="w-[min(720px,90vw)] max-w-none overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogHeader className="border-b border-border-button px-6 py-5">
            <div className="flex items-start gap-4 pr-7">
              <div className="min-w-0">
                <DialogTitle className="truncate">{detail?.name}</DialogTitle>
                <DialogDescription className="mt-1 truncate font-mono text-xs">
                  {detail?.scope_id}
                </DialogDescription>
              </div>
              {detail && (
                <Badge className="ml-auto shrink-0" variant="secondary">
                  {scopeLabel(detail.scope_type)}
                </Badge>
              )}
            </div>
          </DialogHeader>
          {detail && (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailInformationCard
                  icon={Gauge}
                  label={t('admin.quotaManagementPage.scopeType')}
                  value={scopeLabel(detail.scope_type)}
                />
                <DetailInformationCard
                  icon={HardDrive}
                  label={t('admin.quotaManagementPage.workspace')}
                  value={detail.workspace_name || '-'}
                />
                <DetailInformationCard
                  icon={ShieldAlert}
                  label={t('admin.quotaManagementPage.state')}
                  value={<QuotaStateBadge quota={detail} />}
                />
              </div>
              <QuotaMetricDetail
                title={t('admin.quotaManagementPage.fileQuotaUsage')}
                used={detail.file_count_used}
                limit={detail.file_count_limit}
              />
              <QuotaMetricDetail
                storage
                title={t('admin.quotaManagementPage.storageQuotaUsage')}
                used={detail.storage_bytes_used}
                limit={detail.storage_bytes_limit}
              />
            </div>
          )}
          <DialogFooter className="border-t border-border-button px-6 py-4">
            <Button variant="outline" onClick={() => setDetail(undefined)}>
              {t('admin.close')}
            </Button>
            <Button
              disabled={!detail}
              onClick={() => detail && setEditing(detail)}
            >
              <Pencil />
              {t('admin.resourceQuota.configure')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResourceQuotaDialog
        open={Boolean(editing)}
        quota={editing}
        scopeType={editing?.scope_type}
        saving={mutation.isPending}
        onOpenChange={(open) => !open && setEditing(undefined)}
        onSave={(limits) => mutation.mutate(limits)}
      />
    </TooltipProvider>
  );
}
