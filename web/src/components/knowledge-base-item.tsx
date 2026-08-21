import { DocumentParserType } from '@/constants/knowledge';
import {
  useFetchDatasetsByIds,
  useFetchKnowledgeList,
} from '@/hooks/use-knowledge-request';
import { IDataset } from '@/interfaces/database/dataset';
import { useBuildQueryVariableOptions } from '@/pages/agent/hooks/use-get-begin-query';
import { useDebounce } from 'ahooks';
import { toLower } from 'lodash';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RAGFlowAvatar } from './ragflow-avatar';
import { RAGFlowFormItem } from './ragflow-form';
import { MultiSelect } from './ui/multi-select';

function buildQueryVariableOptionsByShowVariable(showVariable?: boolean) {
  return showVariable ? useBuildQueryVariableOptions : () => [];
}

function DatasetLabel({ text }: { text: string }) {
  return (
    <div className="text-xs px-3 p-1 bg-bg-card text-text-secondary rounded-lg border border-bg-card">
      {text}
    </div>
  );
}

export function useDisableDifferenceEmbeddingDataset(
  name: string,
  workspaceId?: string,
) {
  const form = useFormContext();
  const datasetId = useWatch({ name, control: form.control });
  const [searchString, setSearchString] = useState('');
  const debouncedSearchString = useDebounce(searchString, { wait: 500 });
  const { list: datasetListOrigin, loading } = useFetchKnowledgeList(
    true,
    debouncedSearchString,
    workspaceId,
  );
  const selectedDatasetIds = useMemo(
    () => (Array.isArray(datasetId) ? datasetId : []),
    [datasetId],
  );
  const { data: selectedDatasets } = useFetchDatasetsByIds(selectedDatasetIds);

  const datasetList = useMemo(() => {
    return Array.from(
      new Map(
        [...datasetListOrigin, ...(selectedDatasets ?? [])].map((dataset) => [
          dataset.id,
          dataset,
        ]),
      ).values(),
    );
  }, [datasetListOrigin, selectedDatasets]);

  const selectedEmbedId = useMemo(() => {
    const data = datasetList?.find((item) => item.id === datasetId?.[0]);
    return data?.embedding_model ?? '';
  }, [datasetId, datasetList]);

  const nextOptions = useMemo(() => {
    const datasetListMap = datasetList
      .filter(
        (dataset) =>
          dataset.chunk_count > 0 &&
          dataset.chunk_method !== DocumentParserType.Tag,
      )
      .map((item: IDataset) => {
        return {
          label: item.name,
          icon: () => (
            <RAGFlowAvatar
              className="size-4"
              avatar={item.avatar}
              name={item.name}
            />
          ),
          suffix: (
            <section className="flex gap-2">
              <DatasetLabel text={item.nickname} />
              <DatasetLabel text={item.embedding_model} />
            </section>
          ),
          value: item.id,
          disabled:
            item.embedding_model !== selectedEmbedId && selectedEmbedId !== '',
        };
      });

    return datasetListMap;
  }, [datasetList, selectedEmbedId]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchString(value);
  }, []);

  return {
    datasetOptions: nextOptions,
    handleSearchChange,
    loading,
    searchString,
  };
}

export function KnowledgeBaseFormField({
  showVariable = false,
  name = 'dataset_ids',
  required = false,
  workspaceId,
}: {
  showVariable?: boolean;
  name?: string;
  required?: boolean;
  workspaceId?: string;
}) {
  const { t } = useTranslation();

  const { datasetOptions, handleSearchChange, loading, searchString } =
    useDisableDifferenceEmbeddingDataset(name, workspaceId);

  const nextOptions = buildQueryVariableOptionsByShowVariable(showVariable)();

  const knowledgeOptions = datasetOptions;
  const options = useMemo(() => {
    if (showVariable) {
      return [
        {
          label: t('knowledgeDetails.dataset'),
          options: knowledgeOptions,
        },
        ...nextOptions.map((x) => {
          const groupLabel = (('label' in x
            ? x.label
            : 'title' in x
              ? x.title
              : '') ?? '') as ReactNode;

          return {
            ...x,
            label: groupLabel,
            options: x.options
              .filter((y) => toLower(y.type).includes('string'))
              .map((x) => ({
                ...x,
                label: x.label ?? x.value ?? '',
                value: x.value ?? '',
                icon: () => (
                  <RAGFlowAvatar
                    className="size-4 mr-2"
                    avatar={String(x.label ?? '')}
                    name={String(x.label ?? '')}
                  />
                ),
              })),
          };
        }),
      ];
    }

    return knowledgeOptions;
  }, [knowledgeOptions, nextOptions, showVariable, t]);

  return (
    <RAGFlowFormItem
      name={name}
      tooltip={t('chat.knowledgeBasesTip')}
      required={required}
      label={t('chat.knowledgeBases')}
    >
      {(field) => (
        <MultiSelect
          data-testid="chat-datasets-combobox"
          options={options}
          onValueChange={field.onChange}
          placeholder={t('chat.knowledgeBasesPlaceholder')}
          variant="inverted"
          maxCount={100}
          defaultValue={field.value}
          showSelectAll={false}
          popoverTestId="datasets-options"
          optionTestIdPrefix="datasets"
          searchValue={searchString}
          onSearchChange={handleSearchChange}
          isSearching={loading}
          shouldFilter={false}
          {...field}
        />
      )}
    </RAGFlowFormItem>
  );
}
