function mockRehypeRaw() {}
function mockRehypeSanitize() {}
function mockRehypeKatex() {}

jest.mock('hast-util-sanitize', () => ({
  defaultSchema: {
    tagNames: ['b', 'img'],
    attributes: { '*': [] },
    protocols: { src: ['http', 'https'] },
  },
}));
jest.mock('rehype-sanitize', () => ({
  __esModule: true,
  default: mockRehypeSanitize,
}));
jest.mock('rehype-raw', () => ({ __esModule: true, default: mockRehypeRaw }));
jest.mock('rehype-katex', () => ({
  __esModule: true,
  default: mockRehypeKatex,
}));
jest.mock('@/constants/markdown-remark-plugins', () => ({
  MarkdownRemarkPlugins: [],
}));
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('react-syntax-highlighter', () => ({ Prism: jest.fn() }));
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
  oneLight: {},
}));
jest.mock('../../theme-provider', () => ({
  useIsDarkTheme: () => false,
}));

import { MarkdownSanitizeSchema } from '@/constants/markdown-rehype-plugins';
import { HighLightMarkdownRehypePlugins } from '..';

describe('HighLightMarkdown security pipeline', () => {
  it('sanitizes the parsed tree between raw HTML parsing and KaTeX', () => {
    const sanitizePlugin = HighLightMarkdownRehypePlugins[1] as [
      unknown,
      unknown,
    ];
    expect(HighLightMarkdownRehypePlugins[0]).toBe(mockRehypeRaw);
    expect(sanitizePlugin[0]).toBe(mockRehypeSanitize);
    expect(HighLightMarkdownRehypePlugins[2]).toBe(mockRehypeKatex);
  });

  it('retains assistant wrappers and safe inline images in the allow-list', () => {
    expect(MarkdownSanitizeSchema.tagNames).toEqual(
      expect.arrayContaining(['think', 'retrieving', 'section', 'details']),
    );
    expect(MarkdownSanitizeSchema.protocols.src).toContain('data');
    expect(MarkdownSanitizeSchema.tagNames).not.toContain('script');
  });
});
