import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Brain,
  Building2,
  File,
  FileSearch,
  HardDrive,
  Library,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/utils';
import { getMonitoringSummary } from '@/services/admin-service';

const STORAGE_COLORS = [
  '#00beb4',
  '#3ba05c',
  '#faad14',
  '#d8494b',
  '#5b8ff9',
  '#9270ca',
  '#6dc8ec',
  '#ff9d4d',
  '#269a99',
  '#ed6f91',
  '#7f8da9',
  '#bdd2fd',
];

function formatPercentage(value: number, total: number) {
  if (!total || !value) return '0%';
  const percentage = (value / total) * 100;
  if (percentage < 0.1) return '<0.1%';
  return `${percentage.toFixed(percentage >= 10 ? 1 : 2)}%`;
}

export default function MonitoringPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin/monitoring'],
    queryFn: async () => (await getMonitoringSummary()).data.data,
    refetchInterval: 30_000,
    retry: false,
  });

  const metrics = useMemo(
    () => [
      {
        label: t('admin.monitoringPage.datasets'),
        value: data?.datasets_total,
        icon: Library,
      },
      {
        label: t('admin.monitoringPage.chats'),
        value: data?.chats_total,
        icon: MessageSquare,
      },
      {
        label: t('admin.monitoringPage.searches'),
        value: data?.searches_total,
        icon: FileSearch,
      },
      {
        label: t('admin.monitoringPage.agents'),
        value: data?.agents_total,
        icon: Bot,
      },
      {
        label: t('admin.monitoringPage.memories'),
        value: data?.memories_total,
        icon: Brain,
      },
      {
        label: t('admin.monitoringPage.users'),
        value: data?.users_total,
        detail: t('admin.monitoringPage.activeUsers', {
          count: data?.active_users ?? 0,
        }),
        icon: Users,
      },
      {
        label: t('admin.monitoringPage.teams'),
        value: data?.teams_total,
        icon: Building2,
      },
      {
        label: t('admin.monitoringPage.files'),
        value: data?.files_total,
        icon: File,
      },
      {
        label: t('admin.monitoringPage.storage'),
        value: data
          ? formatBytes(data.files_storage_bytes, { decimals: 1 })
          : undefined,
        icon: HardDrive,
      },
    ],
    [data, t],
  );

  const distributedStorage = useMemo(
    () =>
      (data?.storage_distribution ?? []).reduce(
        (total, item) => total + item.storage_bytes,
        0,
      ),
    [data?.storage_distribution],
  );
  const storageData = useMemo(
    () =>
      (data?.storage_distribution ?? [])
        .filter((item) => item.storage_bytes > 0)
        .map((item, index) => ({
          ...item,
          color: STORAGE_COLORS[index % STORAGE_COLORS.length],
          label: `${
            item.workspace_type === 'team'
              ? t('admin.monitoringPage.teamSpace')
              : t('admin.monitoringPage.personalSpace')
          }-${item.workspace_name}`,
          percentage: formatPercentage(item.storage_bytes, distributedStorage),
        })),
    [data?.storage_distribution, distributedStorage, t],
  );

  return (
    <section className="space-y-6 border-b border-border-button px-6 py-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-xl font-semibold">
            {t('admin.monitoringPage.title')}
          </h2>
          <CardDescription>
            {t('admin.monitoringPage.description')}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : ''} />
          {t('admin.monitoringPage.refresh')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="bg-bg-input/70">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between text-text-secondary">
                <span className="text-sm">{label}</span>
                <Icon className="size-5" />
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="text-3xl font-semibold">{value ?? 0}</div>
              )}
              {detail && (
                <div className="mt-2 text-xs text-text-secondary">{detail}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t('admin.monitoringPage.processing')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-semibold">
                {data?.processing_documents ?? 0}
              </div>
              <div className="text-xs text-text-secondary">
                {t('admin.monitoringPage.processingDocuments')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold">
                {data?.pending_tasks ?? 0}
              </div>
              <div className="text-xs text-text-secondary">
                {t('admin.monitoringPage.pendingTasks')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-state-error">
                {data?.failed_documents ?? 0}
              </div>
              <div className="text-xs text-text-secondary">
                {t('admin.monitoringPage.failedDocuments')}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t('admin.monitoringPage.storageDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storageData.length ? (
              <div className="grid items-center gap-4 xl:grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)]">
                <div className="relative h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={storageData}
                        dataKey="storage_bytes"
                        nameKey="label"
                        innerRadius={72}
                        outerRadius={108}
                        paddingAngle={2}
                        stroke="var(--bg-card)"
                        strokeWidth={2}
                      >
                        {storageData.map((item) => (
                          <Cell key={item.workspace_id} fill={item.color} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        formatter={(value, _name, item) => [
                          `${formatBytes(Number(value), { decimals: 1 })} · ${item.payload.percentage}`,
                          item.payload.label,
                        ]}
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 8,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-text-secondary">
                      {t('admin.monitoringPage.storage')}
                    </span>
                    <span className="mt-1 text-xl font-semibold">
                      {formatBytes(data?.files_storage_bytes ?? 0, {
                        decimals: 1,
                      })}
                    </span>
                  </div>
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                  {storageData.map((item) => (
                    <div
                      key={item.workspace_id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      <span className="shrink-0 text-right text-text-secondary">
                        <span className="block">
                          {formatBytes(item.storage_bytes, { decimals: 1 })}
                        </span>
                        <span className="block text-xs">
                          {t('admin.monitoringPage.storagePercentage', {
                            percentage: item.percentage,
                          })}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary">
                {t('admin.monitoringPage.noStorage')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
