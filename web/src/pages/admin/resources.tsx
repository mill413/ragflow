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
  HardDrive,
  Hash,
  Import,
  Layers3,
  Library,
  Languages,
  MessageSquare,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  getDatasetResourceDetail,
  getManagedResourceDetail,
  getMonitoringSummary,
  listFailedDocuments,
  listManagedResources,
  listModelWorkspaces,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { Routes } from '@/routes';
import { getSortIcon } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { DetailInformationCard } from './components/detail-information-card';
import { StandardResourceDetail } from './components/resource-detail';
import { StorageSize } from './components/storage-size';
import {
  AdminFileTreeName,
  type AdminFileTreeRow,
  buildAdminFileTreeRows,
} from './components/file-tree';

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
          label: t('admin.knowledgeMonitoring.failureReason'),
          value: document.failure_reason || '-',
          icon: AlertTriangle,
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
          onOpenChange={(open) => !open && setSelectedDetail(undefined)}
        >
          <SheetContent className="w-[min(980px,90vw)] max-w-none overflow-hidden p-0">
            <SheetHeader className="border-b border-border-button px-6 py-5">
              <SheetTitle>
                {datasetDetail?.dataset.name ||
                  standardResourceDetail?.resource.name ||
                  detailName ||
                  t('admin.unnamedResource')}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {t('admin.resourceManagementPage.resourceId')}：
                {detailId || '-'}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-97px)] min-w-0 px-6">
              {selectedDatasetId ? (
                <Tabs defaultValue="overview" className="py-5">
                  <TabsList className="mb-5 h-auto justify-start gap-2 bg-transparent p-0">
                    <TabsTrigger value="overview">
                      {t('admin.resourceManagementPage.datasetDetail.overview')}
                    </TabsTrigger>
                    <TabsTrigger value="files">
                      {t('admin.resourceManagementPage.datasetDetail.files')}
                    </TabsTrigger>
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

                        <details
                          open
                          className="rounded-lg border-0.5 border-border-button bg-bg-input"
                        >
                          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                            {t(
                              'admin.resourceManagementPage.datasetDetail.retrievalConfiguration',
                            )}
                          </summary>
                          <div className="grid gap-3 border-t border-border-button p-4 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailInformationCard
                              icon={Activity}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.similarityThreshold',
                              )}
                              value={
                                datasetDetail.dataset.similarity_threshold ??
                                '-'
                              }
                            />
                            <DetailInformationCard
                              icon={Activity}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.vectorWeight',
                              )}
                              value={
                                datasetDetail.dataset
                                  .vector_similarity_weight ?? '-'
                              }
                            />
                            <DetailInformationCard
                              icon={Workflow}
                              label={t(
                                'admin.resourceManagementPage.datasetDetail.dataFlow',
                              )}
                              value={datasetDetail.dataset.pipeline_id || '-'}
                            />
                          </div>
                        </details>

                        <details className="rounded-lg border-0.5 border-border-button bg-bg-input">
                          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                            {t(
                              'admin.resourceManagementPage.datasetDetail.parserConfiguration',
                            )}
                          </summary>
                          <div className="grid gap-3 border-t border-border-button p-4 sm:grid-cols-2">
                            {Object.entries(
                              datasetDetail.dataset.parser_config ?? {},
                            ).map(([key, value]) => (
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
                            {!Object.keys(
                              datasetDetail.dataset.parser_config ?? {},
                            ).length && (
                              <div className="col-span-full py-6 text-center text-sm text-text-secondary">
                                {t('common.noData')}
                              </div>
                            )}
                          </div>
                        </details>
                      </>
                    ) : (
                      <div className="py-20 text-center text-sm text-text-secondary">
                        {t('common.noData')}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="files" className="mt-0 space-y-4">
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
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'name',
                              )}
                            </TableHead>
                            <TableHead>
                              {sortButton(
                                t('admin.resourceManagementPage.fileType'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'file_type',
                              )}
                            </TableHead>
                            <TableHead className="text-center">
                              {sortButton(
                                t('admin.knowledgeMonitoring.fileSize'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'size',
                              )}
                            </TableHead>
                            <TableHead>
                              {sortButton(
                                t('admin.knowledgeMonitoring.parseStatus'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'parse_status',
                              )}
                            </TableHead>
                            <TableHead className="text-center">
                              {sortButton(
                                t('admin.knowledgeMonitoring.chunkCount'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'chunk_num',
                              )}
                            </TableHead>
                            <TableHead className="text-center">
                              {sortButton(
                                t('admin.tokenNum'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'token_num',
                              )}
                            </TableHead>
                            <TableHead className="text-center">
                              {sortButton(
                                t(
                                  'admin.resourceManagementPage.datasetDetail.progress',
                                ),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'progress',
                              )}
                            </TableHead>
                            <TableHead>
                              {sortButton(
                                t('admin.createTime'),
                                datasetDocumentSort,
                                setDatasetDocumentSort,
                                'create_date',
                              )}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody
                          className={
                            datasetDetailFetching ? 'opacity-60' : undefined
                          }
                        >
                          {sortedDatasetDocuments.length ? (
                            sortedDatasetDocuments.map((document) => (
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
                                              : document.parse_status ===
                                                  'completed'
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
                                    Math.min(
                                      100,
                                      (document.progress ?? 0) * 100,
                                    ),
                                  ).toFixed(0)}
                                  %
                                </TableCell>
                                <TableCell>
                                  {formatDate(document.create_date) || '-'}
                                </TableCell>
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
                    </div>
                    <RAGFlowPagination
                      total={datasetDetail?.document_total ?? 0}
                      current={datasetDocumentPage}
                      pageSize={datasetDocumentPageSize}
                      onChange={(nextPage, nextPageSize) => {
                        setDatasetDocumentPage(nextPage);
                        setDatasetDocumentPageSize(nextPageSize);
                      }}
                    />
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
                </section>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </Card>
    </TooltipProvider>
  );
}
