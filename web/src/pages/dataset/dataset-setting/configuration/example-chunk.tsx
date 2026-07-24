import { LayoutRecognizeFormField } from '@/components/layout-recognize-form-field';
import { ConfigurationFormContainer } from '../configuration-form-container';
import { useKnowledgeBaseContext } from '../../contexts/knowledge-base-context';

export function ExampleChunkConfiguration() {
  const ownerTenantId = useKnowledgeBaseContext().knowledgeBase?.tenant_id;

  return (
    <ConfigurationFormContainer>
      <LayoutRecognizeFormField
        ownerTenantId={ownerTenantId}
      ></LayoutRecognizeFormField>
    </ConfigurationFormContainer>
  );
}
