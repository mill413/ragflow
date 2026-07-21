const admonitionTypes = {
  caution: { icon: '⚠️', title: '注意' },
  danger: { icon: '⛔', title: '警告' },
  info: { icon: 'ℹ️', title: '重要' },
  note: { icon: '📝', title: '说明' },
  tip: { icon: '💡', title: '提示' },
} as const;

const admonitionTitles: Record<string, string> = {
  DEPRECATED: '已废弃',
  IMPORTANT: '重要',
  NOTE: '说明',
  WARNING: '警告',
};

type AdmonitionType = keyof typeof admonitionTypes;

const openingPattern = /^:::(caution|danger|info|note|tip)(?:\s+(.+?))?\s*$/;

/**
 * Convert Docusaurus admonitions into portable Markdown blockquotes.
 * MarkdownPreview does not understand the `:::type` extension directly.
 */
export function convertMarkdownAdmonitions(markdown: string) {
  const lines = markdown.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(openingPattern);
    if (!opening) {
      output.push(lines[index]);
      continue;
    }

    const closingIndex = lines.indexOf(':::', index + 1);
    if (closingIndex < 0) {
      output.push(...lines.slice(index));
      break;
    }

    const type = opening[1] as AdmonitionType;
    const config = admonitionTypes[type];
    const sourceTitle = opening[2]?.trim();
    const title = sourceTitle
      ? (admonitionTitles[sourceTitle.toUpperCase()] ?? sourceTitle)
      : config.title;

    output.push(`> **${config.icon} ${title}**`, '>');
    for (const line of lines.slice(index + 1, closingIndex)) {
      output.push(line ? `> ${line}` : '>');
    }

    index = closingIndex;
  }

  return output.join('\n');
}
