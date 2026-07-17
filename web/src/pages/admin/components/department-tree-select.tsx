import { useMemo } from 'react';

import { TreeSelect, TreeSelectNode } from '@/components/tree-select';

type DepartmentTreeSelectProps = {
  departments: AdminService.Department[];
  value?: string;
  onChange: (departmentId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
};

function buildDepartmentTree(
  departments: AdminService.Department[],
): TreeSelectNode[] {
  const nodes = new Map<string, TreeSelectNode>();
  departments.forEach((department) => {
    nodes.set(department.id, {
      id: department.id,
      title: department.name,
      children: [],
      data: { path: department.path, parentId: department.parent_id },
    });
  });

  const roots: TreeSelectNode[] = [];
  departments.forEach((department) => {
    const node = nodes.get(department.id)!;
    const parent = department.parent_id
      ? nodes.get(department.parent_id)
      : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  });

  const sortNodes = (items: TreeSelectNode[]) => {
    items.sort((left, right) =>
      String(left.data?.path || left.title).localeCompare(
        String(right.data?.path || right.title),
      ),
    );
    items.forEach((item) => {
      if (item.children?.length) sortNodes(item.children);
      else delete item.children;
    });
  };
  sortNodes(roots);
  return roots;
}

export default function DepartmentTreeSelect({
  departments,
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
  className,
}: DepartmentTreeSelectProps) {
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);

  return (
    <TreeSelect
      data={tree}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      showSearch
      defaultExpandAll
      selectableParents
      className={className}
      renderSelected={(node) => node?.title || placeholder}
    />
  );
}
