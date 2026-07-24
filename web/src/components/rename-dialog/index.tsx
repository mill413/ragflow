import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TagRenameId } from '@/constants/knowledge';
import { IModalProps } from '@/interfaces/common';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonLoading } from '../ui/button';
import { RenameForm } from './rename-form';

type RenameDialogProps = Omit<IModalProps<any>, 'onOk'> & {
  initialName?: string;
  title?: ReactNode;
  showWorkspace?: boolean;
  onOk?: (name: string, workspaceId?: string) => unknown;
};

export function RenameDialog({
  hideModal,
  initialName,
  onOk,
  loading,
  title,
  showWorkspace = false,
}: RenameDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={hideModal}>
      <DialogContent className="sm:max-w-[425px]" data-testid="rename-modal">
        <DialogHeader>
          <DialogTitle>{title || t('common.rename')}</DialogTitle>
        </DialogHeader>
        <RenameForm
          initialName={initialName}
          hideModal={hideModal}
          onOk={onOk}
          showWorkspace={showWorkspace}
        ></RenameForm>
        <DialogFooter>
          <ButtonLoading
            data-testid="rename-save"
            type="submit"
            form={TagRenameId}
            loading={loading}
          >
            {t('common.save')}
          </ButtonLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
