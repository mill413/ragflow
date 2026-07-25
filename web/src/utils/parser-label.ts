import { TFunction } from 'i18next';

export function getParserLabel(t: TFunction, parserId?: string) {
  if (!parserId) {
    return '';
  }

  const translationKey = `knowledgeConfiguration.parserLabel.${parserId}`;
  const translatedLabel = t(translationKey);
  return translatedLabel === translationKey ? parserId : translatedLabel;
}
