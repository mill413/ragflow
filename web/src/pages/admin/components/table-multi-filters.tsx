import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  MultiSelect,
  type MultiSelectOptionType,
} from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';

export type AdminTableFilter = {
  id: string;
  label: string;
  options: MultiSelectOptionType[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
};

type AdminTableMultiFiltersProps = {
  filters: AdminTableFilter[];
  resetLabel: string;
  onReset: () => void;
  className?: string;
};

export function AdminTableMultiFilters({
  filters,
  resetLabel,
  onReset,
  className,
}: AdminTableMultiFiltersProps) {
  const [resetVersion, setResetVersion] = useState(0);
  const activeFilters = filters.filter((filter) => filter.options.length > 0);

  if (!activeFilters.length) return null;

  const reset = () => {
    onReset();
    setResetVersion((current) => current + 1);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {activeFilters.map((filter) => (
        <MultiSelect
          key={`${filter.id}-${resetVersion}`}
          options={filter.options}
          defaultValue={filter.value}
          onValueChange={filter.onChange}
          placeholder={filter.label}
          maxCount={1}
          className={cn('w-52', filter.className)}
        />
      ))}
      <Button
        variant="outline"
        className="h-10 px-4 text-text-secondary"
        disabled={!activeFilters.some((filter) => filter.value.length > 0)}
        onClick={reset}
      >
        {resetLabel}
      </Button>
    </div>
  );
}
