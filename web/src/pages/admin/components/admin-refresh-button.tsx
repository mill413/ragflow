import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminRefreshButtonProps = {
  queryKeys: ReadonlyArray<readonly unknown[]>;
  className?: string;
};

function matchesQueryKey(
  queryKey: readonly unknown[],
  prefix: readonly unknown[],
) {
  return (
    queryKey.length >= prefix.length &&
    prefix.every((part, index) => Object.is(part, queryKey[index]))
  );
}

export function AdminRefreshButton({
  queryKeys,
  className,
}: AdminRefreshButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const fetchingCount = useIsFetching({
    predicate: (query) =>
      queryKeys.some((queryKey) => matchesQueryKey(query.queryKey, queryKey)),
  });
  const loading = refreshing || fetchingCount > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        queryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn('h-10 px-4', className)}
      disabled={loading}
      onClick={handleRefresh}
    >
      <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
      {t('common.refresh')}
    </Button>
  );
}
