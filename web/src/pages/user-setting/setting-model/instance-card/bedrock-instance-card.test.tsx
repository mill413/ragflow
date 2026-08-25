/*
 *  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { BedrockInstanceCard } from './bedrock-instance-card';

const mockReactRuntime = React;
(globalThis as any).React = mockReactRuntime;

const mockCatalogCredentials = jest.fn();
const mockAddProviderInstance = jest.fn();
const mockFetchProviderInstance = jest.fn();
const mockRefetchProviderInstance = jest.fn();
type MockModelInfo = {
  model_name: string;
  model_type: string[];
  max_tokens: number;
};
let mockDiscoveredModels: MockModelInfo[];
let mockInstanceModelsLoaded: boolean;
const savedInstanceDetails = {
  id: 'instance-id',
  instance_name: 'saved-instance',
  provider_id: 'provider-id',
  region: 'us-east-1',
  status: 'active',
  api_key: JSON.stringify({
    auth_mode: 'bedrock_api_key',
    bedrock_api_key: 'old-key',
    bedrock_region: 'us-east-1',
  }),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/common-hooks', () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/logic-hooks/use-build-options', () => ({
  useBuildModelTypeOptions: () => ({ buildModelTypeOptions: jest.fn() }),
}));

jest.mock('@/hooks/use-llm-request', () => {
  return {
    useAddProviderInstance: () => ({
      addProviderInstance: mockAddProviderInstance,
    }),
    useDeleteProviderInstance: () => ({ deleteProviderInstance: jest.fn() }),
    useFetchProviderInstance: (...args: unknown[]) =>
      mockFetchProviderInstance(...args),
    useVerifyProviderConnection: () => ({
      verifyProviderConnection: jest.fn(),
    }),
  };
});

jest.mock('@/components/confirm-delete-dialog', () => ({
  ConfirmDeleteDialog: ({ children }: any) => children,
}));

jest.mock('@/components/ui/button', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Button: ({ children, ...props }: any) =>
      ReactActual.createElement('button', props, children),
  };
});

jest.mock('@/components/originui/select-with-search', () => ({
  SelectWithSearch: () => null,
}));

jest.mock('@/components/ui/multi-select', () => ({ MultiSelect: () => null }));
jest.mock('@/components/ui/segmented', () => ({
  Segmented: ({ onChange }: { onChange: (value: string) => void }) => (
    <>
      <button type="button" onClick={() => onChange('access_key_secret')}>
        accessKey
      </button>
      <button type="button" onClick={() => onChange('bedrock_api_key')}>
        apiKey
      </button>
    </>
  ),
}));

jest.mock('./models-section', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ModelsSection: (props: {
      getFormValues: () => Record<string, unknown>;
      verifyTransform: (values: Record<string, unknown>) => unknown;
      onInstanceModelsChange?: (models: MockModelInfo[]) => void;
      onInstanceModelsEdited?: () => void;
      onInstanceModelsStatusChange?: (ready: boolean) => void;
      instanceDetailsLoaded?: boolean;
    }) => {
      React.useEffect(() => {
        if (props.instanceDetailsLoaded === false) return;
        mockCatalogCredentials(props.verifyTransform(props.getFormValues()));
        props.onInstanceModelsChange?.(mockDiscoveredModels);
        if (mockInstanceModelsLoaded) {
          props.onInstanceModelsEdited?.();
        }
        // ModelsSection resolves credentials from its mount effect.
      }, [props.instanceDetailsLoaded]);
      React.useEffect(() => {
        props.onInstanceModelsStatusChange?.(mockInstanceModelsLoaded);
      });
      return null;
    },
  };
});
jest.mock('./verify-button', () => ({ __esModule: true, default: () => null }));

describe('BedrockInstanceCard', () => {
  beforeEach(() => {
    expect(mockReactRuntime).toBeDefined();
    mockCatalogCredentials.mockReset();
    mockAddProviderInstance.mockReset().mockResolvedValue({ code: 0 });
    mockFetchProviderInstance
      .mockReset()
      .mockImplementation((providerName) => ({
        data: providerName ? savedInstanceDetails : undefined,
        refetch: mockRefetchProviderInstance,
      }));
    mockRefetchProviderInstance.mockReset();
    mockInstanceModelsLoaded = true;
    mockDiscoveredModels = [
      {
        model_name: 'amazon.nova-lite-v1:0',
        model_type: ['chat', 'vision'],
        max_tokens: 8192,
      },
    ];
  });

  it('creates an API key instance without manual model fields', async () => {
    const onSaved = jest.fn();
    render(
      <BedrockInstanceCard
        providerName="Bedrock"
        isDraft
        onSaved={onSaved}
        instance={{
          id: '',
          instance_name: '',
          provider_id: 'provider-id',
          region: 'us-east-1',
          status: 'active',
          api_key: '',
        }}
      />,
    );

    expect(screen.getByText('modelType')).toBeTruthy();
    expect(screen.getByPlaceholderText('bedrockModelNameMessage')).toBeTruthy();
    expect(screen.getByPlaceholderText('maxTokensTip')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'apiKey' }));

    expect(screen.queryByText('modelType')).toBeNull();
    expect(screen.queryByPlaceholderText('bedrockModelNameMessage')).toBeNull();
    expect(screen.queryByPlaceholderText('maxTokensTip')).toBeNull();

    fireEvent.change(screen.getByTestId('instance-name-input'), {
      target: { value: 'api-key-instance' },
    });
    fireEvent.change(screen.getByPlaceholderText('apiKeyMessage'), {
      target: { value: 'new-key' },
    });

    await waitFor(() => expect(mockCatalogCredentials).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('instance-name-save'));

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
        instance_name: 'api-key-instance',
        llm_factory: 'Bedrock',
        api_key: {
          auth_mode: 'bedrock_api_key',
          bedrock_api_key: 'new-key',
          bedrock_region: 'us-east-1',
        },
          model_info: mockDiscoveredModels,
        }),
      ),
    );
    expect(onSaved.mock.calls[0][0]).not.toHaveProperty('max_tokens');
  });

  it('requires a discovered model before saving an API key instance', async () => {
    mockDiscoveredModels = [];
    const onSaved = jest.fn();
    render(
      <BedrockInstanceCard
        providerName="Bedrock"
        isDraft
        onSaved={onSaved}
        instance={{
          id: '',
          instance_name: '',
          provider_id: 'provider-id',
          region: 'us-east-1',
          status: 'active',
          api_key: '',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'apiKey' }));
    fireEvent.change(screen.getByTestId('instance-name-input'), {
      target: { value: 'api-key-instance' },
    });
    fireEvent.change(screen.getByPlaceholderText('apiKeyMessage'), {
      target: { value: 'new-key' },
    });

    fireEvent.click(screen.getByTestId('instance-name-save'));
    await waitFor(() => expect(onSaved).not.toHaveBeenCalled());
  });

  it('restores saved credentials before model discovery starts', async () => {
    mockFetchProviderInstance.mockReturnValue({
      data: undefined,
      refetch: mockRefetchProviderInstance,
    });
    const { rerender } = render(
      <BedrockInstanceCard
        providerName="Bedrock"
        defaultOpen
        instance={{
          id: 'instance-id',
          instance_name: 'saved-instance',
          provider_id: 'provider-id',
          region: 'us-east-1',
          status: 'active',
          api_key: '',
        }}
      />,
    );

    expect(mockCatalogCredentials).not.toHaveBeenCalled();

    mockFetchProviderInstance.mockReturnValue({
      data: savedInstanceDetails,
      refetch: mockRefetchProviderInstance,
    });
    rerender(
      <BedrockInstanceCard
        providerName="Bedrock"
        defaultOpen
        instance={{
          id: 'instance-id',
          instance_name: 'saved-instance',
          provider_id: 'provider-id',
          region: 'us-east-1',
          status: 'active',
          api_key: '',
        }}
      />,
    );

    await waitFor(() =>
      expect(mockCatalogCredentials).toHaveBeenCalledWith({
        apiKey: {
          auth_mode: 'bedrock_api_key',
          bedrock_api_key: 'old-key',
          bedrock_region: 'us-east-1',
        },
        baseUrl: undefined,
        region: 'default',
      }),
    );
  });
});
