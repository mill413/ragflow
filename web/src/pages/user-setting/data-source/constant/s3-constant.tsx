import { FilterFormField, FormFieldType } from '@/components/dynamic-form';
import { TFunction } from 'i18next';
import { BedrockRegionList } from '../../setting-model/constants';

const awsRegionOptions = BedrockRegionList.map((r) => ({
  label: r,
  value: r,
}));
export const S3Constant = (t: TFunction) => [
  {
    label: t('setting.dataSourceBucketName'),
    name: 'config.bucket_name',
    type: FormFieldType.Text,
    required: true,
  },
  {
    label: t('setting.dataSourceRegion'),
    name: 'config.credentials.region',
    type: FormFieldType.Select,
    required: false,
    options: awsRegionOptions,
    allowCustomValue: true,
    customValidate: (val: string, formValues: any) => {
      const credentials = formValues?.config?.credentials || {};
      const bucketType = formValues?.config?.bucket_type || 's3';
      const hasAccessKey = Boolean(
        credentials.aws_access_key_id || credentials.aws_secret_access_key,
      );
      if (bucketType === 's3' && hasAccessKey) {
        return Boolean(val) || t('setting.dataSourceRegionRequired');
      }
      return true;
    },
  },
  {
    label: t('setting.dataSourcePrefix'),
    name: 'config.prefix',
    type: FormFieldType.Text,
    required: false,
    tooltip: t('setting.s3PrefixTip'),
  },

  {
    label: t('setting.dataSourceMode'),
    name: 'config.bucket_type',
    type: FormFieldType.Segmented,
    options: [
      { label: 'S3', value: 's3' },
      {
        label: t('setting.dataSourceS3Compatible'),
        value: 's3_compatible',
      },
    ],
  },
  {
    label: t('setting.dataSourceAuthentication'),
    name: 'config.credentials.authentication_method',
    type: FormFieldType.Segmented,
    options: [
      { label: t('setting.dataSourceAccessKey'), value: 'access_key' },
      { label: t('setting.dataSourceIamRole'), value: 'iam_role' },
      { label: t('setting.dataSourceAssumeRole'), value: 'assume_role' },
    ],
    shouldRender: (formValues: any) => {
      const bucketType = formValues?.config?.bucket_type;
      return bucketType === 's3';
    },
  },
  {
    name: 'config.credentials.aws_access_key_id',
    label: t('setting.dataSourceAccessKeyId'),
    type: FormFieldType.Text,
    customValidate: (val: string, formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      if (
        !val &&
        (authMode === 'access_key' || bucketType === 's3_compatible')
      ) {
        return t('setting.dataSourceAccessKeyIdRequired');
      }
      return true;
    },
    shouldRender: (formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      return authMode === 'access_key' || bucketType === 's3_compatible';
    },
  },
  {
    name: 'config.credentials.aws_secret_access_key',
    label: t('setting.dataSourceSecretAccessKey'),
    type: FormFieldType.Password,
    customValidate: (val: string, formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      if (authMode === 'access_key' || bucketType === 's3_compatible') {
        return Boolean(val) || t('setting.dataSourceSecretAccessKeyRequired');
      }
      return true;
    },
    shouldRender: (formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      return authMode === 'access_key' || bucketType === 's3_compatible';
    },
  },
  {
    name: 'config.credentials.aws_role_arn',
    label: t('setting.dataSourceRoleArn'),
    tooltip: t('setting.dataSourceRoleArnTip'),
    type: FormFieldType.Text,
    placeholder: 'arn:aws:iam::123456789012:role/YourRole',
    customValidate: (val: string, formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      if (authMode === 'iam_role' || bucketType === 's3') {
        return Boolean(val) || t('setting.dataSourceRoleArnRequired');
      }
      return true;
    },
    shouldRender: (formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      return authMode === 'iam_role' && bucketType === 's3';
    },
  },
  {
    name: FilterFormField + '.tip',
    label: ' ',
    type: FormFieldType.Custom,
    shouldRender: (formValues: any) => {
      const authMode = formValues?.config?.credentials?.authentication_method;
      const bucketType = formValues?.config?.bucket_type;
      return authMode === 'assume_role' && bucketType === 's3';
    },
    render: () => (
      <div className="text-sm text-text-secondary bg-bg-card border border-border-button rounded-md px-3 py-2">
        {t('setting.dataSourceNoCredentialsRequired')}
      </div>
    ),
  },
  {
    name: 'config.credentials.addressing_style',
    label: t('setting.dataSourceAddressingStyle'),
    tooltip: t('setting.S3CompatibleAddressingStyleTip'),
    required: false,
    type: FormFieldType.Select,
    defaultValue: 'virtual',
    options: [
      {
        label: t('setting.dataSourceVirtualHostedStyle'),
        value: 'virtual',
      },
      { label: t('setting.dataSourcePathStyle'), value: 'path' },
    ],
    shouldRender: (formValues: any) => {
      // const authMode = formValues?.config?.authMode;
      const bucketType = formValues?.config?.bucket_type;
      return bucketType === 's3_compatible';
    },
  },
  {
    name: 'config.credentials.endpoint_url',
    label: t('setting.dataSourceEndpointUrl'),
    tooltip: t('setting.S3CompatibleEndpointUrlTip'),
    placeholder: 'https://fsn1.your-objectstorage.com',
    required: false,
    type: FormFieldType.Text,
    shouldRender: (formValues: any) => {
      const bucketType = formValues?.config?.bucket_type;
      return bucketType === 's3_compatible';
    },
  },
  // {
  //   label: 'Credentials',
  //   name: 'config.credentials.__blob_token',
  //   type: FormFieldType.Custom,
  //   hideLabel: true,
  //   required: false,
  //   render: () => <BlobTokenField />,
  // },
];
