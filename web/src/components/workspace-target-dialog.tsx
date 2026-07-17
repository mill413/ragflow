import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WorkspaceOption {
  value: string;
  label: string;
}

interface WorkspaceTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: WorkspaceOption[];
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceTargetDialog({
  open,
  onOpenChange,
  options,
  onSelect,
}: WorkspaceTargetDialogProps) {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    if (open) setWorkspaceId(options[0]?.value || '');
  }, [open, options]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('setting.selectCreationWorkspace')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 px-6">
          <Label>{t('setting.workspace')}</Label>
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!workspaceId} onClick={() => onSelect(workspaceId)}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
