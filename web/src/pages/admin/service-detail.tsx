import { isPlainObject } from 'lodash';
import { useMemo, useState } from 'react';

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

interface ServiceDetailProps {
  content?: any;
}

function ServiceDetail({ content }: ServiceDetailProps) {
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
      const rows = sort.key
        ? [...content].sort((left, right) => {
            const result = String(left[sort.key] ?? '').localeCompare(
              String(right[sort.key] ?? ''),
              undefined,
              { numeric: true },
            );
            return sort.direction === 'asc' ? result : -result;
          })
        : content;

      return (
        <Table rootClassName="min-w-max">
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSort((current) => ({
                        key: header,
                        direction:
                          current.key === header && current.direction === 'asc'
                            ? 'desc'
                            : 'asc',
                      }))
                    }
                  >
                    {header}
                    {getSortIcon(sort.key === header ? sort.direction : false)}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={(item.id as string) ?? index}>
                {headers.map((header: string) => (
                  <TableCell key={header}>{item[header] as string}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
  }, [content, sort]);

  return contentElement;
}

export default ServiceDetail;
