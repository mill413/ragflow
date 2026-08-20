export enum MessageType {
  Assistant = 'assistant',
  User = 'user',
}

export enum ChatVariableEnabledField {
  TemperatureEnabled = 'temperatureEnabled',
  TopPEnabled = 'topPEnabled',
  PresencePenaltyEnabled = 'presencePenaltyEnabled',
  FrequencyPenaltyEnabled = 'frequencyPenaltyEnabled',
  MaxTokensEnabled = 'maxTokensEnabled',
}

export const variableEnabledFieldMap = {
  [ChatVariableEnabledField.TemperatureEnabled]: 'temperature',
  [ChatVariableEnabledField.TopPEnabled]: 'top_p',
  [ChatVariableEnabledField.PresencePenaltyEnabled]: 'presence_penalty',
  [ChatVariableEnabledField.FrequencyPenaltyEnabled]: 'frequency_penalty',
  [ChatVariableEnabledField.MaxTokensEnabled]: 'max_tokens',
};

export enum SharedFrom {
  Agent = 'agent',
  Chat = 'chat',
  Search = 'search',
}

export enum ChatSearchParams {
  DialogId = 'dialogId',
  ConversationId = 'conversationId',
  isNew = 'isNew',
}

export const EmptyConversationId = 'empty';

export enum DatasetMetadata {
  Disabled = 'disabled',
  Automatic = 'auto',
  SemiAutomatic = 'semi_auto',
  Manual = 'manual',
}

export enum WebSearchProvider {
  Tavily = 'tavily',
  Querit = 'querit',
  Serply = 'serply',
  YouCom = 'youcom',
}

/**
 * Providers usable with no credentials at all. You.com serves a rate-limited
 * keyless endpoint; every other provider requires a key before it can be used.
 */
export const KEYLESS_WEB_SEARCH_PROVIDERS: readonly WebSearchProvider[] = [
  WebSearchProvider.YouCom,
];
