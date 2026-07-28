import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CopyToClipboardWithText } from '@/components/copy-to-clipboard';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchAppConf } from '@/hooks/logic-hooks';
import { LangfuseEntry } from '@/pages/user-setting/setting-model/langfuse';

const BackendServiceApi = ({ show }: { show(): void }) => {
  const { t } = useTranslate('chat');
  const { appName } = useFetchAppConf();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CardTitle>{appName} API</CardTitle>
            <Button onClick={show}>{t('apiKey')}</Button>
          </div>
          <LangfuseEntry />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <b className="font-semibold">{t('backendServiceApi')}</b>
          <CopyToClipboardWithText
            text={location.origin}
          ></CopyToClipboardWithText>
        </div>
      </CardContent>
    </Card>
  );
};

export default BackendServiceApi;
