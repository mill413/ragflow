import agentsIcon from '@/assets/svg/home-icon/agents.svg';
import chatsIcon from '@/assets/svg/home-icon/chats.svg';
import memoryIcon from '@/assets/svg/home-icon/memory.svg';
import searchesIcon from '@/assets/svg/home-icon/searches.svg';
import { MarkdownRemarkPluginsLite } from '@/constants/markdown-remark-plugins';
import { PageContainer } from '@/layouts/components/page-container';
import { cn } from '@/lib/utils';
import {
  LucideArrowRight,
  LucideBot,
  LucideFolderUp,
  LucideMessageSquareText,
  LucideSettings2,
  LucideUsersRound,
  type LucideIcon,
} from 'lucide-react';
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type UIEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import englishGuide from './content/en.md?raw';
import chineseGuide from './content/zh.md?raw';

type GuideHeading = {
  id: string;
  title: string;
};

const headingPattern = /^##\s+(.+?)\s+\{#([a-z0-9-]+)\}\s*$/gm;

const parseGuide = (source: string) => {
  const headings: GuideHeading[] = [];
  const content = source.replace(headingPattern, (_, title, id) => {
    headings.push({ id, title });
    return `## ${title}`;
  });
  return { content, headings };
};

const getNodeText = (children: ReactNode): string =>
  Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getNodeText(child.props.children);
      }
      return '';
    })
    .join('');

const flowIcons: Record<string, LucideIcon> = {
  workspace: LucideUsersRound,
  model: LucideSettings2,
  knowledge: LucideFolderUp,
  application: LucideBot,
  use: LucideMessageSquareText,
};

const applicationIcons: Record<string, string> = {
  chat: chatsIcon,
  search: searchesIcon,
  agent: agentsIcon,
  memory: memoryIcon,
};

const parseExtensionRows = (source: string) =>
  source
    .trim()
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length >= 3);

function FlowDiagram({ source }: { source: string }) {
  const rows = parseExtensionRows(source);
  return (
    <div className="not-prose my-6 flex flex-col items-stretch gap-3 rounded-2xl border border-border-button bg-bg-input p-5 md:flex-row md:items-center">
      {rows.map(([iconName, title, description], index) => {
        const Icon = flowIcons[iconName] ?? LucideArrowRight;
        return (
          <div key={`${iconName}-${title}`} className="contents">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border-button bg-bg-base p-4 md:block">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-card text-accent-primary md:mb-3">
                <Icon className="size-5" />
              </div>
              <div>
                <div className="font-medium text-text-primary">{title}</div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">
                  {description}
                </div>
              </div>
            </div>
            {index < rows.length - 1 && (
              <LucideArrowRight className="hidden size-5 shrink-0 text-text-secondary md:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ApplicationGrid({ source }: { source: string }) {
  const rows = parseExtensionRows(source);
  return (
    <div className="not-prose my-6 grid gap-4 sm:grid-cols-2">
      {rows.map(([iconName, title, description, route]) => (
        <div
          key={`${iconName}-${title}`}
          className="rounded-xl border border-border-button bg-bg-base p-5 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <img
              src={applicationIcons[iconName]}
              alt=""
              className="size-12 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {description}
              </p>
              {route && (
                <Link
                  to={route}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-primary hover:underline"
                >
                  {route.startsWith('/user-setting') ? title : `${title} →`}
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExtendedCode({
  children,
  className,
}: ComponentPropsWithoutRef<'code'>) {
  const source = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '');
  if (language === 'help-flow') return <FlowDiagram source={source} />;
  if (language === 'help-apps') return <ApplicationGrid source={source} />;
  return (
    <code
      className={cn(
        className,
        'rounded bg-bg-card px-1.5 py-0.5 text-sm text-text-primary',
      )}
    >
      {children}
    </code>
  );
}

function Help() {
  const { i18n } = useTranslation();
  const guide = useMemo(
    () =>
      parseGuide(i18n.language?.startsWith('zh') ? chineseGuide : englishGuide),
    [i18n.language],
  );
  const [activeHeading, setActiveHeading] = useState(
    guide.headings[0]?.id ?? '',
  );

  useEffect(() => {
    setActiveHeading(guide.headings[0]?.id ?? '');
  }, [guide]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const threshold = event.currentTarget.getBoundingClientRect().top + 96;
    const current = guide.headings.reduce<HTMLElement | null>(
      (active, { id }) => {
        const heading = document.getElementById(id);
        return heading && heading.getBoundingClientRect().top <= threshold
          ? heading
          : active;
      },
      null,
    );
    setActiveHeading(current?.id ?? guide.headings[0]?.id ?? '');
  };

  const headingIds = useMemo(
    () => new Map(guide.headings.map(({ id, title }) => [title, id])),
    [guide.headings],
  );

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="mb-5 bg-gradient-to-r from-[#4a51ff] to-[#20b8b0] bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-5xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => {
      const title = getNodeText(children);
      return (
        <h2
          id={headingIds.get(title)}
          className="mb-4 mt-14 scroll-mt-6 border-b border-border-button pb-3 text-2xl font-semibold text-text-primary first:mt-0"
        >
          {children}
        </h2>
      );
    },
    h3: ({ children }) => (
      <h3 className="mb-2 mt-7 text-lg font-semibold text-text-primary">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-3 text-sm leading-7 text-text-secondary md:text-base">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="my-4 list-disc space-y-2 ps-6 text-text-secondary">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 ps-6 text-text-secondary">
        {children}
      </ol>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-text-primary">{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-5 rounded-xl border-s-4 border-accent-primary bg-accent-primary/5 px-5 py-3 text-text-secondary">
        {children}
      </blockquote>
    ),
    a: ({ children, href }) =>
      href?.startsWith('/') ? (
        <Link
          to={href}
          className="font-medium text-accent-primary hover:underline"
        >
          {children}
        </Link>
      ) : (
        <a
          href={href}
          className="font-medium text-accent-primary hover:underline"
          rel="noreferrer noopener"
          target="_blank"
        >
          {children}
        </a>
      ),
    img: ({ alt, src }) => (
      <span className="my-6 block overflow-hidden rounded-xl border border-border-button bg-bg-base shadow-sm">
        <img src={src} alt={alt ?? ''} className="block w-full" />
        {alt && (
          <span className="block border-t border-border-button px-4 py-2 text-center text-xs text-text-secondary">
            {alt}
          </span>
        )}
      </span>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-border-button">
        <table className="w-full min-w-[680px] text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-bg-card text-text-secondary">{children}</thead>
    ),
    th: ({ children }) => <th className="px-5 py-3 font-medium">{children}</th>,
    td: ({ children }) => (
      <td className="border-t border-border-button px-5 py-4 text-text-secondary">
        {children}
      </td>
    ),
    code: ExtendedCode,
    pre: ({ children }) => <>{children}</>,
  };

  const contentsLabel = i18n.language?.startsWith('zh') ? '目录' : 'Contents';

  return (
    <PageContainer
      className="bg-bg-card"
      data-help-scroll-container
      onScroll={handleScroll}
    >
      <div className="mx-auto max-w-7xl pb-16">
        <div className="mb-6 overflow-x-auto rounded-xl border border-border-button bg-bg-base p-2 lg:hidden">
          <nav className="flex min-w-max gap-1" aria-label={contentsLabel}>
            {guide.headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={() => setActiveHeading(heading.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  activeHeading === heading.id
                    ? 'bg-accent-primary/10 font-medium text-accent-primary'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary',
                )}
              >
                {heading.title}
              </a>
            ))}
          </nav>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav
              className="sticky top-4 rounded-xl border border-border-button bg-bg-base p-3"
              aria-label={contentsLabel}
            >
              <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {contentsLabel}
              </div>
              {guide.headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={() => setActiveHeading(heading.id)}
                  aria-current={
                    activeHeading === heading.id ? 'location' : undefined
                  }
                  className={cn(
                    'my-0.5 block rounded-r-lg border-s-2 px-3 py-2 text-sm transition-colors',
                    activeHeading === heading.id
                      ? 'border-accent-primary bg-accent-primary/10 font-medium text-accent-primary'
                      : 'border-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary',
                  )}
                >
                  {heading.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 rounded-2xl border border-border-button bg-bg-base px-5 py-8 shadow-sm md:px-9 md:py-10">
            <ReactMarkdown
              remarkPlugins={MarkdownRemarkPluginsLite}
              components={components}
            >
              {guide.content}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </PageContainer>
  );
}

export default Help;
