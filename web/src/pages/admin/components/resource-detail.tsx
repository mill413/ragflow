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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/utils/date';
import { DetailInformationCard } from './detail-information-card';
import { StorageSize } from './storage-size';
import { ChatSessionMonitor } from './chat-session-monitor';

type DetailItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};

type StandardResourceDetailProps = {
  detail?: AdminService.StandardManagedResourceDetailResponse;
  loading: boolean;
};

type ConfigurationRecord = Record<string, unknown>;

function asRecord(value: unknown): ConfigurationRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ConfigurationRecord)
    : {};
}

function configurationLabel(
  key: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return t(`admin.resourceManagementPage.resourceDetail.fields.${key}`, {
    defaultValue: key.replaceAll('_', ' '),
  });
}

function ConfigurationGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border-0.5 border-border-button bg-bg-input">
      <div className="border-b border-border-button px-4 py-3 text-sm font-medium">
        {title}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function ReadonlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      className={
        multiline
          ? 'space-y-2'
          : 'grid min-h-9 grid-cols-[minmax(150px,0.8fr)_minmax(0,1.7fr)] items-center gap-4'
      }
    >
      <div className="text-sm text-text-secondary">{label}</div>
      <div
        className={
          multiline
            ? 'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border-0.5 border-border-button bg-bg-card p-3 text-sm leading-6 text-text-primary'
            : 'min-w-0 break-words text-right text-sm font-medium text-text-primary'
        }
      >
        {value === '' || value === null || value === undefined ? '-' : value}
      </div>
    </div>
  );
}

function ReadonlySwitch({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Switch checked={checked} disabled />
        <span>
          {t(
            checked
              ? 'admin.resourceManagementPage.resourceDetail.enabled'
              : 'admin.resourceManagementPage.resourceDetail.disabled',
          )}
        </span>
      </div>
    </div>
  );
}

function ReadonlySlider({
  label,
  value,
  max = 1,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="grid min-h-9 grid-cols-[minmax(150px,0.8fr)_minmax(0,1.7fr)] items-center gap-4">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border-button">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-12 text-right text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

function StructuredValue({ name, value }: { name: string; value: unknown }) {
  const { t } = useTranslation();
  const label = configurationLabel(name, t);

  if (typeof value === 'boolean') {
    return <ReadonlySwitch label={label} checked={value} />;
  }
  if (Array.isArray(value)) {
    if (!value.length) return <ReadonlyField label={label} value="-" />;
    const primitives = value.every(
      (item) => item === null || typeof item !== 'object',
    );
    return (
      <div className="space-y-2">
        <div className="text-sm text-text-secondary">{label}</div>
        {primitives ? (
          <div className="flex flex-wrap gap-2">
            {value.map((item, index) => (
              <Badge key={`${String(item)}-${index}`} variant="secondary">
                {String(item)}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="space-y-2 border-l-2 border-border-button pl-3">
            {value.map((item, index) => (
              <StructuredValue
                key={index}
                name={`${label} ${index + 1}`}
                value={item}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <details className="rounded-md border-0.5 border-border-button bg-bg-card">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          {label}
        </summary>
        <div className="space-y-2 border-t border-border-button p-3">
          {Object.entries(value as ConfigurationRecord).map(
            ([childName, childValue]) => (
              <StructuredValue
                key={childName}
                name={childName}
                value={childValue}
              />
            ),
          )}
        </div>
      </details>
    );
  }
  return (
    <ReadonlyField
      label={label}
      value={String(value ?? '-')}
      multiline={
        typeof value === 'string' &&
        (value.includes('\n') || value.length > 120)
      }
    />
  );
}

function ChatConfiguration({
  configuration,
}: {
  configuration: ConfigurationRecord;
}) {
  const { t } = useTranslation();
  const settings = asRecord(configuration.model_settings);
  const prompt = asRecord(configuration.prompt);
  const retrieval = asRecord(configuration.retrieval);
  const metadata = asRecord(configuration.metadata_filter);

  return (
    <div className="space-y-4">
      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.model_settings',
        )}
      >
        <ReadonlySlider
          label={t('chat.temperature')}
          value={Number(settings.temperature ?? 0)}
        />
        <ReadonlySlider
          label={t('chat.topP')}
          value={Number(settings.top_p ?? 0)}
        />
        <ReadonlySlider
          label={t('chat.presencePenalty')}
          value={Number(settings.presence_penalty ?? 0)}
        />
        <ReadonlySlider
          label={t('chat.frequencyPenalty')}
          value={Number(settings.frequency_penalty ?? 0)}
        />
        <ReadonlyField
          label={configurationLabel('max_tokens', t)}
          value={String(settings.max_tokens ?? '-')}
        />
      </ConfigurationGroup>

      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.retrieval',
        )}
      >
        <ReadonlySlider
          label={configurationLabel('similarity_threshold', t)}
          value={Number(retrieval.similarity_threshold ?? 0.2)}
        />
        <ReadonlySlider
          label={configurationLabel('vector_similarity_weight', t)}
          value={Number(retrieval.vector_similarity_weight ?? 0.3)}
        />
        <ReadonlyField
          label={configurationLabel('top_n', t)}
          value={String(retrieval.top_n ?? '-')}
        />
        <ReadonlyField label="Top K" value={String(retrieval.top_k ?? '-')} />
        <ReadonlyField
          label={configurationLabel('rerank_id', t)}
          value={String(retrieval.rerank_id ?? '-')}
        />
        <ReadonlySwitch
          label={configurationLabel('do_refer', t)}
          checked={Boolean(retrieval.do_refer)}
        />
      </ConfigurationGroup>

      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.prompt',
        )}
      >
        <ReadonlyField
          label={t('chat.setAnOpener')}
          value={String(prompt.prologue ?? '')}
          multiline
        />
        <ReadonlyField
          label={configurationLabel('system_prompt', t)}
          value={String(prompt.system ?? '')}
          multiline
        />
        <ReadonlyField
          label={t('chat.emptyResponse')}
          value={String(prompt.empty_response ?? '')}
          multiline
        />
        {['quote', 'keyword', 'tts', 'toc_enhance'].map((field) => (
          <ReadonlySwitch
            key={field}
            label={configurationLabel(field, t)}
            checked={Boolean(prompt[field])}
          />
        ))}
        <StructuredValue name="parameters" value={prompt.parameters ?? []} />
      </ConfigurationGroup>

      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.metadata_filter',
        )}
      >
        {Object.keys(metadata).length ? (
          Object.entries(metadata).map(([name, value]) => (
            <StructuredValue key={name} name={name} value={value} />
          ))
        ) : (
          <ReadonlyField
            label={configurationLabel('metadata_filter', t)}
            value={t(
              'admin.resourceManagementPage.resourceDetail.notConfigured',
            )}
          />
        )}
      </ConfigurationGroup>
    </div>
  );
}

function SearchConfiguration({
  configuration,
}: {
  configuration: ConfigurationRecord;
}) {
  const { t } = useTranslation();
  const search = asRecord(configuration.search);
  const llmSettings = asRecord(search.llm_setting);
  const metadata = asRecord(search.meta_data_filter);
  const referenceMetadata = asRecord(search.reference_metadata);

  return (
    <div className="space-y-4">
      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.retrieval',
        )}
      >
        <ReadonlySlider
          label={configurationLabel('similarity_threshold', t)}
          value={Number(search.similarity_threshold ?? 0.2)}
        />
        <ReadonlySlider
          label={configurationLabel('vector_similarity_weight', t)}
          value={Number(search.vector_similarity_weight ?? 0.3)}
        />
        <ReadonlySwitch
          label={configurationLabel('use_rerank', t)}
          checked={Boolean(search.use_rerank || search.rerank_id)}
        />
        <ReadonlyField
          label={configurationLabel('rerank_id', t)}
          value={String(search.rerank_id ?? '-')}
        />
        <ReadonlyField label="Top K" value={String(search.top_k ?? 1024)} />
      </ConfigurationGroup>

      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.search_features',
        )}
      >
        {[
          'highlight',
          'keyword',
          'summary',
          'related_search',
          'query_mindmap',
          'web_search',
        ].map((field) => (
          <ReadonlySwitch
            key={field}
            label={configurationLabel(field, t)}
            checked={Boolean(search[field])}
          />
        ))}
        {Boolean(search.summary) && (
          <>
            <ReadonlyField
              label={configurationLabel('summary_model', t)}
              value={String(search.chat_id ?? llmSettings.llm_id ?? '-')}
            />
            {Object.entries(llmSettings).map(([name, value]) => (
              <StructuredValue key={name} name={name} value={value} />
            ))}
          </>
        )}
      </ConfigurationGroup>

      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.metadata',
        )}
      >
        <ReadonlySwitch
          label={configurationLabel('show_chunk_metadata', t)}
          checked={Boolean(referenceMetadata.include)}
        />
        <StructuredValue
          name="metadata_fields"
          value={referenceMetadata.fields ?? []}
        />
        {Object.entries(metadata).map(([name, value]) => (
          <StructuredValue key={name} name={name} value={value} />
        ))}
        {!Object.keys(metadata).length && (
          <ReadonlyField
            label={configurationLabel('metadata_filter', t)}
            value={t(
              'admin.resourceManagementPage.resourceDetail.notConfigured',
            )}
          />
        )}
      </ConfigurationGroup>
    </div>
  );
}

function AgentConfiguration({
  configuration,
}: {
  configuration: ConfigurationRecord;
}) {
  const { t } = useTranslation();
  const canvas = asRecord(configuration.canvas);
  const components = asRecord(canvas.components);
  const history = Array.isArray(canvas.history) ? canvas.history : [];

  return (
    <div className="space-y-4">
      <ConfigurationGroup
        title={t(
          'admin.resourceManagementPage.resourceDetail.configurationSections.canvas',
        )}
      >
        <ReadonlyField
          label={configurationLabel('node_count', t)}
          value={String(Object.keys(components).length)}
        />
        {Object.entries(components).map(([nodeId, nodeValue]) => {
          const node = asRecord(nodeValue);
          const object = asRecord(node.obj);
          const params = asRecord(object.params);
          return (
            <details
              key={nodeId}
              className="rounded-md border-0.5 border-border-button bg-bg-card"
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {String(object.component_name ?? nodeId)}
                <span className="ml-2 font-mono text-xs text-text-secondary">
                  {nodeId}
                </span>
              </summary>
              <div className="space-y-3 border-t border-border-button p-3">
                <StructuredValue name="upstream" value={node.upstream ?? []} />
                <StructuredValue
                  name="downstream"
                  value={node.downstream ?? []}
                />
                {Object.entries(params).map(([name, value]) => (
                  <StructuredValue key={name} name={name} value={value} />
                ))}
              </div>
            </details>
          );
        })}
        {!Object.keys(components).length && (
          <ReadonlyField
            label={configurationLabel('nodes', t)}
            value={t('common.noData')}
          />
        )}
      </ConfigurationGroup>

      {history.length > 0 && (
        <ConfigurationGroup
          title={t(
            'admin.resourceManagementPage.resourceDetail.configurationSections.history',
          )}
        >
          {history.map((entry, index) => (
            <StructuredValue
              key={index}
              name={`${configurationLabel('history', t)} ${index + 1}`}
              value={entry}
            />
          ))}
        </ConfigurationGroup>
      )}
    </div>
  );
}

function MemoryConfiguration({
  configuration,
}: {
  configuration: ConfigurationRecord;
}) {
  const { t } = useTranslation();
  const extraction = asRecord(configuration.extraction);
  return (
    <ConfigurationGroup
      title={t(
        'admin.resourceManagementPage.resourceDetail.configurationSections.extraction',
      )}
    >
      <ReadonlySlider
        label={t('memory.config.temperature')}
        value={Number(extraction.temperature ?? 0.5)}
      />
      <ReadonlyField
        label={t('memory.config.systemPrompt')}
        value={String(extraction.system_prompt ?? '')}
        multiline
      />
      <ReadonlyField
        label={t('memory.config.userPrompt')}
        value={String(extraction.user_prompt ?? '')}
        multiline
      />
    </ConfigurationGroup>
  );
}

function FileConfiguration({
  configuration,
}: {
  configuration: ConfigurationRecord;
}) {
  const { t } = useTranslation();
  const storage = asRecord(configuration.storage);
  return (
    <ConfigurationGroup
      title={t(
        'admin.resourceManagementPage.resourceDetail.configurationSections.storage',
      )}
    >
      <ReadonlyField
        label={configurationLabel('location', t)}
        value={String(storage.location ?? '-')}
      />
      <ReadonlyField
        label={configurationLabel('parent_id', t)}
        value={String(storage.parent_id ?? '-')}
      />
    </ConfigurationGroup>
  );
}

function ResourceConfiguration({
  resourceType,
  configuration,
}: {
  resourceType: AdminService.ManagedResourceType;
  configuration: ConfigurationRecord;
}) {
  switch (resourceType) {
    case 'chat':
      return <ChatConfiguration configuration={configuration} />;
    case 'search':
      return <SearchConfiguration configuration={configuration} />;
    case 'agent':
      return <AgentConfiguration configuration={configuration} />;
    case 'memory':
      return <MemoryConfiguration configuration={configuration} />;
    case 'file':
      return <FileConfiguration configuration={configuration} />;
    default:
      return null;
  }
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
    case 'memory': {
      const memoryType = Number(resource.memory_type ?? 0);
      const memoryTypes = [
        [1, t('memories.raw')],
        [2, t('memories.semantic')],
        [4, t('memories.episodic')],
        [8, t('memories.procedural')],
      ]
        .filter(([flag]) => (memoryType & Number(flag)) !== 0)
        .map(([, label]) => label);
      items.push(
        {
          label: t('admin.resourceManagementPage.memoryType'),
          value: memoryTypes.length ? memoryTypes.join('、') : '-',
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
    }
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

  return (
    <Tabs defaultValue="overview" className="py-5">
      <TabsList className="mb-5 h-auto justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="overview">
          {t('admin.resourceManagementPage.datasetDetail.overview')}
        </TabsTrigger>
        <TabsTrigger value="configuration">
          {t('admin.resourceManagementPage.resourceDetail.configuration')}
        </TabsTrigger>
        {detail.resource.resource_type === 'chat' && (
          <TabsTrigger value="sessions">
            {t('admin.resourceManagementPage.chatSessions.title')}
          </TabsTrigger>
        )}
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
        <ResourceConfiguration
          resourceType={detail.resource.resource_type}
          configuration={detail.configuration ?? {}}
        />
      </TabsContent>
      {detail.resource.resource_type === 'chat' && (
        <TabsContent value="sessions" className="mt-0">
          <ChatSessionMonitor resourceId={detail.resource.id} />
        </TabsContent>
      )}
    </Tabs>
  );
}
