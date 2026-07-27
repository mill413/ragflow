import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
} from 'lucide-react';

import Spotlight from '@/components/spotlight';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import message from '@/components/ui/message';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  listUsers,
  updateDepartment,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { AdminRefreshButton } from './components/admin-refresh-button';
import { getSortIcon } from './utils';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import { matchesSelectedFilter } from './components/table-filter-utils';

type DepartmentTreeNode = AdminService.Department & {
  children: DepartmentTreeNode[];
};
type DepartmentSortKey = 'name' | 'path' | 'user_count' | 'created_at';

export default function AdminDepartments() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService.Department>();
  const [deleting, setDeleting] = useState<AdminService.Department>();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('none');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [parentFilters, setParentFilters] = useState<string[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{
    key: DepartmentSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'path', direction: 'asc' });

  const { data: allDepartments = [] } = useQuery({
    queryKey: ['admin/departments'],
    queryFn: async () => (await listDepartments()).data.data,
    retry: false,
  });
  const { data: searchedDepartments = [] } = useQuery({
    queryKey: ['admin/departments', 'search', query],
    queryFn: async () => (await listDepartments(query)).data.data,
    enabled: Boolean(query),
    retry: false,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin/listUsers'],
    queryFn: async () => (await listUsers()).data.data,
    retry: false,
  });
  const departments = query ? searchedDepartments : allDepartments;
  const rootDepartments = allDepartments.filter(
    (department) => !department.parent_id,
  ).length;
  const assignedUsers = users.filter((user) => user.department_id).length;
  const unassignedUsers = users.length - assignedUsers;

  const departmentRows = useMemo(() => {
    const nodes = new Map<string, DepartmentTreeNode>();
    departments.forEach((department) =>
      nodes.set(department.id, { ...department, children: [] }),
    );

    const roots: DepartmentTreeNode[] = [];
    nodes.forEach((node) => {
      const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });

    const sortNodes = (items: DepartmentTreeNode[]) => {
      items.sort((left, right) => {
        const result = String(left[sort.key] ?? '').localeCompare(
          String(right[sort.key] ?? ''),
          undefined,
          { numeric: true },
        );
        return sort.direction === 'asc' ? result : -result;
      });
      items.forEach((item) => sortNodes(item.children));
    };
    sortNodes(roots);

    const rows: Array<{
      department: DepartmentTreeNode;
      depth: number;
    }> = [];
    const visit = (items: DepartmentTreeNode[], depth: number) => {
      items.forEach((department) => {
        rows.push({ department, depth });
        if (parentFilters.length > 0 || !collapsedIds.has(department.id)) {
          visit(department.children, depth + 1);
        }
      });
    };
    visit(roots, 0);
    return rows.filter(({ department }) =>
      matchesSelectedFilter(department.parent_id || 'root', parentFilters),
    );
  }, [collapsedIds, departments, parentFilters, sort]);

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateDepartment(
            editing.id,
            name,
            parentId === 'none' ? undefined : parentId,
          )
        : createDepartment(name, parentId === 'none' ? undefined : parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/departments'] });
      queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
      message.success(t('admin.departmentSaved'));
      setDialogOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/departments'] });
      message.success(t('admin.departmentDeleted'));
      setDeleting(undefined);
    },
  });

  const openCreate = () => {
    setEditing(undefined);
    setName('');
    setParentId('none');
    setDialogOpen(true);
  };
  const openEdit = (department: AdminService.Department) => {
    setEditing(department);
    setName(department.name);
    setParentId(department.parent_id || 'none');
    setDialogOpen(true);
  };
  const toggleDepartment = (departmentId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };
  const applySearch = () => setQuery(searchInput.trim());
  const toggleSort = (key: DepartmentSortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <Card className="!shadow-none relative h-full bg-transparent overflow-hidden">
      <Spotlight />
      <ScrollArea className="size-full">
        <CardHeader className="space-y-6">
          <div className="flex items-center justify-between gap-6">
            <div>
              <CardTitle>{t('admin.departmentManagement')}</CardTitle>
              <div className="mt-2 text-sm text-text-secondary">
                {t('admin.departmentDescription')}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AdminRefreshButton
                queryKeys={[['admin/departments'], ['admin/listUsers']]}
              />
              <Button className="h-10 px-4" onClick={openCreate}>
                <Plus /> {t('admin.newDepartment')}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [t('admin.departmentTotal'), allDepartments.length, Building2],
              [t('admin.rootDepartments'), rootDepartments, Network],
              [t('admin.assignedDepartmentUsers'), assignedUsers, UserCheck],
              [
                t('admin.unassignedDepartmentUsers'),
                unassignedUsers,
                UserMinus,
              ],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof Building2;
              return (
                <div
                  key={String(label)}
                  className="rounded-lg border-0.5 border-border-button bg-bg-input p-4"
                >
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{String(label)}</span>
                    <MetricIcon className="size-4" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {String(value)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminTableMultiFilters
              filters={[
                {
                  id: 'parent-department',
                  label: t('admin.parentDepartment'),
                  options: [
                    {
                      value: 'root',
                      label: t('admin.noParentDepartment'),
                    },
                    ...departments.map((department) => ({
                      value: department.id,
                      label: department.path,
                    })),
                  ],
                  value: parentFilters,
                  onChange: setParentFilters,
                },
              ]}
              resetLabel={t('admin.reset')}
              onReset={() => setParentFilters([])}
            />
            <Input
              className="w-64 bg-bg-input border-border-button"
              value={searchInput}
              placeholder={t('admin.searchDepartment')}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
            />
            <Button variant="outline" onClick={applySearch}>
              <Search /> {t('admin.query')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table rootClassName="max-w-full [contain:inline-size]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">
                  <Button variant="ghost" onClick={() => toggleSort('name')}>
                    {t('admin.department')}
                    {getSortIcon(sort.key === 'name' ? sort.direction : false)}
                  </Button>
                </TableHead>
                <TableHead className="w-[32%]">
                  <Button variant="ghost" onClick={() => toggleSort('path')}>
                    {t('admin.departmentPath')}
                    {getSortIcon(sort.key === 'path' ? sort.direction : false)}
                  </Button>
                </TableHead>
                <TableHead className="w-[13%] text-center">
                  <Button
                    variant="ghost"
                    onClick={() => toggleSort('user_count')}
                  >
                    {t('admin.departmentUsers')}
                    {getSortIcon(
                      sort.key === 'user_count' ? sort.direction : false,
                    )}
                  </Button>
                </TableHead>
                <TableHead className="w-[18%]">
                  <Button
                    variant="ghost"
                    onClick={() => toggleSort('created_at')}
                  >
                    {t('admin.createTime')}
                    {getSortIcon(
                      sort.key === 'created_at' ? sort.direction : false,
                    )}
                  </Button>
                </TableHead>
                <TableHead className="w-40">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentRows.length ? (
                departmentRows.map(({ department, depth }) => {
                  const hasChildren = department.children.length > 0;
                  const collapsed = collapsedIds.has(department.id);
                  return (
                    <TableRow key={department.id} className="group/row">
                      <TableCell className="font-medium">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${depth * 24}px` }}
                        >
                          {hasChildren ? (
                            <Button
                              variant="transparent"
                              size="icon"
                              className="size-7 shrink-0 border-0"
                              onClick={() => toggleDepartment(department.id)}
                            >
                              {collapsed ? <ChevronRight /> : <ChevronDown />}
                            </Button>
                          ) : (
                            <span className="size-7 shrink-0" />
                          )}
                          <Building2 className="size-4 shrink-0 text-text-secondary" />
                          <span>{department.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{department.path}</TableCell>
                      <TableCell className="text-center">
                        {department.user_count ?? 0}
                      </TableCell>
                      <TableCell>
                        {department.created_at
                          ? formatDate(department.created_at)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="transparent"
                            size="icon"
                            title={t('admin.editDepartment')}
                            onClick={() => openEdit(department)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="danger"
                            size="icon"
                            title={t('admin.deleteDepartment')}
                            onClick={() => setDeleting(department)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-40 text-center text-text-secondary"
                  >
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('admin.editDepartment') : t('admin.newDepartment')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-6">
            <div className="space-y-2">
              <Label>{t('admin.departmentName')}</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.parentDepartment')}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('admin.noParentDepartment')}
                  </SelectItem>
                  {departments
                    .filter((department) => department.id !== editing?.id)
                    .map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.path}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              disabled={!name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t('admin.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.deleteDepartment')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.deleteDepartmentConfirmation', {
                name: deleting?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-state-error hover:bg-state-error/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
