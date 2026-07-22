import { DelimiterFormField } from '@/components/delimiter-form-field';
import { MaxTokenNumberFormField } from '@/components/max-token-number-from-field';
import { ConfigurationFormContainer } from '../configuration-form-container';

export function CustomChunkConfiguration() {
  return (
    <ConfigurationFormContainer>
      <MaxTokenNumberFormField initialValue={128} />
      <DelimiterFormField />
    </ConfigurationFormContainer>
  );
}
