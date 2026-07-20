import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BrainCircuit,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import { DynamicForm, type DynamicFormRef } from '@/components/dynamic-form';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import message from '@/components/ui/message';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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
  verifyManagedModel,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { Routes } from '@/routes';
import { getSortIcon, openMainAppAsAdmin } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';
import { getProviderConfig } from '@/pages/user-setting/setting-model/provider-schema/field-config';
import { useProviderFields } from '@/pages/user-setting/setting-model/provider-schema/hooks';
import { useCustomModelFields } from '@/pages/user-setting/setting-model/instance-card/use-custom-model-fields';

const PROVIDERS = ['MinerU', 'OpenAI-API-Compatible', 'Xinference'];
const EMPTY_FORM: AdminService.ManagedModelInput = {
  provider_name: 'OpenAI-API-Compatible',
  instance_name: '',
  model_name: '',
  api_key: '',
  base_url: '',
  model_types: ['chat'],
  features: [],
  max_tokens: 0,
  status: 'active',
  visibility: 'all',
  workspace_ids: [],
  provider_config: {
    mineru_output_dir: '',
    mineru_backend: 'pipeline',
    mineru_server_url: '',
    mineru_delete_output: true,
  },
};

type AdminProviderConfigurationProps = {
  providerName: string;
  initialValues: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
};

const AdminProviderConfiguration = forwardRef<
  DynamicFormRef,
  AdminProviderConfigurationProps
>(({ providerName, initialValues, onSubmit }, ref) => {
  const { fields } = useProviderFields({
    llmFactory: providerName,
    editMode: true,
    initialValues,
    hideWhenInstanceExists: () => true,
  });
  const providerFields = useMemo(
    () => fields.filter((field) => field.name !== 'instance_name'),
    [fields],
  );

  return (
    <DynamicForm.Root
      key={providerName}
      ref={ref}
      fields={providerFields}
      defaultValues={initialValues}
      onSubmit={onSubmit}
      className="md:col-span-2"
      labelClassName="font-normal"
    />
  );
});

AdminProviderConfiguration.displayName = 'AdminProviderConfiguration';

type SortState = {
  key: keyof AdminService.ManagedModel;
  direction: 'asc' | 'desc';
};

export default function AdminModels() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const customModelFields = useCustomModelFields();
  const modelNameField = customModelFields.find(
    (field) => field.name === 'name',
  );
  const modelTypesField = customModelFields.find(
    (field) => field.name === 'model_types',
  );
  const maxTokensField = customModelFields.find(
    (field) => field.name === 'max_tokens',
  );
  const featuresField = customModelFields.find(
    (field) => field.name === 'features',
  );
  const [query, setQuery] = useState('');
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [visibilityFilters, setVisibilityFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({
    key: 'update_date',
    direction: 'desc',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService.ManagedModel>();
  const [deleting, setDeleting] = useState<AdminService.ManagedModel>();
  const [form, setForm] = useState<AdminService.ManagedModelInput>(EMPTY_FORM);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    message: string;
  }>();
  const providerFormRef = useRef<DynamicFormRef>(null);
  const providerFormActionRef = useRef<'save' | 'verify'>('save');

  useEffect(() => {
    setVerificationResult(undefined);
  }, [form]);

  const providerInitialValues = useMemo<Record<string, unknown>>(() => {
    if (form.provider_name === 'MinerU') {
      return {
        mineru_apiserver: form.base_url,
        mineru_api_key: form.api_key,
        mineru_output_dir: form.provider_config?.mineru_output_dir ?? '',
        mineru_backend: form.provider_config?.mineru_backend ?? 'pipeline',
        mineru_server_url: form.provider_config?.mineru_server_url ?? '',
        mineru_delete_output:
          form.provider_config?.mineru_delete_output ?? true,
      };
    }
    return {
      base_url: form.base_url,
      api_key: form.api_key,
      vision: form.provider_config?.vision ?? false,
    };
  }, [form.api_key, form.base_url, form.provider_config, form.provider_name]);

  const { data: models = [], isFetching } = useQuery({
    queryKey: ['admin/managed-models'],
    queryFn: async () => (await listManagedModels()).data.data,
  });
  const { data: workspaces = [] } = useQuery({
    queryKey: ['admin/model-workspaces'],
    queryFn: async () => (await listModelWorkspaces()).data.data,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: AdminService.ManagedModelInput) =>
      editing
        ? updateManagedModel(editing.id, payload)
        : createManagedModel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/managed-models'] });
      message.success(t('admin.modelManagementPage.saved'));
      setDialogOpen(false);
    },
  });
  const verifyMutation = useMutation({
    mutationFn: verifyManagedModel,
    onMutate: () => setVerificationResult(undefined),
    onSuccess: (response) => {
      const result = response.data.data;
      if (result.valid) {
        setVerificationResult({
          valid: true,
          message: t('admin.modelManagementPage.verifySucceeded'),
        });
      } else if (result.message.includes('timed out after')) {
        setVerificationResult({
          valid: false,
          message: t('admin.modelManagementPage.verifyTimeout'),
        });
      } else {
        setVerificationResult({
          valid: false,
          message: result.message || t('admin.modelManagementPage.verifyFailed'),
        });
      }
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
          [
            model.name,
            model.provider_name,
            model.instance_name,
            model.base_url,
            model.owner_workspace.name,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(keyword),
        )
      : models;
    return [...rows]
      .filter(
        (model) =>
          matchesSelectedFilter(model.provider_name, providerFilters) &&
          matchesSelectedFilter(model.source, sourceFilters) &&
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
    sourceFilters,
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
    setVerificationResult(undefined);
    setForm({ ...EMPTY_FORM, model_types: [...EMPTY_FORM.model_types] });
    setDialogOpen(true);
  };
  const openEdit = (model: AdminService.ManagedModel) => {
    setEditing(model);
    setVerificationResult(undefined);
    setForm({
      provider_name: model.provider_name,
      instance_name: model.instance_name,
      model_name: model.name,
      api_key: model.api_key,
      base_url: model.base_url,
      model_types: model.model_types.map((modelType) =>
        modelType === 'asr'
          ? 'speech2text'
          : modelType === 'vision'
            ? 'image2text'
            : modelType,
      ),
      features: [...(model.features ?? [])],
      max_tokens: model.max_tokens,
      status: model.status,
      visibility: model.visibility === 'private' ? 'all' : model.visibility,
      workspace_ids: [...model.workspace_ids],
      provider_config: { ...model.provider_config },
    });
    setDialogOpen(true);
  };
  const canSave =
    form.model_name.trim() &&
    form.instance_name.trim() &&
    (form.visibility === 'all' || form.workspace_ids.length > 0);
  const canVerify =
    Boolean(form.model_name.trim() && form.instance_name.trim()) &&
    (form.provider_name === 'MinerU' || form.model_types.length > 0);

  const submitProviderConfiguration = (values: Record<string, unknown>) => {
    const config = getProviderConfig(form.provider_name);
    const transformed = config.verifyTransform?.(values) ?? {
      apiKey: values.api_key ?? '',
      baseUrl: values.base_url ?? '',
    };
    const apiKey = transformed.apiKey;
    const mineruConfig =
      form.provider_name === 'MinerU' && apiKey && typeof apiKey === 'object'
        ? (apiKey as Record<string, unknown>)
        : undefined;
    const payload: AdminService.ManagedModelInput = {
      ...form,
      base_url: String(transformed.baseUrl ?? ''),
      api_key: String(mineruConfig?.mineru_api_key ?? transformed.apiKey ?? ''),
      provider_config: {
        ...form.provider_config,
        vision: Boolean(values.vision),
        ...(mineruConfig
          ? {
              mineru_output_dir: String(mineruConfig.mineru_output_dir ?? ''),
              mineru_backend: String(mineruConfig.mineru_backend ?? 'pipeline'),
              mineru_server_url: String(mineruConfig.mineru_server_url ?? ''),
              mineru_delete_output:
                String(mineruConfig.mineru_delete_output ?? '1') !== '0',
            }
          : {}),
      },
    };
    if (providerFormActionRef.current === 'verify') {
      providerFormActionRef.current = 'save';
      verifyMutation.mutate(payload);
      return;
    }
    saveMutation.mutate(payload);
  };

  const sharedModelCount = models.filter(
    (model) => model.source === 'shared',
  ).length;
  const privateModelCount = models.length - sharedModelCount;

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

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border-0.5 border-border-button bg-bg-input p-4">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('admin.modelManagementPage.total')}</span>
                  <BrainCircuit className="size-4" />
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {models.length}
                </div>
              </div>
              <div className="rounded-lg border-0.5 border-border-button bg-bg-input p-4">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('admin.modelManagementPage.sharedTotal')}</span>
                  <BrainCircuit className="size-4" />
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {sharedModelCount}
                </div>
              </div>
              <div className="rounded-lg border-0.5 border-border-button bg-bg-input p-4">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('admin.modelManagementPage.privateTotal')}</span>
                  <KeyRound className="size-4" />
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {privateModelCount}
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
                    id: 'source',
                    label: t('admin.modelManagementPage.source'),
                    options: [
                      {
                        value: 'shared',
                        label: t('admin.modelManagementPage.sharedSource'),
                      },
                      {
                        value: 'private',
                        label: t('admin.modelManagementPage.privateSource'),
                      },
                    ],
                    value: sourceFilters,
                    onChange: setSourceFilters,
                  },
                  {
                    id: 'model-type',
                    label: t('admin.modelManagementPage.modelTypes'),
                    options: createFilterOptions(
                      models.flatMap((model) => model.model_types),
                      (modelType) => modelType,
                      (modelType) =>
                        t(`admin.modelManagementPage.types.${modelType}`),
                    ),
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
                      {
                        value: 'private',
                        label: t('admin.modelManagementPage.privateVisibility'),
                      },
                    ],
                    value: visibilityFilters,
                    onChange: setVisibilityFilters,
                  },
                ]}
                resetLabel={t('admin.reset')}
                onReset={() => {
                  setProviderFilters([]);
                  setSourceFilters([]);
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
                        t('admin.modelManagementPage.source'),
                        'source',
                      )}
                    </TableHead>
                    <TableHead>
                      {sortButton(
                        t('admin.modelManagementPage.ownerWorkspace'),
                        'owner_workspace_name',
                      )}
                    </TableHead>
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
                          <Badge variant="secondary">
                            {t(
                              model.source === 'shared'
                                ? 'admin.modelManagementPage.sharedSource'
                                : 'admin.modelManagementPage.privateSource',
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {model.source === 'shared'
                            ? t('admin.modelManagementPage.systemShared')
                            : `${t(
                                model.owner_workspace.type === 'team'
                                  ? 'admin.teamWorkspace'
                                  : 'admin.personalWorkspace',
                              )}-${model.owner_workspace.name}`}
                        </TableCell>
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
                          {model.visibility === 'private' ? (
                            <Badge variant="secondary">
                              {t('admin.modelManagementPage.privateVisibility')}
                            </Badge>
                          ) : model.visibility === 'all' ? (
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
                            {model.source === 'shared' ? (
                              <>
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
                                    {t(
                                      'admin.modelManagementPage.deleteAction',
                                      { name: model.name },
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <span className="text-xs text-text-secondary">
                                {t('admin.modelManagementPage.monitorOnly')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={10}
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
                        model_name:
                          value === 'MinerU' ? current.instance_name : '',
                        api_key: '',
                        base_url: '',
                        model_types: value === 'MinerU' ? ['ocr'] : ['chat'],
                        features: [],
                        max_tokens: 0,
                        provider_config: {
                          mineru_output_dir: '',
                          mineru_backend: 'pipeline',
                          mineru_server_url: '',
                          mineru_delete_output: true,
                        },
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
                        model_name:
                          current.provider_name === 'MinerU'
                            ? event.target.value
                            : current.model_name,
                      }))
                    }
                  />
                </div>
                {form.provider_name !== 'MinerU' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      {modelNameField?.label ??
                        t('admin.modelManagementPage.modelName')}
                    </Label>
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
                )}
                <AdminProviderConfiguration
                  key={`${editing?.id ?? 'new'}-${form.provider_name}`}
                  ref={providerFormRef}
                  providerName={form.provider_name}
                  initialValues={providerInitialValues}
                  onSubmit={submitProviderConfiguration}
                />
                {form.provider_name !== 'MinerU' && (
                  <div className="space-y-2">
                    <Label>
                      {maxTokensField?.label ??
                        t('admin.modelManagementPage.maxTokens')}
                    </Label>
                    <Input
                      type="number"
                      min={maxTokensField?.min ?? 0}
                      value={form.max_tokens}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          max_tokens: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                )}
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
                {form.provider_name !== 'MinerU' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      {modelTypesField?.label ??
                        t('admin.modelManagementPage.modelTypes')}
                    </Label>
                    <MultiSelect
                      key={`${editing?.id ?? 'new'}-${form.provider_name}-model-types`}
                      options={modelTypesField?.options ?? []}
                      defaultValue={form.model_types}
                      onValueChange={(modelTypes) =>
                        setForm((current) => ({
                          ...current,
                          model_types: modelTypes,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                )}
                {form.provider_name !== 'MinerU' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>{featuresField?.label}</Label>
                    <div className="space-y-2 rounded-md border border-border-button p-3">
                      {featuresField?.options?.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center justify-between gap-3"
                        >
                          <Label className="font-normal">{option.label}</Label>
                          <Switch
                            checked={form.features?.includes(option.value)}
                            onCheckedChange={(checked) =>
                              setForm((current) => ({
                                ...current,
                                features: checked
                                  ? [
                                      ...(current.features ?? []).filter(
                                        (feature) => feature !== option.value,
                                      ),
                                      option.value,
                                    ]
                                  : (current.features ?? []).filter(
                                      (feature) => feature !== option.value,
                                    ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            {verificationResult && (
              <div
                className={`rounded-md border px-3 py-2 text-sm whitespace-pre-line ${
                  verificationResult.valid
                    ? 'border-state-success/30 bg-state-success/10 text-state-success'
                    : 'border-state-error/30 bg-state-error/10 text-state-error'
                }`}
              >
                {verificationResult.message}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('admin.cancel')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      disabled={
                        !canVerify ||
                        verifyMutation.isPending ||
                        saveMutation.isPending
                      }
                      onClick={() => {
                        providerFormActionRef.current = 'verify';
                        providerFormRef.current?.submit();
                      }}
                    >
                      {verifyMutation.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ShieldCheck />
                      )}
                      {t('admin.modelManagementPage.verify')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canVerify && (
                  <TooltipContent>
                    {t('admin.modelManagementPage.verifyRequired')}
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      disabled={
                        !canSave ||
                        saveMutation.isPending ||
                        verifyMutation.isPending
                      }
                      onClick={() => {
                        providerFormActionRef.current = 'save';
                        providerFormRef.current?.submit();
                      }}
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
