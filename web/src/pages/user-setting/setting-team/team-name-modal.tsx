import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal/modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

type Props = {
  open: boolean;
  initialName?: string;
  loading?: boolean;
  onClose: () => void;
  onOk: (name: string) => Promise<unknown>;
};

export function TeamNameModal({
  open,
  initialName = '',
  loading,
  onClose,
  onOk,
}: Props) {
  const { t } = useTranslation();
  const schema = z.object({
    name: z.string().trim().min(1, t('common.required')).max(100),
  });
  const form = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialName },
  });

  useEffect(() => form.reset({ name: initialName }), [form, initialName, open]);

  return (
    <Modal
      title={initialName ? t('common.rename') : t('setting.createTeam')}
      open={open}
      onOpenChange={(value) => !value && onClose()}
      onOk={form.handleSubmit(async ({ name }) => onOk(name))}
      confirmLoading={loading}
      okText={t('common.ok')}
      cancelText={t('common.cancel')}
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>{t('setting.teamName')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </Modal>
  );
}
