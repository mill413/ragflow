import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Building2,
  FileText,
  HardDrive,
  Library,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/utils';
import { getMonitoringSummary } from '@/services/admin-service';

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
        label: t('admin.monitoringPage.datasets'),
        value: data?.datasets_total,
        icon: Library,
      },
      {
        label: t('admin.monitoringPage.documents'),
        value: data?.documents_total,
        icon: FileText,
      },
      {
        label: t('admin.monitoringPage.storage'),
        value: data
          ? formatBytes(data.storage_bytes, { decimals: 1 })
          : undefined,
        icon: HardDrive,
      },
      {
        label: t('admin.monitoringPage.chats'),
        value: data?.chats_total,
        icon: MessageSquare,
      },
      {
        label: t('admin.monitoringPage.agents'),
        value: data?.agents_total,
        icon: Bot,
      },
    ],
    [data, t],
  );

  const maxStorage = Math.max(
    ...(data?.storage_distribution.map((item) => item.storage_bytes) ?? [0]),
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <CardContent className="space-y-4">
            {data?.storage_distribution.length ? (
              data.storage_distribution.map((item) => (
                <div key={item.workspace_id}>
                  <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate">
                      {item.workspace_type === 'team'
                        ? t('admin.monitoringPage.teamSpace')
                        : t('admin.monitoringPage.personalSpace')}
                      -{item.workspace_name}
                    </span>
                    <span className="shrink-0 text-text-secondary">
                      {formatBytes(item.storage_bytes, { decimals: 1 })}
                    </span>
                  </div>
                  <Progress
                    value={
                      maxStorage ? (item.storage_bytes / maxStorage) * 100 : 0
                    }
                    className="h-2"
                  />
                </div>
              ))
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
