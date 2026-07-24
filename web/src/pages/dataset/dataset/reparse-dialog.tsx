import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import {
  DynamicForm,
  DynamicFormRef,
  FormFieldConfig,
  FormFieldType,
} from '@/components/dynamic-form';
import { Checkbox } from '@/components/ui/checkbox';
import { RunDocumentOptions } from '@/hooks/use-document-request';
import { DialogProps } from '@radix-ui/react-dialog';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ControllerRenderProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export const ReparseDialog = memo(
  ({
    handleOperationIconClick,
    chunk_num,
    enable_metadata = false,
    hidden = false,
    visible = true,
    hideModal,
  }: DialogProps & {
    chunk_num: number;
    handleOperationIconClick: (options?: RunDocumentOptions) => void;
    enable_metadata?: boolean;
    visible: boolean;
    hideModal: () => void;
    hidden?: boolean;
  }) => {
    const [defaultValues, setDefaultValues] = useState<any>(null);
    const [fields, setFields] = useState<FormFieldConfig[]>([]);
    const { t } = useTranslation();
    const handleOperationIconClickRef = useRef(handleOperationIconClick);
    const hiddenRef = useRef(hidden);

    useEffect(() => {
      handleOperationIconClickRef.current = handleOperationIconClick;
      hiddenRef.current = hidden;
    });

    useEffect(() => {
      if (hiddenRef.current) {
        handleOperationIconClickRef.current();
      }
    }, []);
    useEffect(() => {
      setDefaultValues({
        delete: chunk_num > 0,
        apply_kb: false,
        apply_kb_config: false,
      });
      const deleteField = {
        name: 'delete',
        label: '',
        type: FormFieldType.Checkbox,
        render: (fieldProps: ControllerRenderProps) => (
          <div className="flex items-center text-text-secondary p-5 border border-border-button rounded-lg">
            <Checkbox
              {...fieldProps}
              checked={fieldProps.value}
              onCheckedChange={(checked: boolean) => {
                fieldProps.onChange(checked);
              }}
            />
            <span className="ml-2">
              {chunk_num > 0
                ? t(`knowledgeDetails.redo`, {
                    chunkNum: chunk_num,
                  })
                : t('knowledgeDetails.redoAll')}
            </span>
          </div>
        ),
      };
      const applyKBField = {
        name: 'apply_kb',
        label: '',
        type: FormFieldType.Checkbox,
        defaultValue: false,
        render: (fieldProps: ControllerRenderProps) => (
          <div className="flex items-center text-text-secondary p-5 border border-border-button rounded-lg">
            <Checkbox
              {...fieldProps}
              checked={fieldProps.value}
              onCheckedChange={(checked: boolean) => {
                fieldProps.onChange(checked);
              }}
            />
            <span className="ml-2">
              {t('knowledgeDetails.applyAutoMetadataSettings')}
            </span>
          </div>
        ),
      };
      const applyKBConfigField = {
        name: 'apply_kb_config',
        label: '',
        type: FormFieldType.Checkbox,
        defaultValue: false,
        render: (fieldProps: ControllerRenderProps) => (
          <div className="flex items-start text-text-secondary p-5 border border-border-button rounded-lg">
            <Checkbox
              {...fieldProps}
              className="mt-0.5"
              checked={fieldProps.value}
              onCheckedChange={(checked: boolean) => {
                fieldProps.onChange(checked);
              }}
            />
            <span className="ml-2">
              <span className="block text-text-primary">
                {t('knowledgeDetails.applyKnowledgeBaseParsingSettings')}
              </span>
              <span className="mt-1 block text-sm">
                {t(
                  'knowledgeDetails.applyKnowledgeBaseParsingSettingsDescription',
                )}
              </span>
            </span>
          </div>
        ),
      };
      if (chunk_num > 0 && enable_metadata) {
        setFields([deleteField, applyKBConfigField, applyKBField]);
      } else if (chunk_num > 0 && !enable_metadata) {
        setFields([deleteField, applyKBConfigField]);
      } else if (chunk_num <= 0 && enable_metadata) {
        setFields([applyKBConfigField, applyKBField]);
      } else {
        setFields([applyKBConfigField]);
      }
    }, [chunk_num, t, enable_metadata]);

    const formCallbackRef = useRef<DynamicFormRef>(null);

    const handleCancel = useCallback(() => {
      hideModal?.();
      formCallbackRef?.current?.reset();
    }, [formCallbackRef, hideModal]);

    const handleSave = useCallback(async () => {
      const instance = formCallbackRef?.current;
      if (!instance) {
        return;
      }

      const check = await instance.trigger();
      if (check) {
        instance.submit();
        const formValues = instance.getValues();
        handleOperationIconClick({
          delete: formValues.delete,
          apply_kb: formValues.apply_kb,
          apply_kb_config: formValues.apply_kb_config,
        });
      }
    }, [formCallbackRef, handleOperationIconClick]);

    return (
      <ConfirmDeleteDialog
        title={t(`knowledgeDetails.parseFile`)}
        onOk={() => handleSave()}
        onCancel={() => handleCancel()}
        hidden={hidden}
        open={visible}
        okButtonText={t('common.confirm')}
        content={{
          title: t(`knowledgeDetails.parseFileTip`),
          node: (
            <div>
              <DynamicForm.Root
                onSubmit={() => undefined}
                ref={formCallbackRef}
                fields={fields}
                defaultValues={defaultValues}
              />
            </div>
          ),
        }}
      />
    );
  },
);

ReparseDialog.displayName = 'ReparseDialog';
