import { FormLayout } from '@/constants/form';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectWithSearch } from './originui/select-with-search';
import { SliderInputFormField } from './slider-input-form-field';

type TopSelectProps = {
  max?: number;
  value?: number;
  onChange?(value: number): void;
};

export function TopSelect({ max = 100, value = 10, onChange }: TopSelectProps) {
  const { t } = useTranslation();

  const sizeChangerOptions = useMemo(() => {
    return [10, 20, 50, 100]
      .filter((x) => x <= max)
      .map((x) => ({
        label: <span>{t('common.top', { top: x })}</span>,
        value: x.toString(),
      }));
  }, [max, t]);

  return (
    <SelectWithSearch
      options={sizeChangerOptions}
      value={value.toString()}
      onChange={(val) => onChange?.(Number(val))}
    ></SelectWithSearch>
  );
}

export function TopSelectFormItem() {
  const { t } = useTranslation();

  return (
    <SliderInputFormField
      name="size"
      label={t('chat.topN')}
      min={1}
      max={100}
      layout={FormLayout.Vertical}
    ></SliderInputFormField>
  );
}
