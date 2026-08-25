import { FormFieldConfig, FormFieldType } from '@/components/dynamic-form';
import SvgIcon from '@/components/svg-icon';
import { t, TFunction } from 'i18next';
import { Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IDataSourceInfoMap } from '../interface';
import { azureDevOpsConstant } from './azure-devops-constant';
import { S3Constant } from './s3-constant';

export enum DataSourceKey {
  S3 = 's3',
  AZURE_DEVOPS = 'azure_devops',
  IMAP = 'imap',
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
}

type DataSourceFormValues = Record<string, any>;

export const generateDataSourceInfo = (translate: TFunction) => ({
  [DataSourceKey.S3]: {
    name: 'S3',
    description: translate('setting.s3Description'),
    icon: <SvgIcon name="data-source/s3" width={38} />,
  },
  [DataSourceKey.AZURE_DEVOPS]: {
    name: 'Azure DevOps',
    description: translate('setting.azure_devopsDescription'),
    icon: <SvgIcon name="data-source/azure-devops" width={38} />,
  },
  [DataSourceKey.IMAP]: {
    name: 'IMAP',
    description: translate('setting.imapDescription'),
    icon: <Mail className="text-text-primary" size={22} />,
  },
  [DataSourceKey.MYSQL]: {
    name: 'MySQL',
    description: translate('setting.mysqlDescription'),
    icon: <SvgIcon name="data-source/mysql" width={38} />,
  },
  [DataSourceKey.POSTGRESQL]: {
    name: 'PostgreSQL',
    description: translate('setting.postgresqlDescription'),
    icon: <SvgIcon name="data-source/postgresql" width={38} />,
  },
});

export const useDataSourceInfo = () => {
  const { t: translate } = useTranslation();
  const [dataSourceInfo, setDataSourceInfo] = useState<IDataSourceInfoMap>(
    generateDataSourceInfo(translate),
  );

  useEffect(() => {
    setDataSourceInfo(generateDataSourceInfo(translate));
  }, [translate]);

  return { dataSourceInfo };
};

const isPlainObject = (value: unknown): value is DataSourceFormValues =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const mergeDataSourceFormValues = (
  ...values: Array<DataSourceFormValues | undefined>
): DataSourceFormValues =>
  values.reduce<DataSourceFormValues>((result, current) => {
    if (!current) return result;

    const next = { ...result };
    Object.entries(current).forEach(([key, value]) => {
      next[key] =
        isPlainObject(value) && isPlainObject(next[key])
          ? mergeDataSourceFormValues(next[key], value)
          : value;
    });
    return next;
  }, {});

export const DataSourceFormBaseFields = [
  {
    id: 'Id',
    name: 'id',
    type: FormFieldType.Text,
    required: false,
    hidden: true,
  },
  {
    label: t('setting.dataSourceName'),
    name: 'name',
    type: FormFieldType.Text,
    required: true,
    tooltip: t('setting.connectorNameTip'),
  },
  {
    label: t('setting.dataSourceSource'),
    name: 'source',
    type: FormFieldType.Select,
    required: true,
    hidden: true,
    options: Object.values(DataSourceKey).map((value) => ({
      label: value,
      value,
    })),
  },
];

export const getCommonExtraFields = (): FormFieldConfig[] => [
  {
    label: t('setting.syncDeletedFiles'),
    name: 'config.sync_deleted_files',
    type: FormFieldType.Checkbox,
    required: false,
    defaultValue: false,
  },
];

export const getCommonExtraDefaultValues = () => ({
  config: { sync_deleted_files: false },
});

const relationalDatabaseFields = (
  database: 'mysql' | 'postgresql',
  port: number,
): FormFieldConfig[] => [
  {
    label: t('setting.dataSourceHost'),
    name: 'config.host',
    type: FormFieldType.Text,
    required: true,
    placeholder: 'localhost',
  },
  {
    label: t('setting.dataSourcePort'),
    name: 'config.port',
    type: FormFieldType.Number,
    required: true,
    placeholder: String(port),
  },
  {
    label: t('setting.dataSourceDatabase'),
    name: 'config.database',
    type: FormFieldType.Text,
    required: true,
  },
  {
    label: t('setting.dataSourceUsername'),
    name: 'config.credentials.username',
    type: FormFieldType.Text,
    required: true,
  },
  {
    label: t('setting.dataSourcePassword'),
    name: 'config.credentials.password',
    type: FormFieldType.Password,
    required: true,
  },
  {
    label: t('setting.dataSourceSqlQuery'),
    name: 'config.query',
    type: FormFieldType.Textarea,
    required: false,
    placeholder: t('setting.dataSourceSqlQueryPlaceholder'),
    tooltip: t(`setting.${database}QueryTip`),
  },
  {
    label: t('setting.dataSourceContentColumns'),
    name: 'config.content_columns',
    type: FormFieldType.Text,
    required: false,
    placeholder: 'title,description,content',
    tooltip: t(`setting.${database}ContentColumnsTip`),
  },
  {
    label: t('setting.dataSourceMetadataColumns'),
    name: 'config.metadata_columns',
    type: FormFieldType.Text,
    required: false,
    placeholder: 'id,category,status',
    tooltip: t(`setting.${database}MetadataColumnsTip`),
  },
  {
    label: t('setting.dataSourceIdColumn'),
    name: 'config.id_column',
    type: FormFieldType.Text,
    required: false,
    placeholder: 'id',
    tooltip: t(`setting.${database}IdColumnTip`),
  },
  {
    label: t('setting.dataSourceTimestampColumn'),
    name: 'config.timestamp_column',
    type: FormFieldType.Text,
    required: false,
    placeholder: 'updated_at',
    tooltip: t(`setting.${database}TimestampColumnTip`),
  },
];

export const DataSourceFormFields: Record<DataSourceKey, FormFieldConfig[]> = {
  [DataSourceKey.S3]: S3Constant(t),
  [DataSourceKey.AZURE_DEVOPS]: azureDevOpsConstant(t),
  [DataSourceKey.IMAP]: [
    {
      label: t('setting.dataSourceUsername'),
      name: 'config.credentials.imap_username',
      type: FormFieldType.Text,
      required: true,
    },
    {
      label: t('setting.dataSourcePassword'),
      name: 'config.credentials.imap_password',
      type: FormFieldType.Password,
      required: true,
    },
    {
      label: t('setting.dataSourceHost'),
      name: 'config.imap_host',
      type: FormFieldType.Text,
      required: true,
    },
    {
      label: t('setting.dataSourcePort'),
      name: 'config.imap_port',
      type: FormFieldType.Number,
      required: true,
    },
    {
      label: t('setting.dataSourceMailboxes'),
      name: 'config.imap_mailbox',
      type: FormFieldType.Tag,
      required: false,
    },
    {
      label: t('setting.dataSourcePollRange'),
      name: 'config.poll_range',
      type: FormFieldType.Number,
      required: false,
    },
  ],
  [DataSourceKey.MYSQL]: relationalDatabaseFields('mysql', 3306),
  [DataSourceKey.POSTGRESQL]: relationalDatabaseFields('postgresql', 5432),
};

export const DataSourceFormDefaultValues = {
  [DataSourceKey.S3]: {
    name: '',
    source: DataSourceKey.S3,
    config: {
      bucket_name: '',
      bucket_type: 's3',
      prefix: '',
      credentials: {
        aws_access_key_id: '',
        aws_secret_access_key: '',
        region: '',
        authentication_method: 'access_key',
        aws_role_arn: '',
        endpoint_url: '',
        addressing_style: 'virtual',
      },
    },
  },
  [DataSourceKey.AZURE_DEVOPS]: {
    name: '',
    source: DataSourceKey.AZURE_DEVOPS,
    config: {
      organization: '',
      index_mode: 'organization',
      projects: '',
      repositories: '',
      content_types: 'both',
      credentials: { azure_devops_pat: '' },
    },
  },
  [DataSourceKey.IMAP]: {
    name: '',
    source: DataSourceKey.IMAP,
    config: {
      imap_host: '',
      imap_port: 993,
      imap_mailbox: [],
      poll_range: 30,
      credentials: { imap_username: '', imap_password: '' },
    },
  },
  [DataSourceKey.MYSQL]: {
    name: '',
    source: DataSourceKey.MYSQL,
    config: {
      host: 'localhost',
      port: 3306,
      database: '',
      query: '',
      content_columns: '',
      metadata_columns: '',
      id_column: '',
      timestamp_column: '',
      credentials: { username: '', password: '' },
    },
  },
  [DataSourceKey.POSTGRESQL]: {
    name: '',
    source: DataSourceKey.POSTGRESQL,
    config: {
      host: 'localhost',
      port: 5432,
      database: '',
      query: '',
      content_columns: '',
      metadata_columns: '',
      id_column: '',
      timestamp_column: '',
      credentials: { username: '', password: '' },
    },
  },
};

export const getDataSourceFieldsWithExtras = (
  source?: DataSourceKey,
): FormFieldConfig[] =>
  source ? [...DataSourceFormFields[source], ...getCommonExtraFields()] : [];
