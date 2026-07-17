import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import { LucideSearch } from 'lucide-react';

import Spotlight from '@/components/spotlight';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listManagedResources } from '@/services/admin-service';

const RESOURCE_TYPES: AdminService.ManagedResourceType[] = [
  'dataset',
  'chat',
  'agent',
  'search',
  'memory',
];

export default function AdminResources() {
  const { t } = useTranslation();
  const [resourceType, setResourceType] =
    useState<AdminService.ManagedResourceType>('dataset');
  const [keywords, setKeywords] = useState('');
  const deferredKeywords = useDeferredValue(keywords);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isFetching } = useQuery({
    queryKey: [
      'admin/managedResources',
      resourceType,
      page,
      pageSize,
      deferredKeywords,
    ],
    queryFn: async () =>
      (
        await listManagedResources({
          type: resourceType,
          page,
          pageSize,
          keywords: deferredKeywords,
        })
      ).data.data,
  });

  const resources = data?.resources ?? [];

  return (
    <Card className="!shadow-none relative h-full flex flex-col border-0.5 border-border-button bg-transparent rounded-xl overflow-hidden">
      <Spotlight />

      <CardHeader className="space-y-5">
        <div className="flex items-center justify-between gap-6">
          <CardTitle>{t('admin.resourceManagement')}</CardTitle>
          <div className="relative w-72">
            <LucideSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              className="h-10 pl-9"
              value={keywords}
              onChange={(event) => {
                setKeywords(event.target.value);
                setPage(1);
              }}
              placeholder={t('admin.searchResources')}
            />
          </div>
        </div>

        <Tabs
          value={resourceType}
          onValueChange={(value) => {
            setResourceType(value as AdminService.ManagedResourceType);
            setPage(1);
          }}
        >
          <TabsList className="bg-transparent gap-2 p-0">
            {RESOURCE_TYPES.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="border-0.5 border-border-button data-[state=active]:bg-bg-card"
              >
                {t(`admin.resourceType.${type}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="h-0 basis-0 grow flex flex-col gap-4">
        <ScrollArea className="h-0 basis-0 grow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.name')}</TableHead>
                <TableHead>{t('admin.workspaceOwner')}</TableHead>
                <TableHead>{t('admin.creator')}</TableHead>
                <TableHead>{t('admin.createTime')}</TableHead>
                <TableHead>{t('admin.lastUpdateTime')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? 'opacity-60' : undefined}>
              {resources.length ? (
                resources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell className="font-medium">
                      {resource.name || t('admin.unnamedResource')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(
                          resource.workspace_type === 'team'
                            ? 'admin.teamWorkspace'
                            : 'admin.personalWorkspace',
                        )}
                        -{resource.workspace_name}
                      </Badge>
                    </TableCell>
                    <TableCell>{resource.creator_name || '-'}</TableCell>
                    <TableCell>{resource.create_date || '-'}</TableCell>
                    <TableCell>{resource.update_date || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-40 text-center text-text-secondary"
                  >
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <RAGFlowPagination
          total={data?.total ?? 0}
          current={page}
          pageSize={pageSize}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
        />
      </CardContent>
    </Card>
  );
}
