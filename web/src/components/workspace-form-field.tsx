import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface WorkspaceFormFieldProps {
  options: Array<{ label: string; value: string }>;
}

export function WorkspaceFormField({ options }: WorkspaceFormFieldProps) {
  const { t } = useTranslation();
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="workspace_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel required>{t('setting.workspace')}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
