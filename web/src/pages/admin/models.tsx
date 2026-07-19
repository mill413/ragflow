import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BrainCircuit,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  createManagedModel,
  deleteManagedModel,
  listManagedModels,
  listModelWorkspaces,
  updateManagedModel,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { Routes } from '@/routes';
import { getSortIcon, openMainAppAsAdmin } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';

const PROVIDERS = ['MinerU', 'OpenAI-API-Compatible', 'Xinference'];
const MODEL_TYPES = [
  'chat',
  'embedding',
  'asr',
  'vision',
  'rerank',
  'tts',
  'ocr',
];

const EMPTY_FORM: AdminService.ManagedModelInput = {
  provider_name: 'OpenAI-API-Compatible',
  instance_name: '',
  model_name: '',
  api_key: '',
  base_url: '',
  model_types: ['chat'],
  max_tokens: 8192,
  status: 'active',
  visibility: 'all',
  workspace_ids: [],
};

type SortState = {
  key: keyof AdminService.ManagedModel;
  direction: 'asc' | 'desc';
};

export default function AdminModels() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [visibilityFilters, setVisibilityFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({
    key: 'update_date',
    direction: 'desc',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService.ManagedModel>();
  const [deleting, setDeleting] = useState<AdminService.ManagedModel>();
  const [form, setForm] = useState<AdminService.ManagedModelInput>(EMPTY_FORM);

  const { data: models = [], isFetching } = useQuery({
    queryKey: ['admin/managed-models'],
    queryFn: async () => (await listManagedModels()).data.data,
  });
  const { data: workspaces = [] } = useQuery({
    queryKey: ['admin/model-workspaces'],
    queryFn: async () => (await listModelWorkspaces()).data.data,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? updateManagedModel(editing.id, form) : createManagedModel(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/managed-models'] });
      message.success(t('admin.modelManagementPage.saved'));
      setDialogOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteManagedModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/managed-models'] });
      message.success(t('admin.modelManagementPage.deleted'));
      setDeleting(undefined);
    },
  });

  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    const rows = keyword
      ? models.filter((model) =>
          [model.name, model.provider_name, model.instance_name, model.base_url]
            .join(' ')
            .toLocaleLowerCase()
            .includes(keyword),
        )
      : models;
    return [...rows]
      .filter(
        (model) =>
          matchesSelectedFilter(model.provider_name, providerFilters) &&
          matchesSelectedFilter(model.status, statusFilters) &&
          matchesSelectedFilter(model.visibility, visibilityFilters) &&
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
      });
  }, [
    models,
    providerFilters,
    query,
    sort,
    statusFilters,
    typeFilters,
    visibilityFilters,
  ]);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        label: `${t(
          workspace.type === 'team'
            ? 'admin.teamWorkspace'
            : 'admin.personalWorkspace',
        )}-${workspace.name}`,
        value: workspace.id,
      })),
    [t, workspaces],
  );

  const toggleSort = (key: keyof AdminService.ManagedModel) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortButton = (label: string, key: keyof AdminService.ManagedModel) => (
    <Button variant="ghost" onClick={() => toggleSort(key)}>
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );

  const openCreate = () => {
    setEditing(undefined);
    setForm({ ...EMPTY_FORM, model_types: [...EMPTY_FORM.model_types] });
    setDialogOpen(true);
  };
  const openEdit = (model: AdminService.ManagedModel) => {
    setEditing(model);
    setForm({
      provider_name: model.provider_name,
      instance_name: model.instance_name,
      model_name: model.name,
      api_key: model.api_key,
      base_url: model.base_url,
      model_types: [...model.model_types],
      max_tokens: model.max_tokens,
      status: model.status,
      visibility: model.visibility,
      workspace_ids: [...model.workspace_ids],
    });
    setDialogOpen(true);
  };
  const toggleModelType = (modelType: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      model_types: checked
        ? [...new Set([...current.model_types, modelType])]
        : current.model_types.filter((item) => item !== modelType),
    }));
  };
  const canSave =
    form.model_name.trim() &&
    form.instance_name.trim() &&
    form.model_types.length > 0 &&
    (form.visibility === 'all' || form.workspace_ids.length > 0);

  return (
    <TooltipProvider>
      <Card className="!shadow-none relative h-full flex flex-col border-0.5 border-border-button bg-transparent rounded-xl overflow-hidden">
        <Spotlight />
        <ScrollArea className="size-full">
          <CardHeader className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>{t('admin.modelManagementPage.title')}</CardTitle>
                <div className="mt-2 max-w-3xl text-sm text-text-secondary">
                  {t('admin.modelManagementPage.description')}
                </div>
              </div>
              <Button onClick={openCreate}>
                <Plus /> {t('admin.modelManagementPage.addModel')}
              </Button>
            </div>

            <div className="grid max-w-xs gap-3">
              <div className="rounded-lg border-0.5 border-border-button bg-bg-input p-4">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('admin.modelManagementPage.total')}</span>
                  <BrainCircuit className="size-4" />
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {models.length}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminTableMultiFilters
                filters={[
                  {
                    id: 'provider',
                    label: t('admin.modelManagementPage.provider'),
                    options: createFilterOptions(
                      models,
                      (model) => model.provider_name,
                    ),
                    value: providerFilters,
                    onChange: setProviderFilters,
                  },
                  {
                    id: 'model-type',
                    label: t('admin.modelManagementPage.modelTypes'),
                    options: MODEL_TYPES.map((modelType) => ({
                      value: modelType,
                      label: t(`admin.modelManagementPage.types.${modelType}`),
                    })),
                    value: typeFilters,
                    onChange: setTypeFilters,
                  },
                  {
                    id: 'status',
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
                  {
                    id: 'visibility',
                    label: t('admin.modelManagementPage.visibility'),
                    options: [
                      {
                        value: 'all',
                        label: t('admin.modelManagementPage.allWorkspaces'),
                      },
                      {
                        value: 'selected',
                        label: t(
                          'admin.modelManagementPage.selectedWorkspaces',
                        ),
                      },
                    ],
                    value: visibilityFilters,
                    onChange: setVisibilityFilters,
                  },
                ]}
                resetLabel={t('admin.reset')}
                onReset={() => {
                  setProviderFilters([]);
                  setTypeFilters([]);
                  setStatusFilters([]);
                  setVisibilityFilters([]);
                }}
              />
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="h-10 pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('admin.modelManagementPage.search')}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table
                rootClassName="max-w-full [contain:inline-size]"
                className="min-w-[1180px]"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {sortButton(
                        t('admin.modelManagementPage.modelName'),
                        'name',
                      )}
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
                      {sortButton(
                        t('admin.modelManagementPage.status'),
                        'status',
                      )}
                    </TableHead>
                    <TableHead>
                      {sortButton(
                        t('admin.modelManagementPage.visibility'),
                        'visibility',
                      )}
                    </TableHead>
                    <TableHead>
                      {sortButton(t('admin.lastUpdateTime'), 'update_date')}
                    </TableHead>
                    <TableHead className="text-center">
                      {t('admin.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isFetching ? 'opacity-60' : undefined}>
                  {filteredModels.length ? (
                    filteredModels.map((model) => (
                      <TableRow key={model.id}>
                        <TableCell>
                          <div className="font-medium">{model.name}</div>
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
                                {t(
                                  `admin.modelManagementPage.types.${modelType}`,
                                )}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              model.status === 'active'
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {t(
                              model.status === 'active'
                                ? 'admin.modelManagementPage.active'
                                : 'admin.modelManagementPage.inactive',
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {model.visibility === 'all' ? (
                            <Badge variant="secondary">
                              {t('admin.modelManagementPage.allWorkspaces')}
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary">
                                  {t(
                                    'admin.modelManagementPage.selectedWorkspaces',
                                  )}
                                  （{model.workspaces.length}）
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {model.workspaces
                                  .map(
                                    (workspace) =>
                                      `${t(
                                        workspace.type === 'team'
                                          ? 'admin.teamWorkspace'
                                          : 'admin.personalWorkspace',
                                      )}-${workspace.name}`,
                                  )
                                  .join('\n')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(model.update_date) || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={t(
                                    'admin.resourceManagementPage.openInRagflow',
                                    { name: model.name },
                                  )}
                                  onClick={() =>
                                    openMainAppAsAdmin(
                                      `${Routes.UserSetting}${Routes.Model}`,
                                    )
                                  }
                                >
                                  <ExternalLink className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t(
                                  'admin.resourceManagementPage.openInRagflow',
                                  { name: model.name },
                                )}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEdit(model)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('admin.modelManagementPage.editAction', {
                                  name: model.name,
                                })}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleting(model)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('admin.modelManagementPage.deleteAction', {
                                  name: model.name,
                                })}
                              </TooltipContent>
                            </Tooltip>
                          </div>
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
          </CardContent>
        </ScrollArea>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {t(
                  editing
                    ? 'admin.modelManagementPage.editModel'
                    : 'admin.modelManagementPage.addModel',
                )}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="grid gap-5 py-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('admin.modelManagementPage.provider')}</Label>
                  <Select
                    value={form.provider_name}
                    disabled={Boolean(editing)}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        provider_name: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.modelManagementPage.instance')}</Label>
                  <Input
                    value={form.instance_name}
                    disabled={Boolean(editing)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        instance_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('admin.modelManagementPage.modelName')}</Label>
                  <Input
                    value={form.model_name}
                    disabled={Boolean(editing)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        model_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('admin.modelManagementPage.endpoint')}</Label>
                  <Input
                    value={form.base_url}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        base_url: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('admin.modelManagementPage.apiKey')}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                    <Input
                      className="pl-9"
                      type="password"
                      value={form.api_key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          api_key: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="text-xs text-text-secondary">
                    {t('admin.modelManagementPage.instanceConfigTip')}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.modelManagementPage.maxTokens')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_tokens}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        max_tokens: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                {editing && (
                  <div className="space-y-2">
                    <Label>{t('admin.modelManagementPage.status')}</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value: 'active' | 'inactive') =>
                        setForm((current) => ({ ...current, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          {t('admin.modelManagementPage.active')}
                        </SelectItem>
                        <SelectItem value="inactive">
                          {t('admin.modelManagementPage.inactive')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-3 md:col-span-2">
                  <Label>{t('admin.modelManagementPage.modelTypes')}</Label>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {MODEL_TYPES.map((modelType) => (
                      <label
                        key={modelType}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={form.model_types.includes(modelType)}
                          onCheckedChange={(checked) =>
                            toggleModelType(modelType, checked === true)
                          }
                        />
                        {t(`admin.modelManagementPage.types.${modelType}`)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('admin.modelManagementPage.visibility')}</Label>
                  <Select
                    value={form.visibility}
                    onValueChange={(value: 'all' | 'selected') =>
                      setForm((current) => ({
                        ...current,
                        visibility: value,
                        workspace_ids:
                          value === 'all' ? [] : current.workspace_ids,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('admin.modelManagementPage.allWorkspaces')}
                      </SelectItem>
                      <SelectItem value="selected">
                        {t('admin.modelManagementPage.selectedWorkspaces')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-text-secondary">
                    {t('admin.modelManagementPage.defaultVisibilityTip')}
                  </div>
                </div>
                {form.visibility === 'selected' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      {t('admin.modelManagementPage.selectWorkspaces')}
                    </Label>
                    <MultiSelect
                      key={`${editing?.id ?? 'new'}-${dialogOpen}`}
                      options={workspaceOptions}
                      defaultValue={form.workspace_ids}
                      onValueChange={(workspaceIds) =>
                        setForm((current) => ({
                          ...current,
                          workspace_ids: workspaceIds,
                        }))
                      }
                      maxCount={6}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('admin.cancel')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      disabled={!canSave || saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                    >
                      {t('admin.modelManagementPage.save')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canSave && (
                  <TooltipContent>
                    {t('admin.modelManagementPage.required')}
                  </TooltipContent>
                )}
              </Tooltip>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) setDeleting(undefined);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('admin.modelManagementPage.deleteModel')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.modelManagementPage.deleteConfirmation', {
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
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}
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
