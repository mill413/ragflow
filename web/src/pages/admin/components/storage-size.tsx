import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatBytes, formatDecimalBytes } from '@/lib/utils';

type StorageSizeProps = {
  bytes: number;
  decimals?: number;
  className?: string;
};

export function StorageSize({
  bytes,
  decimals = 1,
  className,
}: StorageSizeProps) {
  const binarySize = formatBytes(bytes, {
    decimals,
    sizeType: 'accurate',
  });
  const decimalSize = formatDecimalBytes(bytes, { decimals });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-block cursor-help', className)}
          aria-label={`${binarySize}; ${decimalSize}`}
        >
          {binarySize}
        </span>
      </TooltipTrigger>
      <TooltipContent>{decimalSize}</TooltipContent>
    </Tooltip>
  );
}
