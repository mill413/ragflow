import { useIsDarkTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { useSetModalState, useTranslate } from '@/hooks/common-hooks';
import apiDoc from '@parent/docs/references/http_api_reference.md?raw';
import MarkdownPreview from '@uiw/react-markdown-preview';
import ChatApiKeyModal from '../chat-api-key-modal';
import BackendServiceApi from './backend-service-api';
import { convertMarkdownAdmonitions } from './markdown-admonition';
import MarkdownToc from './markdown-toc';

const apiDocContent = convertMarkdownAdmonitions(
  apiDoc.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
);

const ApiContent = ({ id, idKey }: { id?: string; idKey: string }) => {
  const { t } = useTranslate('setting');

  const {
    visible: apiKeyVisible,
    hideModal: hideApiKeyModal,
    showModal: showApiKeyModal,
  } = useSetModalState();

  const {
    visible: tocVisible,
    hideModal: hideToc,
    showModal: showToc,
  } = useSetModalState();

  const isDarkTheme = useIsDarkTheme();

  return (
    <div className="flex flex-col w-full">
      <BackendServiceApi show={showApiKeyModal} />

      <div className="text-left py-4">
        <Button onClick={tocVisible ? hideToc : showToc}>
          {tocVisible ? t('hideToc') : t('showToc')}
        </Button>
      </div>
      <section className="flex flex-col gap-4 pb-5 flex-1 min-h-0 overflow-hidden mb-4 xl:flex-row">
        <div
          id="api-reference-content"
          className="min-w-0 flex-1 overflow-auto rounded-md"
        >
          <MarkdownPreview
            source={apiDocContent}
            wrapperElement={{
              'data-color-mode': isDarkTheme ? 'dark' : 'light',
            }}
          />
        </div>
        {tocVisible && (
          <MarkdownToc
            content={apiDocContent}
            containerId="api-reference-content"
          />
        )}
      </section>
      {apiKeyVisible && (
        <ChatApiKeyModal
          hideModal={hideApiKeyModal}
          dialogId={id}
          idKey={idKey}
        ></ChatApiKeyModal>
      )}
    </div>
  );
};

export default ApiContent;
