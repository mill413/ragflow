import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import SwaggerUI from 'swagger-ui-react';

import { authorizeSwaggerSession } from '../utils/swagger-authorization';
import { localizeSwaggerUi } from '../utils/swagger-ui-localization';

type LocalizedSwaggerUIProps = {
  authorizationScheme: string;
  spec: object;
  docExpansion?: 'list' | 'full' | 'none';
  defaultModelsExpandDepth?: number;
  displayRequestDuration?: boolean;
  persistAuthorization?: boolean;
  requestInterceptor?: (request: any) => any;
  tryItOutEnabled?: boolean;
  onComplete?: (system: any) => void;
};

export default function LocalizedSwaggerUI({
  authorizationScheme,
  onComplete,
  ...props
}: LocalizedSwaggerUIProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const useChinese = language.toLowerCase().startsWith('zh');

  const handleComplete = useCallback(
    (system: any) => {
      authorizeSwaggerSession(system, authorizationScheme);
      onComplete?.(system);
    },
    [authorizationScheme, onComplete],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !useChinese) return;

    localizeSwaggerUi(root);
    const observer = new MutationObserver(() => localizeSwaggerUi(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [useChinese]);

  return (
    <div ref={rootRef}>
      <SwaggerUI key={language} {...props} onComplete={handleComplete} />
    </div>
  );
}
