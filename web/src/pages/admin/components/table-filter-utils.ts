import type { MultiSelectOptionType } from '@/components/ui/multi-select';

export function createFilterOptions<T>(
  rows: T[],
  getValue: (row: T) => string | null | undefined,
  getLabel: (value: string) => string = (value) => value,
): MultiSelectOptionType[] {
  return Array.from(
    new Set(rows.map(getValue).filter((value): value is string => !!value)),
  )
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
    .map((value) => ({ value, label: getLabel(value) }));
}

export function matchesSelectedFilter(
  value: string | null | undefined,
  selectedValues: string[],
) {
  return !selectedValues.length || selectedValues.includes(value ?? '');
}
