import { convertMarkdownAdmonitions } from '../markdown-admonition';

describe('convertMarkdownAdmonitions', () => {
  it('converts a titled caution block', () => {
    expect(
      convertMarkdownAdmonitions(`:::caution DEPRECATED
Deprecated endpoint.
:::`),
    ).toBe(`> **⚠️ 已废弃**
>
> Deprecated endpoint.`);
  });

  it('preserves lists and fenced code inside the blockquote', () => {
    expect(
      convertMarkdownAdmonitions(`:::tip NOTE

- First item

\`\`\`json
{"code": 0}
\`\`\`
:::`),
    ).toBe(`> **💡 说明**
>
>
> - First item
>
> \`\`\`json
> {"code": 0}
> \`\`\``);
  });

  it('keeps an unclosed admonition unchanged', () => {
    const markdown = `Before
:::info IMPORTANT
Content`;

    expect(convertMarkdownAdmonitions(markdown)).toBe(markdown);
  });
});
