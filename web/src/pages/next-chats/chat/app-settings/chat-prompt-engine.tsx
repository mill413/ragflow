'use client';

import { Collapse } from '@/components/collapse';
import { CrossLanguageFormField } from '@/components/cross-language-form-field';
import { MetadataFilter } from '@/components/metadata-filter';
import { PrefetchSizeFormField } from '@/components/prefetch-size-item';
import { RerankFormFields } from '@/components/rerank';
import { SimilaritySliderFormField } from '@/components/similarity-slider';
import { SwitchFormField } from '@/components/switch-fom-field';
import { TOCEnhanceFormField } from '@/components/toc-enhance-form-field';
import { TopNFormField } from '@/components/top-n-item';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UseKnowledgeGraphFormField } from '@/components/use-knowledge-graph-item';
import { WebSearchFormField } from '@/components/web-search-form-field';
import { useFetchKnowledgeMetadataKeys } from '@/hooks/use-knowledge-request';
import { prefixName } from '@/utils/form';
import { getDirAttribute } from '@/utils/text-direction';
import { RotateCcw, Sparkles } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { DynamicVariableForm } from './dynamic-variable';
import { PromptOptimizerDialog } from './prompt-optimizer-dialog';

interface ChatPromptEngineProps {
  prefix?: string;
  readOnly?: boolean;
}

function ActionTooltip({
  content,
  children,
}: {
  content?: string;
  children: ReactNode;
}) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-not-allowed [&>button]:pointer-events-none"
          tabIndex={0}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

export function ChatPromptEngine({
  prefix = '',
  readOnly = false,
}: ChatPromptEngineProps) {
  const { t } = useTranslation();
  const { id: chatId = '' } = useParams();
  const form = useFormContext();
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [promptSnapshot, setPromptSnapshot] = useState('');
  const systemPromptValue = form.watch(
    prefixName(prefix, 'prompt_config.system'),
  );
  const llmId = form.watch(prefixName(prefix, 'llm_id'));

  const optimizeDisabledReason = readOnly
    ? t('common.readOnlySaveTip')
    : !String(systemPromptValue || '').trim()
      ? t('chat.optimizePromptEmptyTip')
      : !llmId
        ? t('chat.optimizePromptModelTip')
        : !chatId
          ? t('chat.optimizePromptUnsavedTip')
          : undefined;

  const emptyResponseValue = form.watch(
    prefixName(prefix, 'prompt_config.empty_response'),
  );
  const rawDatasetIds = useWatch({
    control: form.control,
    name: prefixName(prefix, 'dataset_ids'),
  });
  const kbIds = useMemo(
    () => (rawDatasetIds || []) as string[],
    [rawDatasetIds],
  );
  const metadataInclude = useWatch({
    control: form.control,
    name: prefixName(prefix, 'prompt_config.reference_metadata.include'),
  });
  const { data: metadataKeys, loading: metadataKeysLoading } =
    useFetchKnowledgeMetadataKeys(kbIds);
  const metadataFieldOptions = useMemo(() => {
    return (metadataKeys || []).map((key) => ({
      label: key,
      value: key,
    }));
  }, [metadataKeys]);

  useEffect(() => {
    const currentFields = form.getValues(
      prefixName(prefix, 'prompt_config.reference_metadata.fields'),
    );
    if (
      metadataInclude &&
      Array.isArray(currentFields) &&
      currentFields.length > 0 &&
      metadataKeys
    ) {
      const validFields = currentFields.filter((field) =>
        metadataKeys.includes(field),
      );
      if (validFields.length !== currentFields.length) {
        form.setValue(
          prefixName(prefix, 'prompt_config.reference_metadata.fields'),
          validFields,
        );
      }
    } else if (!metadataInclude) {
      form.setValue(
        prefixName(prefix, 'prompt_config.reference_metadata.fields'),
        undefined,
      );
    }
  }, [kbIds, metadataKeys, metadataKeysLoading, metadataInclude, form, prefix]);

  return (
    <Collapse title={t('flow.advancedSettings')}>
      <div className="space-y-8">
        <FormField
          control={form.control}
          name={prefixName(prefix, 'prompt_config.empty_response')}
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('chat.emptyResponseTip')}>
                {t('chat.emptyResponse')}
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={t('chat.emptyResponsePlaceholder')}
                  dir={getDirAttribute(emptyResponseValue || '')}
                ></Textarea>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SwitchFormField
          name={prefixName(prefix, 'prompt_config.quote')}
          label={t('chat.quote')}
          tooltip={t('chat.quoteTip')}
        ></SwitchFormField>
        <SwitchFormField
          name={prefixName(prefix, 'prompt_config.keyword')}
          label={t('chat.keyword')}
          tooltip={t('chat.keywordTip')}
        ></SwitchFormField>
        <SwitchFormField
          name={prefixName(prefix, 'prompt_config.tts')}
          label={t('chat.tts')}
          tooltip={t('chat.ttsTip')}
        ></SwitchFormField>
        <TOCEnhanceFormField
          name={prefixName(prefix, 'prompt_config.toc_enhance')}
        ></TOCEnhanceFormField>
        <WebSearchFormField prefix={prefix} />
        <MetadataFilter></MetadataFilter>
        <FormField
          control={form.control}
          name={prefixName(prefix, 'prompt_config.reference_metadata.include')}
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(value) => {
                    field.onChange(value);
                    if (!value) {
                      form.setValue(
                        prefixName(
                          prefix,
                          'prompt_config.reference_metadata.fields',
                        ),
                        undefined,
                      );
                    }
                  }}
                />
              </FormControl>
              <FormLabel tooltip={t('chat.showChunkMetadataTip')}>
                {t('chat.showChunkMetadata')}
              </FormLabel>
            </FormItem>
          )}
        />
        {metadataInclude && (
          <FormField
            control={form.control}
            name={prefixName(prefix, 'prompt_config.reference_metadata.fields')}
            render={({ field }) => (
              <FormItem>
                <FormLabel tooltip={t('chat.metadataFieldsTip')}>
                  {t('chat.metadataFields')}
                </FormLabel>
                <FormControl className="bg-bg-input">
                  <MultiSelect
                    options={metadataFieldOptions}
                    onValueChange={field.onChange}
                    showSelectAll={false}
                    placeholder={t('common.pleaseSelect')}
                    maxCount={20}
                    defaultValue={Array.isArray(field.value) ? field.value : []}
                    value={Array.isArray(field.value) ? field.value : []}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name={prefixName(prefix, 'prompt_config.system')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('chat.system')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={8}
                  placeholder={t('chat.systemPlaceholder')}
                  className="overflow-y-auto"
                  dir={getDirAttribute(systemPromptValue || '')}
                />
              </FormControl>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <ActionTooltip
                  content={readOnly ? t('common.readOnlySaveTip') : undefined}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={readOnly}
                    onClick={() => {
                      form.setValue(
                        prefixName(prefix, 'prompt_config.system'),
                        t('chat.systemInitialValue'),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  >
                    <RotateCcw />
                    {t('chat.restoreDefaultPrompt')}
                  </Button>
                </ActionTooltip>
                <ActionTooltip content={optimizeDisabledReason}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={Boolean(optimizeDisabledReason)}
                    onClick={() => {
                      setPromptSnapshot(systemPromptValue);
                      setOptimizerOpen(true);
                    }}
                  >
                    <Sparkles />
                    {t('chat.optimizePrompt')}
                  </Button>
                </ActionTooltip>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <PromptOptimizerDialog
          chatId={chatId}
          llmId={llmId}
          prompt={promptSnapshot}
          open={optimizerOpen}
          onOpenChange={setOptimizerOpen}
          onApply={(optimizedPrompt) => {
            form.setValue(
              prefixName(prefix, 'prompt_config.system'),
              optimizedPrompt,
              { shouldDirty: true, shouldValidate: true },
            );
          }}
        />
        <SimilaritySliderFormField
          isTooltipShown
          similarityName={prefixName(prefix, 'similarity_threshold')}
          similarityWeightName={prefixName(prefix, 'vector_similarity_weight')}
        ></SimilaritySliderFormField>
        <PrefetchSizeFormField
          name={prefixName(prefix, 'prefetch_size')}
        ></PrefetchSizeFormField>
        <TopNFormField name={prefixName(prefix, 'top_n')}></TopNFormField>

        <SwitchFormField
          name={prefixName(prefix, 'prompt_config.refine_multiturn')}
          label={t('chat.multiTurn')}
          tooltip={t('chat.multiTurnTip')}
        ></SwitchFormField>
        <UseKnowledgeGraphFormField
          name={prefixName(prefix, 'prompt_config.use_kg')}
        ></UseKnowledgeGraphFormField>
        <RerankFormFields prefix={prefix}></RerankFormFields>
        <CrossLanguageFormField
          name={prefixName(prefix, 'prompt_config.cross_languages')}
        ></CrossLanguageFormField>
        <DynamicVariableForm
          name={prefixName(prefix, 'prompt_config.parameters')}
        ></DynamicVariableForm>
      </div>
    </Collapse>
  );
}
