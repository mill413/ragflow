import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import CopyToClipboard from '@/components/copy-to-clipboard';
import { AlertTriangle, FileText } from 'lucide-react';

const ERROR_LINE_PATTERN =
  /(?:\[error\]|\berror\b|\bexception\b|traceback|failed|failure)/i;

function getImportantLines(reason: string) {
  const lines = reason
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const importantLines = lines.filter((line) => ERROR_LINE_PATTERN.test(line));
  return [...new Set(importantLines.length ? importantLines : lines)].slice(-5);
}

export function ParseFailureDetail({ reason }: { reason?: string }) {
  const { t } = useTranslation();
  const failureReason = reason?.trim() || '';
  const lines = failureReason.split(/\r?\n/);
  const importantLines = useMemo(
    () => getImportantLines(failureReason),
    [failureReason],
  );

  if (!failureReason) {
    return (
      <div className="rounded-lg border-0.5 border-border-button bg-bg-input p-4 text-sm text-text-secondary">
        {t('admin.resourceManagementPage.noFailureReason')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="size-4 text-state-error" />
          {t('admin.resourceManagementPage.importantFailureMessages')}
        </div>
        <div className="space-y-2 rounded-lg border-0.5 border-state-error/30 bg-state-error/5 p-4">
          {importantLines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className="break-all font-mono text-xs leading-6 text-state-error select-text"
            >
              {line}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-text-secondary" />
            {t('admin.resourceManagementPage.fullParseLog')}
          </div>
          <CopyToClipboard text={failureReason} />
        </div>
        <div className="max-h-[48vh] overflow-auto rounded-lg border-0.5 border-border-button bg-bg-input py-3 font-mono text-xs leading-6 text-text-primary select-text">
          {lines.map((line, index) => (
            <div
              key={index}
              className={
                ERROR_LINE_PATTERN.test(line)
                  ? 'grid grid-cols-[3.5rem_minmax(0,1fr)] bg-state-error/10 text-state-error'
                  : 'grid grid-cols-[3.5rem_minmax(0,1fr)]'
              }
            >
              <span className="border-r border-border-button px-3 text-right text-text-disabled">
                {index + 1}
              </span>
              <span className="whitespace-pre-wrap break-all px-3">
                {line || ' '}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
