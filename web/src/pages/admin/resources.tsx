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
  Activity,
  ArrowDownToLine,
  Bot,
  Brain,
  CalendarPlus,
  Clock3,
  Database,
  File,
  FileSearch,
  FileText,
  FileType,
  FolderTree,
  Gauge,
  ExternalLink,
  HardDrive,
  Hash,
  Import,
  Layers3,
  Library,
  ListChevronsDownUp,
  ListChevronsUpDown,
  Languages,
  MessageSquare,
  Eye,
  Rocket,
  Search,
  Settings2,
  Shapes,
  ShieldCheck,
  TextQuote,
  Trash2,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import { AdminRefreshButton } from './components/admin-refresh-button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import message from '@/components/ui/message';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  deleteManagedResource,
  downloadManagedFile,
  getDatasetResourceDetail,
  getManagedResourceDetail,
  getMonitoringSummary,
  listFailedDocuments,
  listManagedResources,
  listModelWorkspaces,
  updateDatasetQuota,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { Routes } from '@/routes';
import { getExtension, isImage, isPdf } from '@/utils/document-util';
import { downloadFileFromBlob } from '@/utils/file-util';
import { getSortIcon, openMainAppAsAdmin } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { DetailInformationCard } from './components/detail-information-card';
import { AdminDetailTabsTrigger } from './components/detail-tabs-trigger';
import { StandardResourceDetail } from './components/resource-detail';
import { StorageSize } from './components/storage-size';
import {
  AdminFileTreeName,
  type AdminFileTreeRow,
  buildAdminFileTreeRows,
  getExpandableAdminFileIds,
} from './components/file-tree';
import {
  ResourceQuotaCards,
  ResourceQuotaDialog,
} from './components/resource-quota';

type ResourceView = AdminService.ManagedResourceType;
type SortState = { key: string; direction: 'asc' | 'desc' };
type ResourceColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  render: (resource: AdminService.ManagedResourceItem) => ReactNode;
};
type ResourceDetailItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};
type SelectedResourceDetail =
  | {
      kind: 'resource';
      resource: AdminService.ManagedResourceItem;
    }
  | {
      kind: 'failure';
      document: AdminService.FailedDocumentItem;
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
];

const RESOURCE_DETAIL_FIELD_ICONS: Record<string, LucideIcon> = {
  doc_num: FileText,
  chunk_num: Layers3,
  storage_bytes: HardDrive,
  failed_documents: AlertTriangle,
  dataset_count: Library,
  session_count: MessageSquare,
  document_count: FileText,
  canvas_type: Workflow,
  release: Rocket,
  memory_type: Brain,
  storage_type: Database,
  memory_size: HardDrive,
  file_type: FileType,
  size: HardDrive,
  source_type: Import,
};

const RESOURCE_VIEW_ROUTES: Record<string, ResourceView> = {
  datasets: 'dataset',
  chats: 'chat',
  searches: 'search',
  agents: 'agent',
  memories: 'memory',
  files: 'file',
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

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getMainResourcePath(resource: AdminService.ManagedResourceItem) {
  switch (resource.resource_type) {
    case 'dataset':
      return `${Routes.DatasetBase}${Routes.Files}/${resource.id}`;
    case 'chat':
      return `${Routes.Chat}/${resource.id}`;
    case 'search':
      return `${Routes.Search}/${resource.id}`;
    case 'agent':
      return `${Routes.Agent}/${resource.id}`;
    case 'memory':
      return `${Routes.Memory}${Routes.MemorySetting}/${resource.id}`;
    case 'file': {
      const search = new URLSearchParams({
        workspaceId: resource.workspace_id,
      });
      if (resource.file_type === 'folder') search.set('folderId', resource.id);
      else if (resource.parent_id) search.set('folderId', resource.parent_id);
      return `${Routes.Files}?${search.toString()}`;
    }
  }
}

const TEXT_FILE_EXTENSIONS = new Set([
  'css',
  'csv',
  'htm',
  'html',
  'ini',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mdx',
  'py',
  'sql',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

function isTextFile(resource: AdminService.ManagedResourceItem, blob: Blob) {
  return (
    blob.type.startsWith('text/') ||
    ['application/json', 'application/xml'].includes(blob.type) ||
    TEXT_FILE_EXTENSIONS.has(getExtension(resource.name))
  );
}

function getRawFileDisplayType(
  resource: AdminService.ManagedResourceItem,
  blob: Blob,
) {
  if (isTextFile(resource, blob)) return 'text' as const;
  if (blob.type.startsWith('image/') || isImage(getExtension(resource.name))) {
    return 'image' as const;
  }
  if (blob.type === 'application/pdf' || isPdf(resource.name)) {
    return 'pdf' as const;
  }
  return 'binary' as const;
}

function DatasetConfiguration({
  dataset,
}: {
  dataset: AdminService.DatasetResourceDetail;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="text-sm font-medium">
          {t(
            'admin.resourceManagementPage.datasetDetail.retrievalConfiguration',
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailInformationCard
            icon={Activity}
            label={t(
              'admin.resourceManagementPage.datasetDetail.similarityThreshold',
            )}
            value={dataset.similarity_threshold ?? '-'}
          />
          <DetailInformationCard
            icon={Activity}
            label={t('admin.resourceManagementPage.datasetDetail.vectorWeight')}
            value={dataset.vector_similarity_weight ?? '-'}
          />
          <DetailInformationCard
            icon={Workflow}
            label={t('admin.resourceManagementPage.datasetDetail.dataFlow')}
            value={dataset.pipeline_id || '-'}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium">
          {t('admin.resourceManagementPage.datasetDetail.parserConfiguration')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(dataset.parser_config ?? {}).map(([key, value]) => (
            <DetailInformationCard
              key={key}
              icon={Settings2}
              label={t(
                `admin.resourceManagementPage.datasetDetail.parserFields.${key}`,
                { defaultValue: key },
              )}
              value={formatDetailValue(value)}
            />
          ))}
          {!Object.keys(dataset.parser_config ?? {}).length && (
            <div className="col-span-full py-6 text-center text-sm text-text-secondary">
              {t('common.noData')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type DatasetDocumentTableProps = {
  dataset: AdminService.DatasetResourceDetail;
  documents: AdminService.DatasetDocumentDetail[];
  loading: boolean;
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize: number) => void;
  onPreview: (resource: AdminService.ManagedResourceItem) => void;
  onDownload: (resource: AdminService.ManagedResourceItem) => void;
};

function DatasetDocumentTable({
  dataset,
  documents,
  loading,
  sort,
  setSort,
  page,
  pageSize,
  total,
  onPageChange,
  onPreview,
  onDownload,
}: DatasetDocumentTableProps) {
  const { t } = useTranslation();
  const toggleSort = (key: string) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  const sortButton = (label: string, key: string) => (
    <Button variant="ghost" onClick={() => toggleSort(key)}>
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );
  const fileResource = (document: AdminService.DatasetDocumentDetail) =>
    document.file_id
      ? ({
          id: document.file_id,
          resource_type: 'file',
          name: document.name,
          workspace_id: dataset.workspace_id,
          workspace_name: dataset.workspace_name,
          workspace_type: dataset.workspace_type,
          creator_id: document.creator_id,
          creator_name: document.creator_name,
          permission: dataset.permission,
          create_date: document.create_date,
          update_date: document.update_date,
          size: document.size,
          file_type: document.file_type,
          source_type: document.source_type,
          deletable: false,
        } satisfies AdminService.ManagedResourceItem)
      : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4 text-text-secondary" />
        {t('admin.resourceManagementPage.datasetDetail.files')}
      </div>
      <Table
        rootClassName="max-w-full [contain:inline-size]"
        className="min-w-[1080px]"
      >
        <TableHeader>
          <TableRow>
            <TableHead>
              {sortButton(t('admin.knowledgeMonitoring.fileName'), 'name')}
            </TableHead>
            <TableHead>
              {sortButton(
                t('admin.resourceManagementPage.fileType'),
                'file_type',
              )}
            </TableHead>
            <TableHead className="text-center">
              {sortButton(t('admin.knowledgeMonitoring.fileSize'), 'size')}
            </TableHead>
            <TableHead>
              {sortButton(
                t('admin.knowledgeMonitoring.parseStatus'),
                'parse_status',
              )}
            </TableHead>
            <TableHead className="text-center">
              {sortButton(
                t('admin.knowledgeMonitoring.chunkCount'),
                'chunk_num',
              )}
            </TableHead>
            <TableHead className="text-center">
              {sortButton(t('admin.tokenNum'), 'token_num')}
            </TableHead>
            <TableHead className="text-center">
              {sortButton(
                t('admin.resourceManagementPage.datasetDetail.progress'),
                'progress',
              )}
            </TableHead>
            <TableHead>
              {sortButton(t('admin.createTime'), 'create_date')}
            </TableHead>
            <TableHead className="text-center">{t('admin.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={loading ? 'opacity-60' : undefined}>
          {documents.length ? (
            documents.map((document) => {
              const resource = fileResource(document);
              return (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="max-w-56 truncate font-medium">
                      {document.name || '-'}
                    </div>
                    <div className="max-w-56 truncate font-mono text-xs text-text-secondary">
                      {document.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    {document.suffix || document.file_type || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StorageSize bytes={document.size ?? 0} />
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Badge
                            variant={
                              document.parse_status === 'failed'
                                ? 'destructive'
                                : document.parse_status === 'completed'
                                  ? 'success'
                                  : 'secondary'
                            }
                          >
                            {t(
                              `admin.resourceManagementPage.datasetDetail.status.${document.parse_status}`,
                            )}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      {document.progress_msg && (
                        <TooltipContent className="max-w-sm">
                          {document.progress_msg}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-center">
                    {document.chunk_num ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {document.token_num ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.max(
                      0,
                      Math.min(100, (document.progress ?? 0) * 100),
                    ).toFixed(0)}
                    %
                  </TableCell>
                  <TableCell>
                    {formatDate(document.create_date) || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!resource}
                              onClick={() => resource && onPreview(resource)}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {resource
                            ? t('admin.resourceManagementPage.previewFile', {
                                name: document.name,
                              })
                            : t(
                                'admin.resourceManagementPage.originalFileUnavailable',
                              )}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!resource}
                              onClick={() => resource && onDownload(resource)}
                            >
                              <ArrowDownToLine className="size-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {resource
                            ? t('admin.resourceManagementPage.downloadFile', {
                                name: document.name,
                              })
                            : t(
                                'admin.resourceManagementPage.originalFileUnavailable',
                              )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={9}
                className="h-40 text-center text-text-secondary"
              >
                {t('common.noData')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <RAGFlowPagination
        total={total}
        current={page}
        pageSize={pageSize}
        onChange={onPageChange}
      />
    </section>
  );
}

export default function AdminResources() {
  const { t } = useTranslation();
  const { resourceView } = useParams<{ resourceView: string }>();
  const queryClient = useQueryClient();
  const view = RESOURCE_VIEW_ROUTES[resourceView ?? ''];
  const [keywords, setKeywords] = useState('');
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  const deferredKeywords = useDeferredValue(keywords);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [failurePage, setFailurePage] = useState(1);
  const [failurePageSize, setFailurePageSize] = useState(20);
  const [resourceSort, setResourceSort] = useState<SortState>({
    key: 'update_date',
    direction: 'desc',
  });
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [failureSort, setFailureSort] = useState<SortState>({
    key: 'create_date',
    direction: 'desc',
  });
  const [deleting, setDeleting] = useState<AdminService.ManagedResourceItem>();
  const [previewingFile, setPreviewingFile] =
    useState<AdminService.ManagedResourceItem>();
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [rawFileObjectUrl, setRawFileObjectUrl] = useState<string>();
  const [selectedDetail, setSelectedDetail] =
    useState<SelectedResourceDetail>();
  const [datasetDocumentPage, setDatasetDocumentPage] = useState(1);
  const [datasetDocumentPageSize, setDatasetDocumentPageSize] = useState(20);
  const [datasetDocumentSort, setDatasetDocumentSort] = useState<SortState>({
    key: 'create_date',
    direction: 'desc',
  });
  const resourceType = view;

  const selectedDatasetId =
    selectedDetail?.kind === 'resource' &&
    selectedDetail.resource.resource_type === 'dataset'
      ? selectedDetail.resource.id
      : undefined;
  const selectedStandardResource =
    selectedDetail?.kind === 'resource' &&
    selectedDetail.resource.resource_type !== 'dataset'
      ? selectedDetail.resource
      : undefined;

  useEffect(() => {
    setPage(1);
    setFailurePage(1);
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
      resourceType === 'file' ? '' : deferredKeywords,
      workspaceIds,
    ],
    queryFn: async () =>
      (
        await listManagedResources({
          type: resourceType!,
          page,
          pageSize,
          keywords: resourceType === 'file' ? undefined : deferredKeywords,
          workspaceIds,
          hierarchy: resourceType === 'file',
        })
      ).data.data,
    enabled: Boolean(resourceType),
  });
  const { data: workspaces = [] } = useQuery({
    queryKey: ['admin/model-workspaces'],
    queryFn: async () => (await listModelWorkspaces()).data.data,
  });
  const {
    data: rawFilePreview,
    isFetching: rawFilePreviewFetching,
    isError: rawFilePreviewError,
  } = useQuery({
    queryKey: [
      'admin/file-raw-content',
      previewingFile?.id,
      previewingFile?.workspace_id,
    ],
    queryFn: async () => {
      const resource = previewingFile!;
      const response = await downloadManagedFile(
        resource.id,
        resource.workspace_id,
      );
      const blob = response.data;
      const displayType = getRawFileDisplayType(resource, blob);

      return {
        blob,
        content: displayType === 'text' ? await blob.text() : undefined,
        displayType,
        mimeType: blob.type || 'application/octet-stream',
        size: blob.size,
      };
    },
    enabled: Boolean(previewingFile),
    retry: false,
  });
  useEffect(() => {
    if (
      !rawFilePreview?.blob ||
      !['image', 'pdf'].includes(rawFilePreview.displayType)
    ) {
      setRawFileObjectUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(rawFilePreview.blob);
    setRawFileObjectUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [rawFilePreview]);
  const { data: failureData, isFetching: failuresFetching } = useQuery({
    queryKey: [
      'admin/resources/failures',
      failurePage,
      failurePageSize,
      deferredKeywords,
      workspaceIds,
    ],
    queryFn: async () =>
      (
        await listFailedDocuments({
          page: failurePage,
          pageSize: failurePageSize,
          keywords: deferredKeywords,
          workspaceIds,
        })
      ).data.data,
    enabled: view === 'dataset',
  });
  const { data: datasetDetail, isFetching: datasetDetailFetching } = useQuery({
    queryKey: [
      'admin/resources/dataset-detail',
      selectedDatasetId,
      datasetDocumentPage,
      datasetDocumentPageSize,
    ],
    queryFn: async () =>
      (
        await getDatasetResourceDetail(
          selectedDatasetId!,
          datasetDocumentPage,
          datasetDocumentPageSize,
        )
      ).data.data,
    enabled: Boolean(selectedDatasetId),
  });
  const { data: standardResourceDetail, isFetching: standardDetailFetching } =
    useQuery({
      queryKey: [
        'admin/resources/detail',
        selectedStandardResource?.resource_type,
        selectedStandardResource?.id,
      ],
      queryFn: async () =>
        (
          await getManagedResourceDetail(
            selectedStandardResource!.resource_type as Exclude<
              AdminService.ManagedResourceType,
              'dataset'
            >,
            selectedStandardResource!.id,
          )
        ).data.data,
      enabled: Boolean(selectedStandardResource),
    });

  useEffect(() => {
    setDatasetDocumentPage(1);
  }, [selectedDatasetId]);

  useEffect(() => {
    if (resourceType !== 'file' || !resourceData?.resources.length) return;
    const rootIds = resourceData.resources
      .filter((resource) => resource.parent_id === resource.id)
      .map((resource) => resource.id);
    setExpandedFileIds((current) => {
      if (rootIds.every((id) => current.has(id))) return current;
      return new Set([...current, ...rootIds]);
    });
  }, [resourceData?.resources, resourceType]);

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
  const quotaMutation = useMutation({
    mutationFn: (
      quota: Pick<
        AdminService.ResourceQuota,
        'file_count_limit' | 'storage_bytes_limit'
      >,
    ) => updateDatasetQuota(selectedDatasetId!, quota),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin/resources/dataset-detail'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin/resources'] });
      setQuotaOpen(false);
      message.success(t('admin.resourceQuota.updated'));
    },
  });
  const downloadMutation = useMutation({
    mutationFn: async (resource: AdminService.ManagedResourceItem) => {
      const response = await downloadManagedFile(
        resource.id,
        resource.workspace_id,
      );
      return { blob: response.data, name: resource.name };
    },
    onSuccess: ({ blob, name }) => downloadFileFromBlob(blob, name),
  });

  const canPreviewFile = (resource: AdminService.ManagedResourceItem) =>
    resource.resource_type === 'file' && resource.file_type !== 'folder';

  const renderResourceActions = (
    resource: AdminService.ManagedResourceItem,
  ) => (
    <>
      {canPreviewFile(resource) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('admin.resourceManagementPage.previewFile', {
                name: resource.name,
              })}
              onClick={() => setPreviewingFile(resource)}
            >
              <Eye className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('admin.resourceManagementPage.previewFile', {
              name: resource.name,
            })}
          </TooltipContent>
        </Tooltip>
      )}
      {resource.resource_type === 'file' && resource.file_type !== 'folder' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                size="icon"
                variant="ghost"
                disabled={
                  downloadMutation.isPending &&
                  downloadMutation.variables?.id === resource.id
                }
                aria-label={t('admin.resourceManagementPage.downloadFile', {
                  name: resource.name,
                })}
                onClick={() => downloadMutation.mutate(resource)}
              >
                <ArrowDownToLine className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t('admin.resourceManagementPage.downloadFile', {
              name: resource.name,
            })}
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('admin.resourceManagementPage.openInRagflow', {
              name: resource.name,
            })}
            onClick={() => openMainAppAsAdmin(getMainResourcePath(resource))}
          >
            <ExternalLink className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('admin.resourceManagementPage.openInRagflow', {
            name: resource.name,
          })}
        </TooltipContent>
      </Tooltip>
    </>
  );

  const sortedResources = useMemo(
    () => sortRows(resourceData?.resources ?? [], resourceSort),
    [resourceData?.resources, resourceSort],
  );
  const resourceRows = useMemo<AdminFileTreeRow[]>(
    () =>
      resourceType === 'file'
        ? buildAdminFileTreeRows(resourceData?.resources ?? [], {
            sort: resourceSort,
            expandedIds: expandedFileIds,
            matches: (resource) => {
              const keywords = deferredKeywords.trim().toLocaleLowerCase();
              return (
                !keywords ||
                resource.name.toLocaleLowerCase().includes(keywords) ||
                resource.id.toLocaleLowerCase().includes(keywords)
              );
            },
            expandMatches: Boolean(deferredKeywords.trim()),
          })
        : sortedResources.map((resource) => ({
            resource,
            depth: 0,
            hasChildren: false,
            expanded: false,
            workspaceRoot: false,
          })),
    [
      deferredKeywords,
      expandedFileIds,
      resourceData?.resources,
      resourceSort,
      resourceType,
      sortedResources,
    ],
  );
  const sortedFailures = useMemo(
    () => sortRows(failureData?.documents ?? [], failureSort),
    [failureData?.documents, failureSort],
  );
  const sortedDatasetDocuments = useMemo(
    () => sortRows(datasetDetail?.documents ?? [], datasetDocumentSort),
    [datasetDetail?.documents, datasetDocumentSort],
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
  const toggleFileExpanded = (resourceId: string) => {
    setExpandedFileIds((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };
  const expandAllFiles = () => {
    setExpandedFileIds(
      getExpandableAdminFileIds(resourceData?.resources ?? []),
    );
  };
  const collapseAllFiles = () => {
    setExpandedFileIds(new Set());
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
            numeric: true,
            render: (resource) => resource.doc_num ?? 0,
          },
          {
            key: 'chunk_num',
            label: t('admin.knowledgeMonitoring.chunkCount'),
            numeric: true,
            render: (resource) => resource.chunk_num ?? 0,
          },
          {
            key: 'storage_bytes',
            label: t('admin.knowledgeMonitoring.storage'),
            numeric: true,
            render: (resource) => (
              <StorageSize bytes={resource.storage_bytes ?? 0} />
            ),
          },
          {
            key: 'failed_documents',
            label: t('admin.knowledgeMonitoring.parseStatus'),
            numeric: true,
            render: (resource) => (
              <div className="flex flex-col items-center justify-center gap-1.5">
                <Badge
                  className="whitespace-nowrap"
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
                  <Badge className="whitespace-nowrap" variant="secondary">
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
            numeric: true,
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'session_count',
            label: t('admin.resourceManagementPage.sessions'),
            numeric: true,
            render: (resource) => resource.session_count ?? 0,
          },
        ];
      case 'search':
        return [
          {
            key: 'dataset_count',
            label: t('admin.resourceManagementPage.referencedDatasets'),
            numeric: true,
            render: (resource) => resource.dataset_count ?? 0,
          },
          {
            key: 'document_count',
            label: t('admin.resourceManagementPage.referencedDocuments'),
            numeric: true,
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
            numeric: true,
            render: (resource) => resource.session_count ?? 0,
          },
        ];
      case 'memory':
        return [
          {
            key: 'memory_type',
            label: t('admin.resourceManagementPage.memoryType'),
            numeric: true,
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
            numeric: true,
            render: (resource) => (
              <StorageSize bytes={resource.memory_size ?? 0} />
            ),
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
            numeric: true,
            render: (resource) => <StorageSize bytes={resource.size ?? 0} />,
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

  const detailName =
    selectedDetail?.kind === 'resource'
      ? selectedDetail.resource.name
      : selectedDetail?.document.name;
  const detailId =
    selectedDetail?.kind === 'resource'
      ? selectedDetail.resource.id
      : selectedDetail?.document.id;
  const selectedResource =
    selectedDetail?.kind === 'resource' ? selectedDetail.resource : undefined;
  const detailItems: ResourceDetailItem[] = (() => {
    if (!selectedDetail) return [];

    if (selectedDetail.kind === 'failure') {
      const document = selectedDetail.document;
      return [
        {
          label: t('admin.resourceManagementPage.resourceType'),
          value: t('admin.resourceType.file'),
          icon: File,
        },
        {
          label: t('admin.workspaceOwner'),
          value: `${t(
            document.workspace_type === 'team'
              ? 'admin.teamWorkspace'
              : 'admin.personalWorkspace',
          )}-${document.workspace_name}`,
          icon: UsersRound,
        },
        {
          label: t('admin.knowledgeMonitoring.dataset'),
          value: document.dataset_name,
          icon: Library,
        },
        {
          label: t('admin.resourceManagementPage.datasetId'),
          value: document.dataset_id,
          icon: Hash,
        },
        {
          label: t('admin.knowledgeMonitoring.fileSize'),
          value: <StorageSize bytes={document.size ?? 0} />,
          icon: HardDrive,
        },
        {
          label: t('admin.createTime'),
          value: formatDate(document.create_date) || '-',
          icon: CalendarPlus,
        },
      ];
    }

    const resource = selectedDetail.resource;
    const items: ResourceDetailItem[] = [
      {
        label: t('admin.resourceManagementPage.resourceType'),
        value: t(`admin.resourceType.${resource.resource_type}`),
        icon: Shapes,
      },
      {
        label: t('admin.workspaceOwner'),
        value: `${t(
          resource.workspace_type === 'team'
            ? 'admin.teamWorkspace'
            : 'admin.personalWorkspace',
        )}-${resource.workspace_name}`,
        icon: UsersRound,
      },
      {
        label: t('admin.creator'),
        value: resource.creator_name || '-',
        icon: UserRound,
      },
      {
        label: t('admin.permission'),
        value: t(
          resource.permission === 'team'
            ? 'admin.teamWorkspace'
            : 'admin.personalWorkspace',
        ),
        icon: ShieldCheck,
      },
      ...resourceColumns
        .filter((column) => column.key !== 'creator_name')
        .map((column) => ({
          label: column.label,
          value: column.render(resource),
          icon: RESOURCE_DETAIL_FIELD_ICONS[column.key] ?? Shapes,
        })),
    ];

    if (resource.resource_type === 'dataset') {
      items.push({
        label: t('admin.tokenNum'),
        value: resource.token_num ?? 0,
        icon: Hash,
      });
    }
    if (resource.resource_type === 'file' && resource.parent_id) {
      items.push({
        label: t('admin.resourceManagementPage.parentId'),
        value: resource.parent_id,
        icon: FolderTree,
      });
    }

    items.push(
      {
        label: t('admin.createTime'),
        value: formatDate(resource.create_date) || '-',
        icon: CalendarPlus,
      },
      {
        label: t('admin.lastUpdateTime'),
        value: formatDate(resource.update_date) || '-',
        icon: Clock3,
      },
    );
    return items;
  })();

  const currentView = RESOURCE_VIEWS.find(({ type }) => type === view);
  if (!view || !currentView) {
    return <Navigate to={Routes.AdminKnowledgeManagement} replace />;
  }

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
            value: <StorageSize bytes={summary?.storage_bytes ?? 0} />,
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
            label: t(`admin.resourceManagementPage.totals.${view}`),
            value: resourceData?.total ?? 0,
            icon: currentView.icon,
          },
        ];
  const total = resourceData?.total;
  const isFetching = resourcesFetching;

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
                  {t(
                    `admin.resourceManagementPage.descriptions.${currentView.type}`,
                  )}
                </div>
              </div>
              <AdminRefreshButton
                queryKeys={[
                  ['admin/resources'],
                  ['admin/resources/failures'],
                  ['admin/resources/dataset-detail'],
                  ['admin/resources/detail'],
                  ['admin/monitoring'],
                  ['admin/model-workspaces'],
                ]}
              />
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

            <div className="flex flex-wrap items-center gap-3">
              <AdminTableMultiFilters
                filters={[
                  {
                    id: 'workspace',
                    label: t('admin.workspaceOwner'),
                    options: workspaces.map((workspace) => ({
                      value: workspace.id,
                      label: `${t(
                        workspace.type === 'team'
                          ? 'admin.teamWorkspace'
                          : 'admin.personalWorkspace',
                      )}-${workspace.name}`,
                    })),
                    value: workspaceIds,
                    onChange: (value) => {
                      setWorkspaceIds(value);
                      setPage(1);
                      setFailurePage(1);
                    },
                  },
                ]}
                resetLabel={t('admin.reset')}
                onReset={() => {
                  setWorkspaceIds([]);
                  setPage(1);
                  setFailurePage(1);
                }}
              />
              <div className="relative w-72 shrink-0">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="h-10 pl-9"
                  value={keywords}
                  onChange={(event) => {
                    setKeywords(event.target.value);
                    setPage(1);
                    setFailurePage(1);
                  }}
                  placeholder={t(
                    `admin.resourceManagementPage.searchPlaceholders.${currentView.type}`,
                  )}
                />
              </div>
              {resourceType === 'file' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={!resourceData?.resources.length}
                    onClick={expandAllFiles}
                  >
                    <ListChevronsUpDown className="size-4" />
                    {t('admin.resourceManagementPage.expandAllFolders')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={!resourceData?.resources.length}
                    onClick={collapseAllFiles}
                  >
                    <ListChevronsDownUp className="size-4" />
                    {t('admin.resourceManagementPage.collapseAllFolders')}
                  </Button>
                </>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table
                rootClassName="max-w-full [contain:inline-size]"
                className="min-w-[1080px]"
              >
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
                      <TableHead
                        key={column.key}
                        className={column.numeric ? 'text-center' : undefined}
                      >
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
                      {t('admin.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isFetching ? 'opacity-60' : undefined}>
                  {resourceRows.length ? (
                    resourceRows.map(
                      ({
                        resource,
                        depth,
                        hasChildren,
                        expanded,
                        workspaceRoot,
                      }) => (
                        <TableRow
                          key={resource.id}
                          className="group/row cursor-pointer"
                          onClick={() =>
                            setSelectedDetail({ kind: 'resource', resource })
                          }
                        >
                          <TableCell>
                            {resourceType === 'file' ? (
                              <AdminFileTreeName
                                row={{
                                  resource,
                                  depth,
                                  hasChildren,
                                  expanded,
                                  workspaceRoot,
                                }}
                                onToggle={toggleFileExpanded}
                              />
                            ) : (
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {resource.name || t('admin.unnamedResource')}
                                </div>
                                <div className="max-w-48 truncate text-xs text-text-secondary">
                                  {resource.id}
                                </div>
                              </div>
                            )}
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
                            <TableCell
                              key={column.key}
                              className={
                                column.numeric ? 'text-center' : undefined
                              }
                            >
                              {column.render(resource)}
                            </TableCell>
                          ))}
                          <TableCell>
                            {formatDate(resource.create_date) || '-'}
                          </TableCell>
                          <TableCell>
                            {formatDate(resource.update_date) || '-'}
                          </TableCell>
                          <TableCell
                            className="text-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {renderResourceActions(resource)}
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
                      ),
                    )
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
            </div>

            {resourceType !== 'file' && (
              <RAGFlowPagination
                total={total ?? 0}
                current={page}
                pageSize={pageSize}
                onChange={(nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                }}
              />
            )}

            {view === 'dataset' && (
              <section className="space-y-4 border-t border-border-button pt-6">
                <div>
                  <h3 className="text-base font-semibold">
                    {t('admin.resourceManagementPage.failures')}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {t('admin.resourceManagementPage.failureDescription')}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table
                    rootClassName="max-w-full [contain:inline-size]"
                    className="min-w-[980px]"
                  >
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
                        <TableHead className="text-center">
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
                    <TableBody
                      className={failuresFetching ? 'opacity-60' : undefined}
                    >
                      {sortedFailures.length ? (
                        sortedFailures.map((document) => (
                          <TableRow
                            key={document.id}
                            className="cursor-pointer"
                            onClick={() =>
                              setSelectedDetail({ kind: 'failure', document })
                            }
                          >
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
                            <TableCell className="text-center">
                              <StorageSize bytes={document.size ?? 0} />
                            </TableCell>
                            <TableCell className="w-[360px] max-w-[360px]">
                              <div className="line-clamp-2 break-all text-sm leading-5 text-state-error">
                                {document.failure_reason || '-'}
                              </div>
                              {document.failure_reason && (
                                <div className="mt-1 text-xs text-text-secondary">
                                  {t(
                                    'admin.resourceManagementPage.viewFullFailureReason',
                                  )}
                                </div>
                              )}
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
                            className="h-32 text-center text-text-secondary"
                          >
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <RAGFlowPagination
                  total={failureData?.total ?? 0}
                  current={failurePage}
                  pageSize={failurePageSize}
                  onChange={(nextPage, nextPageSize) => {
                    setFailurePage(nextPage);
                    setFailurePageSize(nextPageSize);
                  }}
                />
              </section>
            )}
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

        <Sheet
          open={Boolean(selectedDetail)}
          onOpenChange={(open) => {
            if (!open) setSelectedDetail(undefined);
            if (!open) setQuotaOpen(false);
          }}
        >
          <SheetContent className="w-[min(980px,90vw)] max-w-none overflow-hidden p-0">
            <SheetHeader className="border-b border-border-button px-6 py-5">
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="min-w-0">
                  <SheetTitle>
                    {datasetDetail?.dataset.name ||
                      standardResourceDetail?.resource.name ||
                      detailName ||
                      t('admin.unnamedResource')}
                  </SheetTitle>
                  <SheetDescription className="mt-1 truncate font-mono text-xs">
                    {t('admin.resourceManagementPage.resourceId')}：
                    {detailId || '-'}
                  </SheetDescription>
                </div>
                {selectedResource && (
                  <div className="flex shrink-0 items-center gap-1">
                    {selectedDatasetId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuotaOpen(true)}
                      >
                        <Gauge className="size-4" />
                        {t('admin.resourceQuota.configure')}
                      </Button>
                    )}
                    {renderResourceActions(selectedResource)}
                  </div>
                )}
              </div>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-97px)] min-w-0 px-6">
              {selectedDatasetId ? (
                <Tabs defaultValue="overview" className="py-5">
                  <TabsList className="mb-5 h-auto justify-start gap-2 bg-transparent p-0">
                    <AdminDetailTabsTrigger value="overview">
                      {t('admin.resourceManagementPage.datasetDetail.overview')}
                    </AdminDetailTabsTrigger>
                    <AdminDetailTabsTrigger value="configuration">
                      {t(
                        'admin.resourceManagementPage.datasetDetail.configuration',
                      )}
                    </AdminDetailTabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-0 space-y-5">
                    {datasetDetailFetching && !datasetDetail ? (
                      <div className="py-20 text-center text-sm text-text-secondary">
                        {t('common.loading')}
                      </div>
                    ) : datasetDetail ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <DetailInformationCard
                            icon={FileText}
                            label={t('admin.knowledgeMonitoring.documentCount')}
                            value={datasetDetail.dataset.doc_num ?? 0}
                          />
                          <DetailInformationCard
                            icon={HardDrive}
                            label={t('admin.knowledgeMonitoring.storage')}
                            value={
                              <StorageSize
                                bytes={datasetDetail.dataset.storage_bytes ?? 0}
                              />
                            }
                          />
                          <DetailInformationCard
                            icon={Layers3}
                            label={t('admin.knowledgeMonitoring.chunkCount')}
                            value={datasetDetail.dataset.chunk_num ?? 0}
                          />
                          <DetailInformationCard
                            icon={Hash}
                            label={t('admin.tokenNum')}
                            value={datasetDetail.dataset.token_num ?? 0}
                          />
                        </div>

                        <section className="space-y-3">
                          <div className="text-sm font-medium">
                            {t('admin.resourceQuota.title')}
                          </div>
                          <ResourceQuotaCards
                            quota={datasetDetail.dataset.quota}
                          />
                        </section>

                        <section className="space-y-3">
                          <div className="text-sm font-medium">
                            {t(
                              'admin.resourceManagementPage.resourceInformation',
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailInformationCard
                              icon={UsersRound}
                              label={t('admin.workspaceOwner')}
                              value={`${t(
                                datasetDetail.dataset.workspace_type === 'team'
                                  ? 'admin.teamWorkspace'
                                  : 'admin.personalWorkspace',
                              )}-${datasetDetail.dataset.workspace_name}`}
                            />
                            <DetailInformationCard
                              icon={UserRound}
                              label={t('admin.creator')}
                              value={datasetDetail.dataset.creator_name || '-'}
                            />
                            <DetailInformationCard
                              icon={TextQuote}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.description',
                              )}
                              value={datasetDetail.dataset.description || '-'}
                            />
                            <DetailInformationCard
                              icon={Brain}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.embeddingModel',
                              )}
                              value={datasetDetail.dataset.embd_id || '-'}
                            />
                            <DetailInformationCard
                              icon={Settings2}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.parseMethod',
                              )}
                              value={datasetDetail.dataset.parser_id || '-'}
                            />
                            <DetailInformationCard
                              icon={Languages}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.language',
                              )}
                              value={datasetDetail.dataset.language || '-'}
                            />
                            <DetailInformationCard
                              icon={Activity}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.pageRank',
                              )}
                              value={datasetDetail.dataset.pagerank ?? 0}
                            />
                            <DetailInformationCard
                              icon={CalendarPlus}
                              label={t('admin.createTime')}
                              value={
                                formatDate(datasetDetail.dataset.create_date) ||
                                '-'
                              }
                            />
                            <DetailInformationCard
                              icon={Clock3}
                              label={t('admin.lastUpdateTime')}
                              value={
                                formatDate(datasetDetail.dataset.update_date) ||
                                '-'
                              }
                            />
                          </div>
                        </section>

                        <DatasetDocumentTable
                          dataset={datasetDetail.dataset}
                          documents={sortedDatasetDocuments}
                          loading={datasetDetailFetching}
                          sort={datasetDocumentSort}
                          setSort={setDatasetDocumentSort}
                          page={datasetDocumentPage}
                          pageSize={datasetDocumentPageSize}
                          total={datasetDetail.document_total ?? 0}
                          onPageChange={(nextPage, nextPageSize) => {
                            setDatasetDocumentPage(nextPage);
                            setDatasetDocumentPageSize(nextPageSize);
                          }}
                          onPreview={setPreviewingFile}
                          onDownload={(resource) =>
                            downloadMutation.mutate(resource)
                          }
                        />
                      </>
                    ) : (
                      <div className="py-20 text-center text-sm text-text-secondary">
                        {t('common.noData')}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="configuration" className="mt-0 space-y-4">
                    {datasetDetail ? (
                      <DatasetConfiguration dataset={datasetDetail.dataset} />
                    ) : (
                      <div className="py-20 text-center text-sm text-text-secondary">
                        {datasetDetailFetching
                          ? t('common.loading')
                          : t('common.noData')}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : selectedStandardResource ? (
                <StandardResourceDetail
                  detail={standardResourceDetail}
                  loading={standardDetailFetching}
                />
              ) : (
                <section className="py-5">
                  <div className="mb-3 text-sm font-medium">
                    {t('admin.resourceManagementPage.resourceInformation')}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {detailItems.map(({ label, value, icon }, index) => (
                      <DetailInformationCard
                        key={`${label}-${index}`}
                        icon={icon}
                        label={label}
                        value={value}
                      />
                    ))}
                  </div>
                  {selectedDetail?.kind === 'failure' && (
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="size-4 text-state-error" />
                        {t('admin.knowledgeMonitoring.failureReason')}
                      </div>
                      <div className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border-0.5 border-state-error/30 bg-state-error/5 p-4 font-mono text-xs leading-6 text-text-primary select-text">
                        {selectedDetail.document.failure_reason || '-'}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <ResourceQuotaDialog
          open={quotaOpen}
          quota={datasetDetail?.dataset.quota}
          saving={quotaMutation.isPending}
          onOpenChange={setQuotaOpen}
          onSave={(quota) => quotaMutation.mutate(quota)}
        />

        <Dialog
          open={Boolean(previewingFile)}
          onOpenChange={(open) => !open && setPreviewingFile(undefined)}
        >
          <DialogContent className="grid h-[min(880px,92vh)] w-[min(1280px,94vw)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
            <DialogHeader className="m-0 px-5 py-4 pr-14">
              <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="truncate">
                    {previewingFile?.name || '-'}
                  </DialogTitle>
                  <DialogDescription className="mt-1 truncate font-mono text-xs">
                    {previewingFile?.id || '-'}
                  </DialogDescription>
                </div>
                {previewingFile && (
                  <Button
                    className="shrink-0"
                    size="sm"
                    variant="outline"
                    disabled={
                      downloadMutation.isPending &&
                      downloadMutation.variables?.id === previewingFile.id
                    }
                    onClick={() => downloadMutation.mutate(previewingFile)}
                  >
                    <ArrowDownToLine className="size-4" />
                    {t('admin.resourceManagementPage.downloadFile', {
                      name: previewingFile.name,
                    })}
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="min-h-0 overflow-auto border-t bg-muted/20 p-5">
              {rawFilePreviewFetching ? (
                <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                  {t('common.loading')}
                </div>
              ) : rawFilePreviewError ? (
                <div className="flex h-full items-center justify-center text-sm text-state-error">
                  {t('admin.resourceManagementPage.rawFileLoadFailed')}
                </div>
              ) : rawFilePreview?.content !== undefined ? (
                <pre className="min-h-full min-w-max whitespace-pre font-mono text-sm leading-6 text-text-primary">
                  {rawFilePreview.content}
                </pre>
              ) : rawFilePreview?.displayType === 'image' &&
                rawFileObjectUrl ? (
                <div className="flex size-full items-center justify-center">
                  <img
                    className="max-h-full max-w-full object-contain"
                    src={rawFileObjectUrl}
                    alt={previewingFile?.name || ''}
                  />
                </div>
              ) : rawFilePreview?.displayType === 'pdf' && rawFileObjectUrl ? (
                <iframe
                  className="size-full min-h-[480px] border-0 bg-white"
                  src={rawFileObjectUrl}
                  title={previewingFile?.name || ''}
                />
              ) : rawFilePreview ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-text-secondary">
                  <File className="size-10" />
                  <div className="font-medium text-text-primary">
                    {t('admin.resourceManagementPage.binaryFile')}
                  </div>
                  <div>
                    {t('admin.resourceManagementPage.binaryFileDescription')}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span>{rawFilePreview.mimeType}</span>
                    <span aria-hidden="true">·</span>
                    <StorageSize bytes={rawFilePreview.size} />
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}
