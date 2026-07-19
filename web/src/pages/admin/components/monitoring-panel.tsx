import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
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
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalBytes } from '@/lib/utils';
import { Routes } from '@/routes';
import { getMonitoringSummary } from '@/services/admin-service';

import { StorageSize } from './storage-size';

const STORAGE_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
];

type MonitoringMetric = {
  label: string;
  value?: ReactNode;
  detail?: string;
  icon: typeof Library;
  route: Routes;
  breakdown?: Array<{
    label: string;
    value: number;
    error?: boolean;
  }>;
};

function formatPercentage(value: number, total: number) {
  if (!total || !value) return '0%';
  const percentage = (value / total) * 100;
  if (percentage < 0.1) return '<0.1%';
  return `${percentage.toFixed(percentage >= 10 ? 1 : 2)}%`;
}

function renderStorageLabel({ name, x, y, textAnchor }: PieLabelRenderProps) {
  return (
    <text
      x={x}
      y={y}
      className="fill-text-primary"
      textAnchor={textAnchor as 'start' | 'middle' | 'end' | undefined}
      dominantBaseline="central"
    >
      {name}
    </text>
  );
}

export default function MonitoringPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin/monitoring'],
    queryFn: async () => (await getMonitoringSummary()).data.data,
    refetchInterval: 30_000,
    retry: false,
  });

  const metrics = useMemo<MonitoringMetric[]>(
    () => [
      {
        label: t('admin.monitoringPage.datasets'),
        value: data?.datasets_total,
        icon: Library,
        route: Routes.AdminKnowledgeManagement,
      },
      {
        label: t('admin.monitoringPage.chats'),
        value: data?.chats_total,
        icon: MessageSquare,
        route: Routes.AdminChatManagement,
      },
      {
        label: t('admin.monitoringPage.searches'),
        value: data?.searches_total,
        icon: FileSearch,
        route: Routes.AdminSearchManagement,
      },
      {
        label: t('admin.monitoringPage.agents'),
        value: data?.agents_total,
        icon: Bot,
        route: Routes.AdminAgentManagement,
      },
      {
        label: t('admin.monitoringPage.memories'),
        value: data?.memories_total,
        icon: Brain,
        route: Routes.AdminMemoryManagement,
      },
      {
        label: t('admin.monitoringPage.users'),
        value: data?.users_total,
        detail: t('admin.monitoringPage.activeUsers', {
          count: data?.active_users ?? 0,
        }),
        icon: Users,
        route: Routes.AdminUserManagement,
      },
      {
        label: t('admin.monitoringPage.teams'),
        value: data?.teams_total,
        icon: Building2,
        route: Routes.AdminTeamManagement,
      },
      {
        label: t('admin.monitoringPage.files'),
        value: data?.files_total,
        icon: File,
        route: Routes.AdminFileManagement,
      },
      {
        label: t('admin.monitoringPage.storage'),
        value: data ? <StorageSize bytes={data.storage_bytes} /> : undefined,
        icon: HardDrive,
        route: Routes.AdminFileManagement,
      },
      {
        label: t('admin.monitoringPage.processing'),
        icon: Activity,
        route: Routes.AdminKnowledgeManagement,
        breakdown: [
          {
            label: t('admin.monitoringPage.processingDocuments'),
            value: data?.processing_documents ?? 0,
          },
          {
            label: t('admin.monitoringPage.pendingTasks'),
            value: data?.pending_tasks ?? 0,
          },
          {
            label: t('admin.monitoringPage.failedDocuments'),
            value: data?.failed_documents ?? 0,
            error: true,
          },
        ],
      },
    ],
    [data, t],
  );

  const storageData = useMemo(() => {
    const items = (data?.storage_distribution ?? []).map((item) => ({
      ...item,
      storage_bytes: Number(item.storage_bytes) || 0,
    }));
    const total = items.reduce((sum, item) => sum + item.storage_bytes, 0);
    return items
      .filter((item) => item.storage_bytes > 0)
      .map((item, index) => ({
        ...item,
        color: STORAGE_COLORS[index % STORAGE_COLORS.length],
        label: `${
          item.workspace_type === 'team'
            ? t('admin.monitoringPage.teamSpace')
            : t('admin.monitoringPage.personalSpace')
        }-${item.workspace_name}`,
        percentage: formatPercentage(item.storage_bytes, total),
      }));
  }, [data?.storage_distribution, t]);

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
        {metrics.map(
          ({ label, value, detail, icon: Icon, route, breakdown }) => (
            <Link key={label} to={route} aria-label={label} className="group">
              <Card className="h-full cursor-pointer bg-bg-input/70 transition-colors group-hover:border-text-secondary group-focus-visible:border-text-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between text-text-secondary transition-colors group-hover:text-text-primary">
                    <span className="text-sm">{label}</span>
                    <Icon className="size-5" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : breakdown ? (
                    <div className="grid grid-cols-3 gap-2">
                      {breakdown.map((item) => (
                        <div key={item.label} className="min-w-0">
                          <div
                            className={`text-xl font-semibold ${
                              item.error ? 'text-state-error' : ''
                            }`}
                          >
                            {item.value}
                          </div>
                          <div
                            className="mt-1 truncate text-xs text-text-secondary"
                            title={item.label}
                          >
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-3xl font-semibold">{value ?? 0}</div>
                  )}
                  {detail && (
                    <div className="mt-2 text-xs text-text-secondary">
                      {detail}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ),
        )}
      </div>

      <div>
        <Link
          to={Routes.AdminFileManagement}
          aria-label={t('admin.monitoringPage.storageDistribution')}
          className="group block"
        >
          <Card className="cursor-pointer transition-colors group-hover:border-text-secondary group-focus-visible:border-text-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t('admin.monitoringPage.storageDistribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storageData.length ? (
                <div className="h-80 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 24, right: 100, bottom: 36, left: 100 }}
                    >
                      <Pie
                        data={storageData}
                        dataKey="storage_bytes"
                        nameKey="label"
                        innerRadius="48%"
                        outerRadius="72%"
                        cy="42%"
                        labelLine
                        label={renderStorageLabel}
                      >
                        {storageData.map((item) => (
                          <Cell key={item.workspace_id} fill={item.color} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        formatter={(value, _name, item) => [
                          `${formatDecimalBytes(Number(value), { decimals: 1 })} (${item.payload.percentage})`,
                          item.payload.label,
                        ]}
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 8,
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        layout="horizontal"
                        iconType="circle"
                        wrapperStyle={{
                          maxHeight: 36,
                          overflowY: 'auto',
                          color: 'var(--text-primary)',
                        }}
                        formatter={(value) => (
                          <span className="text-text-primary">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-text-secondary">
                  {t('admin.monitoringPage.noStorage')}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  );
}
