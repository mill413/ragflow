import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  Brain,
  File,
  FileSearch,
  FileText,
  HardDrive,
  Library,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/utils';
import {
  deleteManagedResource,
  getMonitoringSummary,
  listFailedDocuments,
  listManagedResources,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { Routes } from '@/routes';
import { getSortIcon } from './utils';

type ResourceView = AdminService.ManagedResourceType | 'failures';
type SortState = { key: string; direction: 'asc' | 'desc' };
type ResourceColumn = {
  key: string;
  label: string;
  render: (resource: AdminService.ManagedResourceItem) => ReactNode;
};

const RESOURCE_VIEWS: Array<{
  type: ResourceView;
  label: string;
  icon: typeof Library;
}> = [
  { type: 'dataset', label: 'knowledge', icon: Library },
  { type: 'chat', label: 'chat', icon: MessageSquare },
  { type: 'search', label: 'searchApp', icon: FileSearch },
  { type: 'agent', label: 'agent', icon: Bot },
  { type: 'memory', label: 'memory', icon: Brain },
  { type: 'file', label: 'file', icon: File },
  { type: 'failures', label: 'failures', icon: AlertTriangle },
];

const RESOURCE_VIEW_ROUTES: Record<string, ResourceView> = {
  datasets: 'dataset',
  chats: 'chat',
  searches: 'search',
  agents: 'agent',
  memories: 'memory',
  files: 'file',
  failures: 'failures',
};

function sortRows<T>(rows: T[], sort: SortState): T[] {
  return [...rows].sort((left, right) => {
    const leftValue = (left as Record<string, unknown>)[sort.key];
    const rightValue = (right as Record<string, unknown>)[sort.key];
    const result = String(leftValue ?? '').localeCompare(
      String(rightValue ?? ''),
      undefined,
      { numeric: true },
    );
    return sort.direction === 'asc' ? result : -result;
  });
}

export default function AdminResources() {
  const { t } = useTranslation();
  const { resourceView } = useParams<{ resourceView: string }>();
  const queryClient = useQueryClient();
  const view = RESOURCE_VIEW_ROUTES[resourceView ?? ''];
  const [keywords, setKeywords] = useState('');
  const deferredKeywords = useDeferredValue(keywords);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [resourceSort, setResourceSort] = useState<SortState>({
    key: 'update_date',
    direction: 'desc',
  });
  const [failureSort, setFailureSort] = useState<SortState>({
    key: 'create_date',
    direction: 'desc',
  });
  const [deleting, setDeleting] = useState<AdminService.ManagedResourceItem>();
  const resourceType = view === 'failures' ? undefined : view;

  useEffect(() => {
    setPage(1);
  }, [view]);

  const { data: summary } = useQuery({
    queryKey: ['admin/monitoring'],
    queryFn: async () => (await getMonitoringSummary()).data.data,
    refetchInterval: 30_000,
    retry: false,
  });
  const { data: resourceData, isFetching: resourcesFetching } = useQuery({
    queryKey: [
      'admin/resources',
      resourceType,
      page,
      pageSize,
      deferredKeywords,
    ],
    queryFn: async () =>
      (
        await listManagedResources({
          type: resourceType!,
          page,
          pageSize,
          keywords: deferredKeywords,
        })
      ).data.data,
    enabled: Boolean(resourceType),
  });
  const { data: failureData, isFetching: failuresFetching } = useQuery({
    queryKey: ['admin/resources/failures', page, pageSize, deferredKeywords],
    queryFn: async () =>
      (
        await listFailedDocuments({
          page,
          pageSize,
          keywords: deferredKeywords,
        })
      ).data.data,
    enabled: view === 'failures',
  });

  const deleteMutation = useMutation({
    mutationFn: (resource: AdminService.ManagedResourceItem) =>
      deleteManagedResource(resource.resource_type, resource.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/resources'] });
      queryClient.invalidateQueries({ queryKey: ['admin/monitoring'] });
      message.success(t('admin.resourceManagementPage.deleted'));
      setDeleting(undefined);
    },
  });

  const sortedResources = useMemo(
    () => sortRows(resourceData?.resources ?? [], resourceSort),
    [resourceData?.resources, resourceSort],
  );
  const sortedFailures = useMemo(
    () => sortRows(failureData?.documents ?? [], failureSort),
    [failureData?.documents, failureSort],
  );

  const toggleSort = (
    setter: Dispatch<SetStateAction<SortState>>,
    key: string,
  ) => {
    setter((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortButton = (
    label: string,
    state: SortState,
    setter: Dispatch<SetStateAction<SortState>>,
    key: string,
  ) => (
    <Button variant="ghost" onClick={() => toggleSort(setter, key)}>
      {label}
      {getSortIcon(state.key === key ? state.direction : false)}
    </Button>
  );

  const resourceColumns: ResourceColumn[] = (() => {
    switch (resourceType) {
      case 'dataset':
        return [
          {
            key: 'doc_num',
            label: t('admin.knowledgeMonitoring.documentCount'),
            render: (resource) => resource.doc_num ?? 0,
          },
          {
            key: 'chunk_num',
            label: t('admin.knowledgeMonitoring.chunkCount'),
            render: (resource) => resource.chunk_num ?? 0,
          },
          {
            key: 'storage_bytes',
            label: t('admin.knowledgeMonitoring.storage'),
            render: (resource) =>
              formatBytes(resource.storage_bytes ?? 0, { decimals: 1 }),
          },
          {
            key: 'failed_documents',
            label: t('admin.knowledgeMonitoring.parseStatus'),
            render: (resource) => (
              <div className="flex gap-2">
                <Badge
                  variant={
                    (resource.failed_documents ?? 0) > 0
                      ? 'destructive'
                      : 'success'
                  }
                >
                  {t('admin.knowledgeMonitoring.failedCount', {
                    count: resource.failed_documents ?? 0,
                  })}
                </Badge>
                {(resource.processing_documents ?? 0) > 0 && (
                  <Badge variant="secondary">
                    {t('admin.knowledgeMonitoring.processingCount', {
                      count: resource.processing_documents,
                    })}
                  </Badge>
                )}
              </div>
            ),
          },
        ];
      case 'chat':
        return [
          {
            key: 'dataset_count',
            label: t('admin.resourceManagementPage.referencedDatasets'),
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'session_count',
            label: t('admin.resourceManagementPage.sessions'),
            render: (resource) => resource.session_count ?? 0,
          },
        ];
      case 'search':
        return [
          {
            key: 'dataset_count',
            label: t('admin.resourceManagementPage.referencedDatasets'),
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'document_count',
            label: t('admin.resourceManagementPage.referencedDocuments'),
            render: (resource) => resource.document_count ?? 0,
          },
          {
            key: 'creator_name',
            label: t('admin.resourceManagementPage.creator'),
            render: (resource) => resource.creator_name || '-',
          },
        ];
      case 'agent':
        return [
          {
            key: 'canvas_type',
            label: t('admin.resourceManagementPage.canvasType'),
            render: (resource) => resource.canvas_type || '-',
          },
          {
            key: 'release',
            label: t('admin.resourceManagementPage.releaseStatus'),
            render: (resource) => (
              <Badge variant={resource.release ? 'success' : 'secondary'}>
                {t(
                  resource.release
                    ? 'admin.resourceManagementPage.released'
                    : 'admin.resourceManagementPage.unreleased',
                )}
              </Badge>
            ),
          },
          {
            key: 'session_count',
            label: t('admin.resourceManagementPage.sessions'),
            render: (resource) => resource.session_count ?? 0,
          },
        ];
      case 'memory':
        return [
          {
            key: 'memory_type',
            label: t('admin.resourceManagementPage.memoryType'),
            render: (resource) => resource.memory_type ?? '-',
          },
          {
            key: 'storage_type',
            label: t('admin.resourceManagementPage.storageType'),
            render: (resource) => resource.storage_type || '-',
          },
          {
            key: 'memory_size',
            label: t('admin.resourceManagementPage.capacity'),
            render: (resource) =>
              formatBytes(resource.memory_size ?? 0, { decimals: 1 }),
          },
        ];
      case 'file':
        return [
          {
            key: 'file_type',
            label: t('admin.resourceManagementPage.fileType'),
            render: (resource) => resource.file_type || '-',
          },
          {
            key: 'size',
            label: t('admin.knowledgeMonitoring.fileSize'),
            render: (resource) =>
              formatBytes(resource.size ?? 0, { decimals: 1 }),
          },
          {
            key: 'source_type',
            label: t('admin.resourceManagementPage.sourceType'),
            render: (resource) => resource.source_type || '-',
          },
          {
            key: 'creator_name',
            label: t('admin.resourceManagementPage.creator'),
            render: (resource) => resource.creator_name || '-',
          },
        ];
      default:
        return [];
    }
  })();

  const metrics =
    resourceType === 'dataset'
      ? [
          {
            label: t('admin.knowledgeMonitoring.datasets'),
            value: summary?.datasets_total ?? resourceData?.total ?? 0,
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
        ]
      : [
          {
            label: t('admin.resourceManagementPage.total'),
            value:
              view === 'failures'
                ? (failureData?.total ?? 0)
                : (resourceData?.total ?? 0),
            icon:
              RESOURCE_VIEWS.find(({ type }) => type === view)?.icon ?? Library,
          },
        ];
  const total = view === 'failures' ? failureData?.total : resourceData?.total;
  const isFetching = view === 'failures' ? failuresFetching : resourcesFetching;
  const currentView = RESOURCE_VIEWS.find(({ type }) => type === view);

  if (!view || !currentView) {
    return <Navigate to={Routes.AdminKnowledgeManagement} replace />;
  }

  return (
    <TooltipProvider>
      <Card className="!shadow-none relative h-full flex flex-col border-0.5 border-border-button bg-transparent rounded-xl overflow-hidden">
        <Spotlight />
        <ScrollArea className="size-full">
          <CardHeader className="space-y-5">
            <div className="flex items-center justify-between gap-6">
              <div>
                <CardTitle>
                  {t(`admin.resourceManagementPage.${currentView.label}`)}
                </CardTitle>
                <div className="mt-2 text-sm text-text-secondary">
                  {t('admin.resourceManagementPage.description')}
                </div>
              </div>
              <div className="relative w-72 shrink-0">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="h-10 pl-9"
                  value={keywords}
                  onChange={(event) => {
                    setKeywords(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t(
                    view === 'failures'
                      ? 'admin.knowledgeMonitoring.search'
                      : 'admin.resourceManagementPage.search',
                  )}
                />
              </div>
            </div>

            <div
              className={
                resourceType === 'dataset'
                  ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
                  : 'grid max-w-xs gap-3'
              }
            >
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
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              {view !== 'failures' ? (
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {sortButton(
                          t('admin.name'),
                          resourceSort,
                          setResourceSort,
                          'name',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.workspaceOwner'),
                          resourceSort,
                          setResourceSort,
                          'workspace_name',
                        )}
                      </TableHead>
                      {resourceColumns.map((column) => (
                        <TableHead key={column.key}>
                          {sortButton(
                            column.label,
                            resourceSort,
                            setResourceSort,
                            column.key,
                          )}
                        </TableHead>
                      ))}
                      <TableHead>
                        {sortButton(
                          t('admin.createTime'),
                          resourceSort,
                          setResourceSort,
                          'create_date',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.lastUpdateTime'),
                          resourceSort,
                          setResourceSort,
                          'update_date',
                        )}
                      </TableHead>
                      <TableHead className="text-center">
                        {t('admin.operation')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className={isFetching ? 'opacity-60' : undefined}>
                    {sortedResources.length ? (
                      sortedResources.map((resource) => (
                        <TableRow key={resource.id}>
                          <TableCell>
                            <div className="font-medium">
                              {resource.name || t('admin.unnamedResource')}
                            </div>
                            <div className="max-w-48 truncate text-xs text-text-secondary">
                              {resource.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {t(
                                resource.workspace_type === 'team'
                                  ? 'admin.teamWorkspace'
                                  : 'admin.personalWorkspace',
                              )}
                              -{resource.workspace_name}
                            </Badge>
                          </TableCell>
                          {resourceColumns.map((column) => (
                            <TableCell key={column.key}>
                              {column.render(resource)}
                            </TableCell>
                          ))}
                          <TableCell>
                            {formatDate(resource.create_date) || '-'}
                          </TableCell>
                          <TableCell>
                            {formatDate(resource.update_date) || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={!resource.deletable}
                                    aria-label={t(
                                      'admin.resourceManagementPage.deleteAction',
                                      { name: resource.name },
                                    )}
                                    onClick={() => setDeleting(resource)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t(
                                  resource.deletable
                                    ? 'admin.resourceManagementPage.deleteAction'
                                    : 'admin.resourceManagementPage.managedBySource',
                                  { name: resource.name },
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={resourceColumns.length + 5}
                          className="h-40 text-center text-text-secondary"
                        >
                          {t('common.noData')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {sortButton(
                          t('admin.knowledgeMonitoring.fileName'),
                          failureSort,
                          setFailureSort,
                          'name',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.knowledgeMonitoring.dataset'),
                          failureSort,
                          setFailureSort,
                          'dataset_name',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.workspaceOwner'),
                          failureSort,
                          setFailureSort,
                          'workspace_name',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.knowledgeMonitoring.fileSize'),
                          failureSort,
                          setFailureSort,
                          'size',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.knowledgeMonitoring.failureReason'),
                          failureSort,
                          setFailureSort,
                          'failure_reason',
                        )}
                      </TableHead>
                      <TableHead>
                        {sortButton(
                          t('admin.createTime'),
                          failureSort,
                          setFailureSort,
                          'create_date',
                        )}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className={isFetching ? 'opacity-60' : undefined}>
                    {sortedFailures.length ? (
                      sortedFailures.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            <div className="font-medium">{document.name}</div>
                            <div className="max-w-48 truncate text-xs text-text-secondary">
                              {document.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{document.dataset_name}</div>
                            <div className="max-w-48 truncate text-xs text-text-secondary">
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
                          <TableCell>
                            {formatDate(document.create_date) || '-'}
                          </TableCell>
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
            </div>

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

        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) setDeleting(undefined);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('admin.resourceManagementPage.deleteResource')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.resourceManagementPage.deleteConfirmation', {
                  name: deleting?.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                {t('admin.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-state-error hover:bg-state-error/90"
                disabled={deleteMutation.isPending}
                onClick={() => deleting && deleteMutation.mutate(deleting)}
              >
                {t('admin.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </TooltipProvider>
  );
}
