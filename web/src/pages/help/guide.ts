export type GuideHeading = {
  id: string;
  level: 2 | 3;
  title: string;
};

const headingPattern = /^(#{2,3})\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/gm;

const slugifyHeading = (title: string) =>
  title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '');

export const parseGuide = (source: string) => {
  const headings: GuideHeading[] = [];
  const usedIds = new Set<string>();
  let parentId = 'section';

  const createUniqueId = (baseId: string) => {
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id;
  };

  const content = source.replace(
    headingPattern,
    (_, markers: string, title: string, explicitId?: string) => {
      const level = markers.length as GuideHeading['level'];
      const slug = slugifyHeading(title) || 'section';
      const id = createUniqueId(
        explicitId ?? (level === 2 ? slug : `${parentId}-${slug}`),
      );

      if (level === 2) parentId = id;
      headings.push({ id, level, title });
      return `${markers} ${title}`;
    },
  );

  return { content, headings };
};
