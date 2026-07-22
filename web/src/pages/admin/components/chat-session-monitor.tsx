import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  Brain,
  ChevronDown,
  Clock3,
  Hash,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Timer,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getManagedChatSession,
  listManagedChatSessions,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { DetailInformationCard } from './detail-information-card';

const sourceOptions: AdminService.ManagedChatSessionSource[] = [
  'web',
  'chatbot',
  'openai',
];

function sourceLabel(
  source: AdminService.ManagedChatSessionSource,
  t: (key: string) => string,
) {
  return t(`admin.resourceManagementPage.chatSessions.sources.${source}`);
}

function messageContent(content: unknown) {
  if (typeof content === 'string') return content || '-';
  if (content == null) return '-';
  return JSON.stringify(content, null, 2);
}

function splitMessageContent(
  content: unknown,
  reasoningContent?: unknown,
): { answer: string; thoughts: string[] } {
  const thoughts: string[] = [];
  if (typeof reasoningContent === 'string' && reasoningContent.trim()) {
    thoughts.push(reasoningContent.trim());
  }

  if (typeof content !== 'string') {
    return { answer: messageContent(content), thoughts };
  }

  const answer = content
    .replace(/<think>([\s\S]*?)(?:<\/think>|$)/gi, (_, thought: string) => {
      const normalizedThought = thought.trim();
      if (normalizedThought && !thoughts.includes(normalizedThought)) {
        thoughts.push(normalizedThought);
      }
      return '';
    })
    .replace(/<\/?think>/gi, '')
    .trim();

  return { answer: answer || '-', thoughts };
}

export function ChatSessionMonitor({ resourceId }: { resourceId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywords, setKeywords] = useState('');
  const deferredKeywords = useDeferredValue(keywords.trim());
  const [sources, setSources] = useState<
    AdminService.ManagedChatSessionSource[]
  >([]);
  const [selected, setSelected] = useState<AdminService.ManagedChatSession>();

  useEffect(() => setPage(1), [deferredKeywords, sources]);

  const { data, isFetching } = useQuery({
    queryKey: [
      'admin/chat-sessions',
      resourceId,
      page,
      pageSize,
      sources,
      deferredKeywords,
    ],
    queryFn: async () =>
      (
        await listManagedChatSessions(resourceId, {
          page,
          pageSize,
          sources,
          keywords: deferredKeywords,
        })
      ).data.data,
    enabled: Boolean(resourceId),
  });

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: [
      'admin/chat-session',
      resourceId,
      selected?.id,
      selected?.source,
    ],
    queryFn: async () =>
      (await getManagedChatSession(resourceId, selected!.id, selected!.source))
        .data.data,
    enabled: Boolean(selected),
  });

  const toggleSource = (source: AdminService.ManagedChatSessionSource) => {
    setSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-64 flex-1"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder={t(
            'admin.resourceManagementPage.chatSessions.searchPlaceholder',
          )}
        />
        {sourceOptions.map((source) => (
          <Button
            key={source}
            type="button"
            size="sm"
            variant={sources.includes(source) ? 'default' : 'outline'}
            onClick={() => toggleSource(source)}
          >
            {sourceLabel(source, t)}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t('admin.resourceManagementPage.chatSessions.session')}
            </TableHead>
            <TableHead>
              {t('admin.resourceManagementPage.chatSessions.source')}
            </TableHead>
            <TableHead>
              {t('admin.resourceManagementPage.chatSessions.actor')}
            </TableHead>
            <TableHead className="text-center">
              {t('admin.resourceManagementPage.chatSessions.rounds')}
            </TableHead>
            <TableHead className="text-center">Token</TableHead>
            <TableHead className="text-center">
              {t('admin.resourceManagementPage.chatSessions.duration')}
            </TableHead>
            <TableHead>{t('admin.lastUpdateTime')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.sessions.length ? (
            data.sessions.map((session) => (
              <TableRow
                key={`${session.source}-${session.id}`}
                className="cursor-pointer"
                onClick={() => setSelected(session)}
              >
                <TableCell className="max-w-56">
                  <div className="truncate font-medium">
                    {session.name || '-'}
                  </div>
                  <div className="truncate font-mono text-xs text-text-secondary">
                    {session.id}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {sourceLabel(session.source, t)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {session.actor_name || '-'}
                </TableCell>
                <TableCell className="text-center">
                  {session.round ?? 0}
                </TableCell>
                <TableCell className="text-center">
                  {session.tokens ?? '-'}
                </TableCell>
                <TableCell className="text-center">
                  {session.duration == null
                    ? '-'
                    : `${session.duration.toFixed(3)}s`}
                </TableCell>
                <TableCell>
                  {formatDate(session.update_date || session.create_date) ||
                    '-'}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-40 text-center text-text-secondary"
              >
                {isFetching ? t('common.loading') : t('common.noData')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <RAGFlowPagination
        total={data?.total ?? 0}
        current={page}
        pageSize={pageSize}
        onChange={(nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        }}
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(undefined)}
      >
        <DialogContent className="max-h-[88vh] w-[min(900px,92vw)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
          <DialogHeader className="m-0 shrink-0 border-b border-border-button py-5 pl-6 pr-16">
            <DialogTitle className="break-words leading-6">
              {selected?.name ||
                t('admin.resourceManagementPage.chatSessions.sessionDetail')}
            </DialogTitle>
            <DialogDescription className="font-mono">
              {selected?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            {detailLoading && !detail ? (
              <div className="py-20 text-center text-sm text-text-secondary">
                {t('common.loading')}
              </div>
            ) : detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailInformationCard
                    icon={MessageSquare}
                    label={t(
                      'admin.resourceManagementPage.chatSessions.source',
                    )}
                    value={sourceLabel(detail.source, t)}
                  />
                  <DetailInformationCard
                    icon={UserRound}
                    label={t('admin.resourceManagementPage.chatSessions.actor')}
                    value={
                      detail.actor_name ||
                      detail.external_user_id ||
                      detail.user_id ||
                      '-'
                    }
                  />
                  <DetailInformationCard
                    icon={Hash}
                    label={t(
                      'admin.resourceManagementPage.chatSessions.rounds',
                    )}
                    value={detail.round ?? 0}
                  />
                  <DetailInformationCard
                    icon={Timer}
                    label={t(
                      'admin.resourceManagementPage.chatSessions.duration',
                    )}
                    value={
                      detail.duration == null
                        ? '-'
                        : `${detail.duration.toFixed(3)}s`
                    }
                  />
                  <DetailInformationCard
                    icon={Clock3}
                    label={t('admin.lastUpdateTime')}
                    value={
                      formatDate(detail.update_date || detail.create_date) ||
                      '-'
                    }
                  />
                  <DetailInformationCard
                    icon={AlertCircle}
                    label={t('admin.resourceManagementPage.chatSessions.error')}
                    value={detail.errors || '-'}
                  />
                </div>
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="size-4 text-text-secondary" />
                    {t(
                      'admin.resourceManagementPage.chatSessions.messageTimeline',
                    )}
                  </div>
                  <div className="space-y-4 rounded-xl border-0.5 border-border-button bg-bg-card p-4">
                    {detail.messages.map((message, index) => {
                      const isUser = message.role === 'user';
                      const isAssistant = message.role === 'assistant';
                      const isSystem = message.role === 'system';
                      const RoleIcon = isUser
                        ? UserRound
                        : isAssistant
                          ? Bot
                          : isSystem
                            ? ShieldCheck
                            : Settings2;
                      const { answer, thoughts } = splitMessageContent(
                        message.content,
                        message.reasoning_content,
                      );
                      return (
                        <div
                          key={message.id || index}
                          className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isUser && (
                            <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border-button bg-bg-input">
                              <RoleIcon className="size-4 text-text-secondary" />
                            </div>
                          )}
                          <div
                            className={`min-w-0 max-w-[82%] rounded-2xl border-0.5 px-4 py-3 ${
                              isUser
                                ? 'border-accent-primary/30 bg-accent-primary/10'
                                : 'border-border-button bg-bg-input'
                            }`}
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                              <span className="text-xs font-medium text-text-secondary">
                                {t(
                                  `admin.resourceManagementPage.chatSessions.roles.${message.role}`,
                                  { defaultValue: message.role },
                                )}
                              </span>
                              {message.created_at && (
                                <span className="text-xs text-text-secondary">
                                  {formatDate(message.created_at * 1000)}
                                </span>
                              )}
                            </div>
                            {thoughts.length > 0 && (
                              <details className="group mb-3 overflow-hidden rounded-lg border-0.5 border-border-button bg-bg-card">
                                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary marker:content-none">
                                  <Brain className="size-4 shrink-0" />
                                  <span className="flex-1">
                                    {t(
                                      'admin.resourceManagementPage.chatSessions.thinkingProcess',
                                    )}
                                  </span>
                                  <ChevronDown className="size-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0" />
                                </summary>
                                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-border-button px-3 py-2 font-sans text-xs leading-5 text-text-secondary">
                                  {thoughts.join('\n\n')}
                                </pre>
                              </details>
                            )}
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-6">
                              {answer}
                            </pre>
                          </div>
                          {isUser && (
                            <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-primary/10">
                              <RoleIcon className="size-4 text-accent-primary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
                {detail.references.length > 0 && (
                  <section className="space-y-3">
                    <details className="rounded-lg border-0.5 border-border-button bg-bg-input">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                        {t(
                          'admin.resourceManagementPage.chatSessions.references',
                        )}{' '}
                        ({detail.references.length})
                      </summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-border-button p-4 text-xs">
                        {JSON.stringify(detail.references, null, 2)}
                      </pre>
                    </details>
                  </section>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
