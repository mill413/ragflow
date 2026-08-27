import { defaultSchema } from 'hast-util-sanitize';
import rehypeSanitize from 'rehype-sanitize';
import type { PluggableList } from 'unified';

/**
 * Allow-list for assistant-rendered markdown.
 *
 * Raw HTML must be sanitized after rehype-raw parses it. Sanitizing the input
 * string alone is insufficient because preprocessLaTeX can decode HTML
 * entities before the markdown tree is built.
 */
export const MarkdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'think',
    'retrieving',
    'section',
    'details',
    'summary',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
  },
  protocols: {
    ...defaultSchema.protocols,
    // Inline assistant images may use data URLs. Script-capable tags are not
    // part of the allow-list.
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
  },
};

/** Keep this after rehype-raw and before rehype-katex. */
export const RehypeSanitizeAssistantMarkdown: PluggableList[number] = [
  rehypeSanitize,
  MarkdownSanitizeSchema,
];
