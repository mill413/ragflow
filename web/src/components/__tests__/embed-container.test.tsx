import { render } from '@testing-library/react';
import React from 'react';

import { EmbedContainer } from '../embed-container';

(globalThis as any).React = React;

jest.mock('@/hooks/logic-hooks', () => ({
  useFetchAppConf: () => ({
    appIconUrl: '/custom-logo.svg',
    appName: 'Custom RAG',
  }),
}));

jest.mock('../ragflow-avatar', () => ({
  RAGFlowAvatar: () => {
    const ReactLib = jest.requireActual('react');
    return ReactLib.createElement('div', { 'data-testid': 'assistant-avatar' });
  },
}));

jest.mock('../ui/button', () => ({
  Button: ({ children, ...props }: any) => {
    const ReactLib = jest.requireActual('react');
    return ReactLib.createElement('button', props, children);
  },
}));

describe('EmbedContainer', () => {
  it('constrains custom app icons in desktop and mobile headers', () => {
    const { container } = render(
      React.createElement(
        EmbedContainer,
        { title: 'Assistant' },
        React.createElement('div', null, 'Chat content'),
      ),
    );

    const appIcons = container.querySelectorAll(
      'img[src="/custom-logo.svg"]',
    );

    expect(appIcons).toHaveLength(2);
    expect(appIcons[0]).toHaveClass('size-8', 'shrink-0', 'object-contain');
    expect(appIcons[1]).toHaveClass('size-6', 'shrink-0', 'object-contain');
  });
});
