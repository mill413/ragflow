import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  FileText,
  HardDrive,
  Library,
  Search,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatBytes } from '@/lib/utils';
import {
  getMonitoringSummary,
  listFailedDocuments,
  listManagedResources,
} from '@/services/admin-service';

type KnowledgeTab = 'datasets' | 'failures';

export default function AdminResources() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<KnowledgeTab>('datasets');
  const [keywords, setKeywords] = useState('');
  const deferredKeywords = useDeferredValue(keywords);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: summary } = useQuery({
    queryKey: ['admin/monitoring'],
    queryFn: async () => (await getMonitoringSummary()).data.data,
    refetchInterval: 30_000,
    retry: false,
  });
  const { data: datasetData, isFetching: datasetsFetching } = useQuery({
    queryKey: ['admin/knowledge/datasets', page, pageSize, deferredKeywords],
    queryFn: async () =>
      (
        await listManagedResources({
          type: 'dataset',
          page,
          pageSize,
          keywords: deferredKeywords,
        })
      ).data.data,
    enabled: tab === 'datasets',
  });
  const { data: failureData, isFetching: failuresFetching } = useQuery({
    queryKey: ['admin/knowledge/failures', page, pageSize, deferredKeywords],
    queryFn: async () =>
      (
        await listFailedDocuments({
          page,
          pageSize,
          keywords: deferredKeywords,
        })
      ).data.data,
    enabled: tab === 'failures',
  });

  const metrics = [
    {
      label: t('admin.knowledgeMonitoring.datasets'),
      value: summary?.datasets_total ?? 0,
      icon: Library,
    },
    {
      label: t('admin.knowledgeMonitoring.documents'),
      value: summary?.documents_total ?? 0,
      icon: FileText,
    },
    {
      label: t('admin.knowledgeMonitoring.storage'),
      value: formatBytes(summary?.storage_bytes ?? 0, { decimals: 1 }),
      icon: HardDrive,
    },
    {
      label: t('admin.knowledgeMonitoring.failures'),
      value: summary?.failed_documents ?? 0,
      icon: AlertTriangle,
    },
  ];
  const total = tab === 'datasets' ? datasetData?.total : failureData?.total;
  const isFetching = tab === 'datasets' ? datasetsFetching : failuresFetching;

  return (
    <Card className="!shadow-none relative h-full flex flex-col border-0.5 border-border-button bg-transparent rounded-xl overflow-hidden">
      <Spotlight />
      <ScrollArea className="size-full">
        <CardHeader className="space-y-5">
          <div className="flex items-center justify-between gap-6">
            <CardTitle>{t('admin.knowledgeMonitoring.title')}</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <Input
                className="h-10 pl-9"
                value={keywords}
                onChange={(event) => {
                  setKeywords(event.target.value);
                  setPage(1);
                }}
                placeholder={t('admin.knowledgeMonitoring.search')}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-lg border-0.5 border-border-button bg-bg-input p-4"
              >
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{label}</span>
                  <Icon className="size-4" />
                </div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as KnowledgeTab);
              setPage(1);
            }}
          >
            <TabsList className="bg-transparent gap-2 p-0">
              <TabsTrigger
                value="datasets"
                className="border-0.5 border-border-button data-[state=active]:bg-bg-card"
              >
                {t('admin.knowledgeMonitoring.datasetTab')}
              </TabsTrigger>
              <TabsTrigger
                value="failures"
                className="border-0.5 border-border-button data-[state=active]:bg-bg-card"
              >
                {t('admin.knowledgeMonitoring.failureTab')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="space-y-4">
          {tab === 'datasets' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.name')}</TableHead>
                  <TableHead>{t('admin.workspaceOwner')}</TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.visibility')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.documentCount')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.chunkCount')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.storage')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.parseStatus')}
                  </TableHead>
                  <TableHead>{t('admin.lastUpdateTime')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={isFetching ? 'opacity-60' : undefined}>
                {datasetData?.resources.length ? (
                  datasetData.resources.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>
                        <div className="font-medium">
                          {dataset.name || t('admin.unnamedResource')}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {dataset.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(
                            dataset.workspace_type === 'team'
                              ? 'admin.teamWorkspace'
                              : 'admin.personalWorkspace',
                          )}
                          -{dataset.workspace_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t(
                          dataset.permission === 'team'
                            ? 'admin.knowledgeMonitoring.teamVisible'
                            : 'admin.knowledgeMonitoring.privateVisible',
                        )}
                      </TableCell>
                      <TableCell>{dataset.doc_num ?? 0}</TableCell>
                      <TableCell>{dataset.chunk_num ?? 0}</TableCell>
                      <TableCell>
                        {formatBytes(dataset.storage_bytes ?? 0, {
                          decimals: 1,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge
                            variant={
                              (dataset.failed_documents ?? 0) > 0
                                ? 'destructive'
                                : 'success'
                            }
                          >
                            {t('admin.knowledgeMonitoring.failedCount', {
                              count: dataset.failed_documents ?? 0,
                            })}
                          </Badge>
                          {(dataset.processing_documents ?? 0) > 0 && (
                            <Badge variant="secondary">
                              {t('admin.knowledgeMonitoring.processingCount', {
                                count: dataset.processing_documents,
                              })}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{dataset.update_date || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-40 text-center text-text-secondary"
                    >
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.fileName')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.dataset')}
                  </TableHead>
                  <TableHead>{t('admin.workspaceOwner')}</TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.fileSize')}
                  </TableHead>
                  <TableHead>
                    {t('admin.knowledgeMonitoring.failureReason')}
                  </TableHead>
                  <TableHead>{t('admin.createTime')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={isFetching ? 'opacity-60' : undefined}>
                {failureData?.documents.length ? (
                  failureData.documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="font-medium">{document.name}</div>
                        <div className="text-xs text-text-secondary">
                          {document.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{document.dataset_name}</div>
                        <div className="text-xs text-text-secondary">
                          {document.dataset_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(
                            document.workspace_type === 'team'
                              ? 'admin.teamWorkspace'
                              : 'admin.personalWorkspace',
                          )}
                          -{document.workspace_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatBytes(document.size ?? 0, { decimals: 1 })}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-state-error">
                        {document.failure_reason || '-'}
                      </TableCell>
                      <TableCell>{document.create_date || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-text-secondary"
                    >
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <RAGFlowPagination
            total={total ?? 0}
            current={page}
            pageSize={pageSize}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
          />
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
