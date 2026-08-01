import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import 'swagger-ui-react/swagger-ui.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAdminOpenApi } from '@/services/admin-service';
import { getAdminAuthorization } from '@/utils/authorization-util';

import LocalizedSwaggerUI from './components/localized-swagger-ui';
import { buildMainOpenApiSpec } from './utils/main-openapi';

export default function AdminApiDocs() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin/openapi'],
    queryFn: getAdminOpenApi,
  });
  const {
    data: mainOpenApi,
    isLoading: isMainLoading,
    isError: isMainError,
  } = useQuery({
    queryKey: ['main/openapi', 'admin-selected-resources'],
    queryFn: async () => {
      const response = await fetch('/api/v1/system/openapi.json');
      if (!response.ok) throw new Error('Failed to load main OpenAPI');
      return response.json();
    },
  });

  const selectedMainOpenApi = useMemo(
    () =>
      mainOpenApi
        ? buildMainOpenApiSpec(mainOpenApi, {
            title: t('admin.apiDocsPage.mainTitle'),
            description: t('admin.apiDocsPage.mainDescription'),
            team: t('admin.apiDocsPage.groups.team'),
            dataset: t('admin.apiDocsPage.groups.dataset'),
            chat: t('admin.apiDocsPage.groups.chat'),
            search: t('admin.apiDocsPage.groups.search'),
          })
        : undefined,
    [mainOpenApi, t],
  );

  const attachAdminAuthorization = useCallback((swaggerRequest: any) => {
    const authorization = getAdminAuthorization();
    if (authorization && !swaggerRequest.headers.Authorization) {
      swaggerRequest.headers.Authorization = authorization;
    }
    return swaggerRequest;
  }, []);

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>{t('admin.apiDocsPage.title')}</CardTitle>
        <p className="text-sm text-text-secondary">
          {t('admin.apiDocsPage.description')}
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <Tabs defaultValue="admin" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="m-4 mb-2 w-fit shrink-0">
            <TabsTrigger value="admin">
              {t('admin.apiDocsPage.adminTab')}
            </TabsTrigger>
            <TabsTrigger value="main">
              {t('admin.apiDocsPage.mainTab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="admin"
            className="min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
          >
            {isLoading && (
              <div className="p-6 text-sm text-text-secondary">
                {t('common.loading')}
              </div>
            )}
            {isError && (
              <div className="p-6 text-sm text-state-error">
                {t('admin.apiDocsPage.loadFailed')}
              </div>
            )}
            {data?.data && (
              <div className="admin-swagger min-w-[760px] bg-white px-4 py-2 text-black">
                <LocalizedSwaggerUI
                  authorizationScheme="adminBearer"
                  spec={data.data}
                  docExpansion="list"
                  defaultModelsExpandDepth={-1}
                  displayRequestDuration
                  persistAuthorization
                  requestInterceptor={attachAdminAuthorization}
                  tryItOutEnabled
                />
              </div>
            )}
          </TabsContent>
          <TabsContent
            value="main"
            className="min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
          >
            {isMainLoading && (
              <div className="p-6 text-sm text-text-secondary">
                {t('common.loading')}
              </div>
            )}
            {isMainError && (
              <div className="p-6 text-sm text-state-error">
                {t('admin.apiDocsPage.mainLoadFailed')}
              </div>
            )}
            {selectedMainOpenApi && (
              <div className="admin-swagger min-w-[760px] bg-white px-4 py-2 text-black">
                <LocalizedSwaggerUI
                  authorizationScheme="BearerAuth"
                  spec={selectedMainOpenApi}
                  docExpansion="list"
                  defaultModelsExpandDepth={-1}
                  displayRequestDuration
                  persistAuthorization
                  requestInterceptor={attachAdminAuthorization}
                  tryItOutEnabled
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
