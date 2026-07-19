import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useFetchUserInfo, useListWorkspace } from '@/hooks/use-user-setting-request';
import type { IWorkspaceQuota } from '@/interfaces/database/workspace';
import { formatBytes, formatDecimalBytes } from '@/lib/utils';

const UNLIMITED_QUOTA: IWorkspaceQuota = {
  file_count_limit: null,
  storage_bytes_limit: null,
  file_count_used: 0,
  storage_bytes_used: 0,
};

function usagePercentage(used: number, limit: number | null) {
  if (limit === null) return null;
  if (limit === 0) return used > 0 ? 100 : 0;
  return Math.round((used / limit) * 1000) / 10;
}

function QuotaUsage({
  label,
  used,
  limit,
  storage = false,
}: {
  label: string;
  used: number;
  limit: number | null;
  storage?: boolean;
}) {
  const { t } = useTranslation();
  const percentage = usagePercentage(used, limit);
  const exceeded = limit !== null && used > limit;
  const format = (value: number) =>
    storage
      ? formatBytes(value, { decimals: 1, sizeType: 'accurate' })
      : value.toLocaleString();
  const decimalTitle = storage
    ? `${formatDecimalBytes(used, { decimals: 1 })} / ${
        limit === null
          ? t('homePage.workspaceQuota.unlimited')
          : formatDecimalBytes(limit, { decimals: 1 })
      }`
    : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={exceeded ? 'font-medium text-state-error' : 'font-medium'} title={decimalTitle}>
          {format(used)} /{' '}
          {limit === null
            ? t('homePage.workspaceQuota.unlimited')
            : format(limit)}
        </span>
      </div>
      {percentage !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-accent">
          <div
            className={
              exceeded
                ? 'h-full rounded-full bg-state-error'
                : 'h-full rounded-full bg-accent-primary'
            }
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function isOverQuota(quota: IWorkspaceQuota) {
  return (
    (quota.file_count_limit !== null &&
      quota.file_count_used > quota.file_count_limit) ||
    (quota.storage_bytes_limit !== null &&
      quota.storage_bytes_used > quota.storage_bytes_limit)
  );
}

export function WorkspaceQuotas() {
  const { t } = useTranslation();
  const { data: userInfo } = useFetchUserInfo();
  const { data: workspaces, loading } = useListWorkspace();

  return (
    <section className="mb-8 space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-semibold leading-8">
          <Gauge className="size-6" />
          {t('homePage.workspaceQuota.title')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t(
            userInfo.is_superuser
              ? 'homePage.workspaceQuota.adminDescription'
              : 'homePage.workspaceQuota.description',
          )}
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-xl bg-bg-card"
            />
          ))}
        </div>
      ) : (
        <div className="grid max-h-[420px] gap-4 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const quota = workspace.quota ?? UNLIMITED_QUOTA;
            const overQuota = isOverQuota(quota);
            return (
              <Card
                key={workspace.tenant_id}
                className="border-0.5 border-border-button bg-bg-card shadow-none"
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {workspace.name}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-text-secondary">
                        {workspace.tenant_id}
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <Badge variant="secondary">
                        {t(
                          workspace.workspace_type === 'team'
                            ? 'homePage.workspaceQuota.team'
                            : 'homePage.workspaceQuota.personal',
                        )}
                      </Badge>
                      {overQuota && (
                        <Badge variant="destructive">
                          {t('homePage.workspaceQuota.overLimit')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <QuotaUsage
                    label={t('homePage.workspaceQuota.files')}
                    used={quota.file_count_used}
                    limit={quota.file_count_limit}
                  />
                  <QuotaUsage
                    storage
                    label={t('homePage.workspaceQuota.storage')}
                    used={quota.storage_bytes_used}
                    limit={quota.storage_bytes_limit}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
