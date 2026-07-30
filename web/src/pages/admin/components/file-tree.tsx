import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

export type AdminFileTreeRow = {
  resource: AdminService.ManagedResourceItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  workspaceRoot: boolean;
};

type FileTreeSort = {
  key: string;
  direction: 'asc' | 'desc';
};

type BuildFileTreeOptions = {
  sort: FileTreeSort;
  expandedIds: Set<string>;
  matches?: (resource: AdminService.ManagedResourceItem) => boolean;
  expandMatches?: boolean;
};

function compareResources(
  left: AdminService.ManagedResourceItem,
  right: AdminService.ManagedResourceItem,
  sort: FileTreeSort,
) {
  const leftValue = left[sort.key as keyof AdminService.ManagedResourceItem];
  const rightValue = right[sort.key as keyof AdminService.ManagedResourceItem];
  const result = String(leftValue ?? '').localeCompare(
    String(rightValue ?? ''),
    undefined,
    { numeric: true },
  );
  return sort.direction === 'asc' ? result : -result;
}

export function buildAdminFileTreeRows(
  resources: AdminService.ManagedResourceItem[],
  {
    sort,
    expandedIds,
    matches = () => true,
    expandMatches = false,
  }: BuildFileTreeOptions,
): AdminFileTreeRow[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const childrenByParent = new Map<
    string,
    AdminService.ManagedResourceItem[]
  >();
  const roots: AdminService.ManagedResourceItem[] = [];

  resources.forEach((resource) => {
    const parent = resource.parent_id
      ? byId.get(resource.parent_id)
      : undefined;
    if (
      !parent ||
      parent.id === resource.id ||
      parent.workspace_id !== resource.workspace_id
    ) {
      roots.push(resource);
      return;
    }
    const siblings = childrenByParent.get(parent.id) ?? [];
    siblings.push(resource);
    childrenByParent.set(parent.id, siblings);
  });

  const visibleIds = new Set<string>();
  const markVisible = (
    resource: AdminService.ManagedResourceItem,
    visiting: Set<string>,
  ): boolean => {
    if (visiting.has(resource.id)) return false;
    const nextVisiting = new Set(visiting).add(resource.id);
    let hasVisibleChild = false;
    (childrenByParent.get(resource.id) ?? []).forEach((child) => {
      if (markVisible(child, nextVisiting)) hasVisibleChild = true;
    });
    const visible = matches(resource) || hasVisibleChild;
    if (visible) visibleIds.add(resource.id);
    return visible;
  };

  roots.forEach((root) => markVisible(root, new Set()));

  const rows: AdminFileTreeRow[] = [];
  const append = (
    resource: AdminService.ManagedResourceItem,
    depth: number,
    visited: Set<string>,
  ) => {
    if (visited.has(resource.id) || !visibleIds.has(resource.id)) return;
    const nextVisited = new Set(visited).add(resource.id);
    const children = (childrenByParent.get(resource.id) ?? [])
      .filter((child) => visibleIds.has(child.id))
      .sort((left, right) => compareResources(left, right, sort));
    const expanded = expandMatches || expandedIds.has(resource.id);
    rows.push({
      resource,
      depth,
      hasChildren: children.length > 0,
      expanded,
      workspaceRoot: resource.parent_id === resource.id,
    });
    if (expanded) {
      children.forEach((child) => append(child, depth + 1, nextVisited));
    }
  };

  roots
    .filter((root) => visibleIds.has(root.id))
    .sort((left, right) => compareResources(left, right, sort))
    .forEach((root) => append(root, 0, new Set()));
  return rows;
}

export function getExpandableAdminFileIds(
  resources: AdminService.ManagedResourceItem[],
) {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return new Set(
    resources.flatMap((resource) => {
      if (!resource.parent_id || resource.parent_id === resource.id) return [];
      const parent = byId.get(resource.parent_id);
      return parent && parent.workspace_id === resource.workspace_id
        ? [parent.id]
        : [];
    }),
  );
}

export function AdminFileTreeName({
  row: { resource, depth, hasChildren, expanded, workspaceRoot },
  onToggle,
}: {
  row: AdminFileTreeRow;
  onToggle: (resourceId: string) => void;
}) {
  const { t } = useTranslation();
  const displayName = workspaceRoot
    ? `${t(
        resource.workspace_type === 'team'
          ? 'admin.teamWorkspace'
          : 'admin.personalWorkspace',
      )}-${resource.workspace_name}`
    : resource.name || t('admin.unnamedResource');

  return (
    <div
      className="flex min-w-56 items-center gap-2"
      style={{ paddingLeft: depth * 20 }}
    >
      {hasChildren ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          aria-label={t(
            expanded
              ? 'admin.resourceManagementPage.collapseFolder'
              : 'admin.resourceManagementPage.expandFolder',
            { name: displayName },
          )}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onToggle(resource.id);
          }}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      {resource.file_type === 'folder' ? (
        expanded ? (
          <FolderOpen className="size-4 shrink-0 text-text-secondary" />
        ) : (
          <Folder className="size-4 shrink-0 text-text-secondary" />
        )
      ) : (
        <FileText className="size-4 shrink-0 text-text-secondary" />
      )}
      <div className="min-w-0">
        <div className="truncate font-medium">{displayName}</div>
        <div className="max-w-48 truncate text-xs text-text-secondary">
          {resource.id}
        </div>
      </div>
    </div>
  );
}
