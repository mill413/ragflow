import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Brain,
  Database,
  Files,
  Gauge,
  HardDrive,
  MessageSquare,
  Search,
  UsersRound,
} from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { DetailInformationCard } from './detail-information-card';
import { StorageSize } from './storage-size';

type QuotaLimits = AdminService.ResourceQuotaLimits;
type QuotaScopeType = AdminService.ResourceQuotaScopeType;
type CreationMetric =
  | 'team_count'
  | 'dataset_count'
  | 'chat_count'
  | 'search_count'
  | 'agent_count'
  | 'memory_count';

const CREATION_METRICS: CreationMetric[] = [
  'team_count',
  'dataset_count',
  'chat_count',
  'search_count',
  'agent_count',
  'memory_count',
];

const CREATION_ICONS = {
  team_count: UsersRound,
  dataset_count: Database,
  chat_count: MessageSquare,
  search_count: Search,
  agent_count: Bot,
  memory_count: Brain,
};

type StorageUnit = 'MiB' | 'GiB' | 'TiB';

const STORAGE_UNIT_BYTES: Record<StorageUnit, number> = {
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
};

function storageInputValue(bytes: number | null): {
  value: string;
  unit: StorageUnit;
} {
  if (bytes === null) return { value: '', unit: 'GiB' };
  for (const unit of ['TiB', 'GiB', 'MiB'] as const) {
    const value = bytes / STORAGE_UNIT_BYTES[unit];
    if (Number.isInteger(value) || value >= 1) {
      return { value: String(Number(value.toFixed(3))), unit };
    }
  }
  return { value: String(bytes / STORAGE_UNIT_BYTES.MiB), unit: 'MiB' };
}

export function ResourceQuotaCards({
  quota,
  scopeType = 'dataset',
}: {
  quota?: AdminService.ResourceQuota;
  scopeType?: QuotaScopeType;
}) {
  const { t } = useTranslation();
  const unlimited = t('admin.resourceQuota.unlimited');
  const creationMetrics =
    scopeType === 'personal'
      ? CREATION_METRICS
      : scopeType === 'team'
        ? CREATION_METRICS.filter((metric) => metric !== 'team_count')
        : [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <DetailInformationCard
        icon={Files}
        label={t('admin.resourceQuota.fileCount')}
        value={
          <span>
            {quota?.file_count_used ?? 0} /{' '}
            {quota?.file_count_limit ?? unlimited}
          </span>
        }
      />
      <DetailInformationCard
        icon={HardDrive}
        label={t('admin.resourceQuota.storage')}
        value={
          <span className="inline-flex items-center gap-1">
            <StorageSize bytes={quota?.storage_bytes_used ?? 0} />
            <span>/</span>
            {quota?.storage_bytes_limit === null ||
            quota?.storage_bytes_limit === undefined ? (
              unlimited
            ) : (
              <StorageSize bytes={quota.storage_bytes_limit} />
            )}
          </span>
        }
      />
      {creationMetrics.map((metric) => {
        const Icon = CREATION_ICONS[metric];
        return (
          <DetailInformationCard
            key={metric}
            icon={Icon}
            label={t(`admin.resourceQuota.metrics.${metric}`)}
            value={
              <span>
                {quota?.[`${metric}_used`] ?? 0} /{' '}
                {quota?.[`${metric}_limit`] ?? unlimited}
              </span>
            }
          />
        );
      })}
    </div>
  );
}

export function ResourceQuotaDialog({
  open,
  quota,
  saving,
  onOpenChange,
  onSave,
  scopeType = 'dataset',
}: {
  open: boolean;
  quota?: AdminService.ResourceQuota;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quota: QuotaLimits) => void;
  scopeType?: QuotaScopeType;
}) {
  const { t } = useTranslation();
  const [fileCount, setFileCount] = useState('');
  const [storageValue, setStorageValue] = useState('');
  const [storageUnit, setStorageUnit] = useState<StorageUnit>('GiB');
  const [creationLimits, setCreationLimits] = useState<
    Record<CreationMetric, string>
  >(
    Object.fromEntries(
      CREATION_METRICS.map((metric) => [metric, '']),
    ) as Record<CreationMetric, string>,
  );

  useEffect(() => {
    if (!open) return;
    setFileCount(
      quota?.file_count_limit === null || quota?.file_count_limit === undefined
        ? ''
        : String(quota.file_count_limit),
    );
    const storage = storageInputValue(quota?.storage_bytes_limit ?? null);
    setStorageValue(storage.value);
    setStorageUnit(storage.unit);
    setCreationLimits(
      Object.fromEntries(
        CREATION_METRICS.map((metric) => {
          const limit = quota?.[`${metric}_limit`];
          return [
            metric,
            limit === null || limit === undefined ? '' : String(limit),
          ];
        }),
      ) as Record<CreationMetric, string>,
    );
  }, [open, quota]);

  const save = () => {
    const fileCountText = String(fileCount ?? '').trim();
    const storageText = String(storageValue ?? '').trim();
    const fileCountLimit = fileCountText === '' ? null : Number(fileCountText);
    const numericStorage = storageText === '' ? null : Number(storageText);
    const normalizedCreationLimits = Object.fromEntries(
      CREATION_METRICS.map((metric) => {
        const value = String(creationLimits[metric] ?? '').trim();
        return [`${metric}_limit`, value === '' ? null : Number(value)];
      }),
    ) as Pick<
      QuotaLimits,
      | 'team_count_limit'
      | 'dataset_count_limit'
      | 'chat_count_limit'
      | 'search_count_limit'
      | 'agent_count_limit'
      | 'memory_count_limit'
    >;
    if (
      (fileCountLimit !== null &&
        (!Number.isInteger(fileCountLimit) || fileCountLimit < 0)) ||
      (numericStorage !== null &&
        (!Number.isFinite(numericStorage) || numericStorage < 0)) ||
      Object.values(normalizedCreationLimits).some(
        (value) => value !== null && (!Number.isInteger(value) || value < 0),
      )
    ) {
      message.error(t('admin.resourceQuota.invalidLimit'));
      return;
    }
    onSave({
      file_count_limit: fileCountLimit,
      storage_bytes_limit:
        numericStorage === null
          ? null
          : Math.round(numericStorage * STORAGE_UNIT_BYTES[storageUnit]),
      ...normalizedCreationLimits,
    });
  };

  const creationMetrics =
    scopeType === 'personal'
      ? CREATION_METRICS
      : scopeType === 'team'
        ? CREATION_METRICS.filter((metric) => metric !== 'team_count')
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-5" />
            {t('admin.resourceQuota.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-5 overflow-y-auto px-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('admin.resourceQuota.fileCountLimit')}</Label>
            <Input
              min={0}
              step={1}
              type="number"
              placeholder={t('admin.resourceQuota.unlimited')}
              value={fileCount}
              onChange={(event) => setFileCount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.resourceQuota.storageLimit')}</Label>
            <div className="flex gap-2">
              <Input
                min={0}
                step="any"
                type="number"
                placeholder={t('admin.resourceQuota.unlimited')}
                value={storageValue}
                onChange={(event) => setStorageValue(event.target.value)}
              />
              <Select
                value={storageUnit}
                onValueChange={(value) => setStorageUnit(value as StorageUnit)}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(STORAGE_UNIT_BYTES).map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-xs text-text-secondary sm:col-span-2">
            {t('admin.resourceQuota.help')}
          </div>
          {creationMetrics.length > 0 && (
            <>
              <div className="border-t pt-4 text-sm font-medium sm:col-span-2">
                {t('admin.resourceQuota.creationLimits')}
              </div>
              {creationMetrics.map((metric) => (
                <div key={metric} className="space-y-2">
                  <Label>
                    {t(`admin.resourceQuota.metricLimits.${metric}`)}
                  </Label>
                  <Input
                    min={0}
                    step={1}
                    type="number"
                    placeholder={t('admin.resourceQuota.unlimited')}
                    value={creationLimits[metric]}
                    onChange={(event) =>
                      setCreationLimits((current) => ({
                        ...current,
                        [metric]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <div className="text-xs text-text-secondary sm:col-span-2">
                {t('admin.resourceQuota.creationHelp')}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={saving} onClick={save}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
