import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Files, Gauge, HardDrive } from 'lucide-react';

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

type QuotaLimits = Pick<
  AdminService.ResourceQuota,
  'file_count_limit' | 'storage_bytes_limit'
>;

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
}: {
  quota?: AdminService.ResourceQuota;
}) {
  const { t } = useTranslation();
  const unlimited = t('admin.resourceQuota.unlimited');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}

export function ResourceQuotaDialog({
  open,
  quota,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  quota?: AdminService.ResourceQuota;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quota: QuotaLimits) => void;
}) {
  const { t } = useTranslation();
  const [fileCount, setFileCount] = useState('');
  const [storageValue, setStorageValue] = useState('');
  const [storageUnit, setStorageUnit] = useState<StorageUnit>('GiB');

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
  }, [open, quota]);

  const save = () => {
    const fileCountText = String(fileCount ?? '').trim();
    const storageText = String(storageValue ?? '').trim();
    const fileCountLimit = fileCountText === '' ? null : Number(fileCountText);
    const numericStorage = storageText === '' ? null : Number(storageText);
    if (
      (fileCountLimit !== null &&
        (!Number.isInteger(fileCountLimit) || fileCountLimit < 0)) ||
      (numericStorage !== null &&
        (!Number.isFinite(numericStorage) || numericStorage < 0))
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-5" />
            {t('admin.resourceQuota.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 px-6 sm:grid-cols-2">
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
