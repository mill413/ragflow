import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Activity,
  Bot,
  Brain,
  CalendarPlus,
  Clock3,
  Database,
  FileText,
  FolderTree,
  Gauge,
  HardDrive,
  Languages,
  Library,
  MessageSquare,
  Network,
  Rocket,
  ShieldCheck,
  Tags,
  TextQuote,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/utils/date';
import { DetailInformationCard } from './detail-information-card';
import { StorageSize } from './storage-size';

type DetailItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};

type StandardResourceDetailProps = {
  detail?: AdminService.StandardManagedResourceDetailResponse;
  loading: boolean;
};

function ConfigurationSection({
  name,
  value,
}: {
  name: string;
  value: unknown;
}) {
  const { t } = useTranslation();
  const label = t(
    `admin.resourceManagementPage.resourceDetail.configurationSections.${name}`,
    { defaultValue: name },
  );
  const formatted =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value ?? '-');

  return (
    <details
      open
      className="rounded-lg border-0.5 border-border-button bg-bg-input"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {label}
      </summary>
      <div className="border-t border-border-button p-4">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg-card p-3 font-mono text-xs leading-6 text-text-primary">
          {formatted}
        </pre>
      </div>
    </details>
  );
}

function buildDetailItems(
  resource: AdminService.StandardManagedResourceDetail,
  t: (key: string, options?: Record<string, unknown>) => string,
): DetailItem[] {
  const items: DetailItem[] = [
    {
      label: t('admin.workspaceOwner'),
      value: `${t(
        resource.workspace_type === 'team'
          ? 'admin.teamWorkspace'
          : 'admin.personalWorkspace',
      )}-${resource.workspace_name}`,
      icon: UsersRound,
    },
  ];

  if (resource.creator_name) {
    items.push({
      label: t('admin.creator'),
      value: resource.creator_name,
      icon: UserRound,
    });
  }
  if (resource.description !== undefined) {
    items.push({
      label: t('admin.resourceManagementPage.datasetDetail.description'),
      value: resource.description || '-',
      icon: TextQuote,
    });
  }

  switch (resource.resource_type) {
    case 'chat':
      items.push(
        {
          label: t('admin.resourceManagementPage.resourceDetail.language'),
          value: resource.language || '-',
          icon: Languages,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.chatModel'),
          value: resource.llm_id || '-',
          icon: Bot,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.rerankModel'),
          value: resource.rerank_id || '-',
          icon: Activity,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.promptType'),
          value: resource.prompt_type || '-',
          icon: TextQuote,
        },
        {
          label: t('admin.resourceManagementPage.sessions'),
          value: resource.session_count ?? 0,
          icon: MessageSquare,
        },
        {
          label: t('admin.resourceManagementPage.referencedDatasets'),
          value: resource.dataset_count ?? 0,
          icon: Library,
        },
        {
          label: t(
            'admin.resourceManagementPage.datasetDetail.similarityThreshold',
          ),
          value: resource.similarity_threshold ?? '-',
          icon: Gauge,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.topN'),
          value: resource.top_n ?? '-',
          icon: Gauge,
        },
      );
      break;
    case 'search':
      items.push(
        {
          label: t('admin.resourceManagementPage.referencedDatasets'),
          value: resource.dataset_count ?? 0,
          icon: Library,
        },
        {
          label: t('admin.resourceManagementPage.referencedDocuments'),
          value: resource.document_count ?? 0,
          icon: FileText,
        },
      );
      break;
    case 'agent':
      items.push(
        {
          label: t('admin.resourceManagementPage.canvasType'),
          value: resource.canvas_type || '-',
          icon: Workflow,
        },
        {
          label: t(
            'admin.resourceManagementPage.resourceDetail.canvasCategory',
          ),
          value: resource.canvas_category || '-',
          icon: Network,
        },
        {
          label: t('admin.resourceManagementPage.releaseStatus'),
          value: t(
            resource.release
              ? 'admin.resourceManagementPage.released'
              : 'admin.resourceManagementPage.unreleased',
          ),
          icon: Rocket,
        },
        {
          label: t('admin.resourceManagementPage.sessions'),
          value: resource.session_count ?? 0,
          icon: MessageSquare,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.tags'),
          value: resource.tags || '-',
          icon: Tags,
        },
      );
      break;
    case 'memory':
      items.push(
        {
          label: t('admin.resourceManagementPage.memoryType'),
          value: resource.memory_type ?? '-',
          icon: Brain,
        },
        {
          label: t('admin.resourceManagementPage.storageType'),
          value: resource.storage_type || '-',
          icon: Database,
        },
        {
          label: t('admin.resourceManagementPage.capacity'),
          value: <StorageSize bytes={resource.memory_size ?? 0} />,
          icon: HardDrive,
        },
        {
          label: t('admin.resourceManagementPage.datasetDetail.embeddingModel'),
          value: resource.embd_id || '-',
          icon: Brain,
        },
        {
          label: t('admin.resourceManagementPage.resourceDetail.chatModel'),
          value: resource.llm_id || '-',
          icon: Bot,
        },
        {
          label: t(
            'admin.resourceManagementPage.resourceDetail.forgettingPolicy',
          ),
          value: resource.forgetting_policy || '-',
          icon: Clock3,
        },
      );
      break;
    case 'file':
      items.push(
        {
          label: t('admin.resourceManagementPage.fileType'),
          value: resource.file_type || '-',
          icon: FileText,
        },
        {
          label: t('admin.knowledgeMonitoring.fileSize'),
          value: <StorageSize bytes={resource.size ?? 0} />,
          icon: HardDrive,
        },
        {
          label: t('admin.resourceManagementPage.sourceType'),
          value: resource.source_type || '-',
          icon: ShieldCheck,
        },
        {
          label: t('admin.resourceManagementPage.parentId'),
          value: resource.parent_id || '-',
          icon: FolderTree,
        },
      );
      break;
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
}

export function StandardResourceDetail({
  detail,
  loading,
}: StandardResourceDetailProps) {
  const { t } = useTranslation();

  if (loading && !detail) {
    return (
      <div className="py-20 text-center text-sm text-text-secondary">
        {t('common.loading')}
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="py-20 text-center text-sm text-text-secondary">
        {t('common.noData')}
      </div>
    );
  }

  const detailItems = buildDetailItems(detail.resource, t);
  const configurations = Object.entries(detail.configuration ?? {});

  return (
    <Tabs defaultValue="overview" className="py-5">
      <TabsList className="mb-5 h-auto justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="overview">
          {t('admin.resourceManagementPage.datasetDetail.overview')}
        </TabsTrigger>
        <TabsTrigger value="configuration">
          {t('admin.resourceManagementPage.resourceDetail.configuration')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0 space-y-5">
        <section className="space-y-3">
          <div className="text-sm font-medium">
            {t('admin.resourceManagementPage.resourceInformation')}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detailItems.map((item, index) => (
              <DetailInformationCard
                key={`${item.label}-${index}`}
                icon={item.icon}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </section>

        {detail.related_resources.length > 0 && (
          <section className="space-y-3">
            <div className="text-sm font-medium">
              {t(
                'admin.resourceManagementPage.resourceDetail.relatedResources',
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.related_resources.map((related) => (
                <div
                  key={`${related.resource_type}-${related.id}`}
                  className="min-w-0 rounded-lg border-0.5 border-border-button bg-bg-input p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t(`admin.resourceType.${related.resource_type}`)}
                    </Badge>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {related.name || '-'}
                    </span>
                  </div>
                  {related.detail && (
                    <div className="mt-2 truncate text-xs text-text-secondary">
                      {related.detail}
                    </div>
                  )}
                  <div className="mt-1 truncate font-mono text-xs text-text-secondary">
                    {related.id}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </TabsContent>

      <TabsContent value="configuration" className="mt-0 space-y-3">
        {configurations.length ? (
          configurations.map(([name, value]) => (
            <ConfigurationSection key={name} name={name} value={value} />
          ))
        ) : (
          <div className="py-20 text-center text-sm text-text-secondary">
            {t('common.noData')}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
