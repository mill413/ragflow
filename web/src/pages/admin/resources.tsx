import {
  type Dispatch,
  type MouseEvent,
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
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  File,
  FileSearch,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  FolderTree,
  HardDrive,
  Hash,
  Import,
  Layers3,
  Library,
  MessageSquare,
  Rocket,
  Search,
  Shapes,
  ShieldCheck,
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
import { formatBytes } from '@/lib/utils';
import {
  deleteManagedResource,
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
type ResourceTableRow = {
  resource: AdminService.ManagedResourceItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  workspaceRoot: boolean;
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

function compareResources(
  left: AdminService.ManagedResourceItem,
  right: AdminService.ManagedResourceItem,
  sort: SortState,
) {
  const leftValue = left[sort.key as keyof AdminService.ManagedResourceItem];
  const rightValue = right[sort.key as keyof AdminService.ManagedResourceItem];
  const result = String(leftValue ?? '').localeCompare(
    String(rightValue ?? ''),
    undefined,
    { numeric: true },
  );
  return sort.direction === 'asc' ? result : -result;
}

function buildFileTreeRows(
  resources: AdminService.ManagedResourceItem[],
  sort: SortState,
  expandedIds: Set<string>,
  keywords: string,
): ResourceTableRow[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const childrenByParent = new Map<
    string,
    AdminService.ManagedResourceItem[]
  >();
  const roots: AdminService.ManagedResourceItem[] = [];

  resources.forEach((resource) => {
    const parent = resource.parent_id
      ? byId.get(resource.parent_id)
      : undefined;
    if (
      !parent ||
      parent.id === resource.id ||
      parent.workspace_id !== resource.workspace_id
    ) {
      roots.push(resource);
      return;
    }
    const siblings = childrenByParent.get(parent.id) ?? [];
    siblings.push(resource);
    childrenByParent.set(parent.id, siblings);
  });

  const normalizedKeywords = keywords.trim().toLocaleLowerCase();
  const matches = (resource: AdminService.ManagedResourceItem) =>
    !normalizedKeywords ||
    resource.name.toLocaleLowerCase().includes(normalizedKeywords) ||
    resource.id.toLocaleLowerCase().includes(normalizedKeywords);
  const visibleIds = new Set<string>();

  const markVisible = (
    resource: AdminService.ManagedResourceItem,
    visiting: Set<string>,
  ): boolean => {
    if (visiting.has(resource.id)) return false;
    const nextVisiting = new Set(visiting).add(resource.id);
    let hasVisibleChild = false;
    (childrenByParent.get(resource.id) ?? []).forEach((child) => {
      if (markVisible(child, nextVisiting)) hasVisibleChild = true;
    });
    const visible = matches(resource) || hasVisibleChild;
    if (visible) visibleIds.add(resource.id);
    return visible;
  };

  roots.forEach((root) => markVisible(root, new Set()));

  const rows: ResourceTableRow[] = [];
  const append = (
    resource: AdminService.ManagedResourceItem,
    depth: number,
    visited: Set<string>,
  ) => {
    if (visited.has(resource.id) || !visibleIds.has(resource.id)) return;
    const nextVisited = new Set(visited).add(resource.id);
    const children = (childrenByParent.get(resource.id) ?? [])
      .filter((child) => visibleIds.has(child.id))
      .sort((left, right) => compareResources(left, right, sort));
    const expanded =
      Boolean(normalizedKeywords) || expandedIds.has(resource.id);
    rows.push({
      resource,
      depth,
      hasChildren: children.length > 0,
      expanded,
      workspaceRoot: resource.parent_id === resource.id,
    });
    if (expanded) {
      children.forEach((child) => append(child, depth + 1, nextVisited));
    }
  };

  roots
    .filter((root) => visibleIds.has(root.id))
    .sort((left, right) => compareResources(left, right, sort))
    .forEach((root) => append(root, 0, new Set()));
  return rows;
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
  const resourceType = view;

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
  const resourceRows = useMemo<ResourceTableRow[]>(
    () =>
      resourceType === 'file'
        ? buildFileTreeRows(
            resourceData?.resources ?? [],
            resourceSort,
            expandedFileIds,
            deferredKeywords,
          )
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
            render: (resource) =>
              formatBytes(resource.storage_bytes ?? 0, { decimals: 1 }),
          },
          {
            key: 'failed_documents',
            label: t('admin.knowledgeMonitoring.parseStatus'),
            numeric: true,
            render: (resource) => (
              <div className="flex justify-center gap-2">
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
            numeric: true,
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
          value: formatBytes(document.size ?? 0, { decimals: 1 }),
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
                            <div
                              className="flex min-w-56 items-center gap-2"
                              style={{
                                paddingLeft:
                                  resourceType === 'file' ? depth * 20 : 0,
                              }}
                            >
                              {resourceType === 'file' && (
                                <>
                                  {hasChildren ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-6 shrink-0"
                                      aria-label={t(
                                        expanded
                                          ? 'admin.resourceManagementPage.collapseFolder'
                                          : 'admin.resourceManagementPage.expandFolder',
                                        {
                                          name: workspaceRoot
                                            ? `${t(
                                                resource.workspace_type ===
                                                  'team'
                                                  ? 'admin.teamWorkspace'
                                                  : 'admin.personalWorkspace',
                                              )}-${resource.workspace_name}`
                                            : resource.name,
                                        },
                                      )}
                                      onClick={(
                                        event: MouseEvent<HTMLButtonElement>,
                                      ) => {
                                        event.stopPropagation();
                                        toggleFileExpanded(resource.id);
                                      }}
                                    >
                                      {expanded ? (
                                        <ChevronDown className="size-4" />
                                      ) : (
                                        <ChevronRight className="size-4" />
                                      )}
                                    </Button>
                                  ) : (
                                    <span className="size-6 shrink-0" />
                                  )}
                                  {resource.file_type === 'folder' ? (
                                    expanded ? (
                                      <FolderOpen className="size-4 shrink-0 text-text-secondary" />
                                    ) : (
                                      <Folder className="size-4 shrink-0 text-text-secondary" />
                                    )
                                  ) : (
                                    <FileText className="size-4 shrink-0 text-text-secondary" />
                                  )}
                                </>
                              )}
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {workspaceRoot
                                    ? `${t(
                                        resource.workspace_type === 'team'
                                          ? 'admin.teamWorkspace'
                                          : 'admin.personalWorkspace',
                                      )}-${resource.workspace_name}`
                                    : resource.name ||
                                      t('admin.unnamedResource')}
                                </div>
                                <div className="max-w-48 truncate text-xs text-text-secondary">
                                  {resource.id}
                                </div>
                              </div>
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
          <SheetContent className="w-[min(900px,80vw)] max-w-none p-0">
            <SheetHeader className="border-b border-border-button px-6 py-5">
              <SheetTitle>
                {detailName || t('admin.unnamedResource')}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {t('admin.resourceManagementPage.resourceId')}：
                {detailId || '-'}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-97px)] px-6">
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
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </Card>
    </TooltipProvider>
  );
}
