import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BrainCircuit } from 'lucide-react';

import { TableEmpty } from '@/components/table-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/utils/date';

import { getSortIcon } from '../utils';
import { DetailInformationCard } from './detail-information-card';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './table-filter-utils';
import { AdminTableMultiFilters } from './table-multi-filters';

type UserModelSortState = {
  key: keyof AdminService.UserModelConfig;
  direction: 'asc' | 'desc';
};

function UserModelTable({ data }: { data: AdminService.UserModelConfig[] }) {
  const { t } = useTranslation();
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<UserModelSortState>({
    key: 'update_date',
    direction: 'desc',
  });

  const modelTypes = useMemo(
    () => [...new Set(data.flatMap((model) => model.model_types))].sort(),
    [data],
  );
  const rows = useMemo(
    () =>
      data
        .filter(
          (model) =>
            matchesSelectedFilter(model.provider_name, providerFilters) &&
            matchesSelectedFilter(model.status, statusFilters) &&
            (!typeFilters.length ||
              model.model_types.some((modelType) =>
                typeFilters.includes(modelType),
              )),
        )
        .sort((left, right) => {
          const result = String(left[sort.key] ?? '').localeCompare(
            String(right[sort.key] ?? ''),
            undefined,
            { numeric: true },
          );
          return sort.direction === 'asc' ? result : -result;
        }),
    [data, providerFilters, sort, statusFilters, typeFilters],
  );
  const toggleSort = (key: keyof AdminService.UserModelConfig) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortButton = (
    label: string,
    key: keyof AdminService.UserModelConfig,
  ) => (
    <Button variant="ghost" onClick={() => toggleSort(key)}>
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );

  return (
    <section className="space-y-4">
      <AdminTableMultiFilters
        filters={[
          {
            id: 'user-model-provider',
            label: t('admin.modelManagementPage.provider'),
            options: createFilterOptions(data, (model) => model.provider_name),
            value: providerFilters,
            onChange: setProviderFilters,
          },
          {
            id: 'user-model-type',
            label: t('admin.modelManagementPage.modelTypes'),
            options: modelTypes.map((modelType) => ({
              value: modelType,
              label: t(`admin.modelManagementPage.types.${modelType}`),
            })),
            value: typeFilters,
            onChange: setTypeFilters,
          },
          {
            id: 'user-model-status',
            label: t('admin.modelManagementPage.status'),
            options: [
              {
                value: 'active',
                label: t('admin.modelManagementPage.active'),
              },
              {
                value: 'inactive',
                label: t('admin.modelManagementPage.inactive'),
              },
            ],
            value: statusFilters,
            onChange: setStatusFilters,
          },
        ]}
        resetLabel={t('admin.reset')}
        onReset={() => {
          setProviderFilters([]);
          setTypeFilters([]);
          setStatusFilters([]);
        }}
      />

      <Table className="min-w-[1280px]">
        <TableHeader>
          <TableRow>
            <TableHead>
              {sortButton(t('admin.modelManagementPage.modelName'), 'name')}
            </TableHead>
            <TableHead>
              {sortButton(
                t('admin.modelManagementPage.provider'),
                'provider_name',
              )}
            </TableHead>
            <TableHead>
              {sortButton(
                t('admin.modelManagementPage.instance'),
                'instance_name',
              )}
            </TableHead>
            <TableHead>
              {sortButton(
                t('admin.modelManagementPage.modelTypes'),
                'model_types',
              )}
            </TableHead>
            <TableHead>
              {sortButton(t('admin.modelManagementPage.endpoint'), 'base_url')}
            </TableHead>
            <TableHead>
              {sortButton(t('admin.modelManagementPage.apiKey'), 'api_key')}
            </TableHead>
            <TableHead className="text-center">
              {sortButton(
                t('admin.modelManagementPage.maxTokens'),
                'max_tokens',
              )}
            </TableHead>
            <TableHead>
              {sortButton(t('admin.modelManagementPage.status'), 'status')}
            </TableHead>
            <TableHead>
              {sortButton(t('admin.lastUpdateTime'), 'update_date')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((model) => (
              <TableRow key={model.id}>
                <TableCell>
                  <div className="font-medium">{model.name || '-'}</div>
                  <div className="max-w-48 truncate text-xs text-text-secondary">
                    {model.id}
                  </div>
                </TableCell>
                <TableCell>{model.provider_name}</TableCell>
                <TableCell>{model.instance_name}</TableCell>
                <TableCell>
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {model.model_types.map((modelType) => (
                      <Badge key={modelType} variant="secondary">
                        {t(`admin.modelManagementPage.types.${modelType}`)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-56 truncate" title={model.base_url}>
                    {model.base_url || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div
                    className="max-w-48 truncate font-mono text-xs"
                    title={model.api_key}
                  >
                    {model.api_key || '-'}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {model.max_tokens}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      model.status === 'active' ? 'success' : 'secondary'
                    }
                  >
                    {t(
                      model.status === 'active'
                        ? 'admin.modelManagementPage.active'
                        : 'admin.modelManagementPage.inactive',
                    )}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(model.update_date) || '-'}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty columnsLength={9} />
          )}
        </TableBody>
      </Table>
    </section>
  );
}

export function UserModelConfiguration({
  configuration,
}: {
  configuration?: AdminService.UserModelConfiguration;
}) {
  const { t } = useTranslation();
  const defaults = configuration?.defaults ?? [];
  const models = configuration?.models ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="text-sm font-medium">
          {t('admin.defaultModelConfiguration')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defaults.map((model) => (
            <DetailInformationCard
              key={model.model_type}
              label={t(`admin.modelManagementPage.types.${model.model_type}`)}
              value={
                <div className="min-w-0 text-right">
                  <div className="break-all">{model.model_name || '-'}</div>
                  {model.model_id && (
                    <div className="mt-1 truncate text-xs font-normal text-text-secondary">
                      {model.model_id}
                    </div>
                  )}
                </div>
              }
              icon={BrainCircuit}
              valueClassName="flex justify-end"
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium">{t('admin.personalModels')}</div>
        <UserModelTable data={models} />
      </section>
    </div>
  );
}
