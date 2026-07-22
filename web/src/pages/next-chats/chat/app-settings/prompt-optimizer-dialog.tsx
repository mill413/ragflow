import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useOptimizeChatPrompt } from '@/hooks/use-chat-request';
import { getDirAttribute } from '@/utils/text-direction';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type PromptOptimizerDialogProps = {
  chatId: string;
  llmId?: string;
  prompt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (prompt: string) => void;
};

export function PromptOptimizerDialog({
  chatId,
  llmId,
  prompt,
  open,
  onOpenChange,
  onApply,
}: PromptOptimizerDialogProps) {
  const { t } = useTranslation();
  const { optimizePrompt, loading } = useOptimizeChatPrompt();
  const [optimizedPrompt, setOptimizedPrompt] = useState('');

  const runOptimization = useCallback(async () => {
    try {
      const result = await optimizePrompt({ chatId, prompt, llmId });
      setOptimizedPrompt(result);
    } catch {
      setOptimizedPrompt('');
    }
  }, [chatId, llmId, optimizePrompt, prompt]);

  useEffect(() => {
    if (open) {
      setOptimizedPrompt('');
      void runOptimization();
    }
  }, [open, runOptimization]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setOptimizedPrompt('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('chat.optimizePromptTitle')}</DialogTitle>
          <DialogDescription>
            {t('chat.optimizePromptDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {t('chat.currentPrompt')}
            </div>
            <Textarea
              value={prompt}
              readOnly
              rows={18}
              className="resize-none overflow-y-auto bg-bg-input"
              dir={getDirAttribute(prompt)}
            />
          </div>
          <div className="space-y-2 min-w-0">
            <div className="text-sm font-medium text-text-primary">
              {t('chat.optimizedPrompt')}
            </div>
            <Textarea
              value={optimizedPrompt}
              onChange={(event) => setOptimizedPrompt(event.target.value)}
              rows={18}
              disabled={loading}
              placeholder={
                loading
                  ? t('chat.optimizingPrompt')
                  : t('chat.optimizedPromptPlaceholder')
              }
              className="resize-none overflow-y-auto"
              dir={getDirAttribute(optimizedPrompt)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={loading}
            onClick={runOptimization}
          >
            <Sparkles />
            {optimizedPrompt
              ? t('chat.reoptimizePrompt')
              : t('chat.optimizePrompt')}
          </Button>
          <Button
            type="button"
            disabled={!optimizedPrompt.trim() || loading}
            onClick={() => {
              onApply(optimizedPrompt.trim());
              handleOpenChange(false);
            }}
          >
            {t('chat.applyOptimizedPrompt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
