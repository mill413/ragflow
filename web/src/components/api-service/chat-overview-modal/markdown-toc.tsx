import React, { useEffect, useState } from 'react';
import Anchor, { AnchorItem } from './anchor';

interface MarkdownTocProps {
  content: string;
  containerId: string;
}

const MarkdownToc: React.FC<MarkdownTocProps> = ({ content, containerId }) => {
  const [items, setItems] = useState<AnchorItem[]>([]);

  useEffect(() => {
    let frameId = 0;
    let cancelled = false;

    const generateTocItems = () => {
      if (cancelled) return;
      const container = document.getElementById(containerId);
      const headings = container?.querySelectorAll(
        '.wmde-markdown h2, .wmde-markdown h3',
      );

      // If headings haven't rendered yet, wait for next frame
      if (!headings?.length) {
        frameId = requestAnimationFrame(generateTocItems);
        return;
      }

      const tocItems: AnchorItem[] = [];
      let currentH2Item: AnchorItem | null = null;

      headings.forEach((heading) => {
        const title = heading.textContent || '';
        const id = heading.id;
        const isH2 = heading.tagName.toLowerCase() === 'h2';

        if (id && title) {
          const item: AnchorItem = {
            key: id,
            href: `#${id}`,
            title,
          };

          if (isH2) {
            currentH2Item = item;
            tocItems.push(item);
          } else {
            if (currentH2Item) {
              if (!currentH2Item.children) {
                currentH2Item.children = [];
              }
              currentH2Item.children.push(item);
            } else {
              tocItems.push(item);
            }
          }
        }
      });

      setItems(tocItems);
    };

    // Use requestAnimationFrame to ensure execution after DOM rendering
    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(generateTocItems);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [containerId, content]);

  return (
    <aside className="markdown-toc max-h-64 w-full shrink-0 overflow-y-auto rounded-md border border-border bg-bg-base p-3 text-text-primary xl:max-h-none xl:w-64">
      <Anchor items={items} />
    </aside>
  );
};

export default MarkdownToc;
