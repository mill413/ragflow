import { isPlainObject } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSortIcon } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';

interface ServiceDetailProps {
  content?: any;
}

function ServiceDetail({ content }: ServiceDetailProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: '', direction: 'asc' });
  const contentElement = useMemo(() => {
    if (
      Array.isArray(content) &&
      content.length > 0 &&
      content.every(isPlainObject)
    ) {
      const headers = Object.keys(content[0]);
      const numericHeaders = new Set(
        headers.filter((header) => {
          const values = content
            .map((row) => row[header])
            .filter((value) => value !== null && value !== undefined);
          return (
            values.length > 0 &&
            values.every((value) => typeof value === 'number')
          );
        }),
      );
      const filteredRows = content.filter((row) =>
        headers.every((header) =>
          matchesSelectedFilter(
            String(row[header] ?? ''),
            filters[header] ?? [],
          ),
        ),
      );
      const rows = sort.key
        ? [...filteredRows].sort((left, right) => {
            const result = String(left[sort.key] ?? '').localeCompare(
              String(right[sort.key] ?? ''),
              undefined,
              { numeric: true },
            );
            return sort.direction === 'asc' ? result : -result;
          })
        : filteredRows;

      return (
        <section className="space-y-4">
          <AdminTableMultiFilters
            filters={headers.map((header) => ({
              id: header,
              label: header,
              options: createFilterOptions(content, (row) =>
                String(row[header] ?? ''),
              ),
              value: filters[header] ?? [],
              onChange: (value) =>
                setFilters((current) => ({ ...current, [header]: value })),
            }))}
            resetLabel={t('admin.reset')}
            onReset={() => setFilters({})}
          />
          <Table rootClassName="max-w-full [contain:inline-size]">
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead
                    key={header}
                    className={
                      numericHeaders.has(header) ? 'text-center' : undefined
                    }
                  >
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSort((current) => ({
                          key: header,
                          direction:
                            current.key === header &&
                            current.direction === 'asc'
                              ? 'desc'
                              : 'asc',
                        }))
                      }
                    >
                      {header}
                      {getSortIcon(
                        sort.key === header ? sort.direction : false,
                      )}
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((item, index) => (
                <TableRow key={(item.id as string) ?? index}>
                  {headers.map((header: string) => (
                    <TableCell
                      key={header}
                      className={
                        numericHeaders.has(header) ? 'text-center' : undefined
                      }
                    >
                      {item[header] as string}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      );
    }

    if (isPlainObject(content)) {
      return (
        <dl className="text-sm text-text-primary grid grid-cols-[minmax(20%,auto),1fr] rounded-xl overflow-hidden bg-bg-card">
          {Object.entries<any>(content).map(([key, value]) => (
            <div
              key={key}
              className="contents [:not(:last-child)]>*]border-b-0.5 [:not(:last-child)>*]:border-border-button"
            >
              <dt className="px-4 py-2.5 bg-bg-card">
                <pre>
                  <code>{key}</code>
                </pre>
              </dt>
              <dd className="px-4 py-2.5">
                <pre>
                  <code>{JSON.stringify(value)}</code>
                </pre>
              </dd>
            </div>
          ))}
        </dl>
      );
    }

    if (typeof content === 'string') {
      return (
        <div className="rounded-xl p-4 bg-bg-card text-sm text-text-primary">
          <pre>
            <code>
              {typeof content === 'string'
                ? content
                : JSON.stringify(content, null, 2)}
            </code>
          </pre>
        </div>
      );
    }

    return content;
  }, [content, filters, sort, t]);

  return contentElement;
}

export default ServiceDetail;
