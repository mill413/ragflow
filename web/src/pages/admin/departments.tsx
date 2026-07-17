import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';

import Spotlight from '@/components/spotlight';
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

export default function AdminDepartments() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService.Department>();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('none');

  const { data: departments = [] } = useQuery({
    queryKey: ['admin/departments'],
    queryFn: async () => (await listDepartments()).data.data,
    retry: false,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin/listUsers'],
    queryFn: async () => (await listUsers()).data.data,
    retry: false,
  });
  const userCounts = useMemo(
    () =>
      users.reduce<Record<string, number>>((counts, user) => {
        if (user.department_id) {
          counts[user.department_id] = (counts[user.department_id] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [users],
  );

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
      setDialogOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin/departments'] });
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

  return (
    <Card className="!shadow-none relative h-full bg-transparent overflow-hidden">
      <Spotlight />
      <ScrollArea className="size-full">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t('admin.departmentManagement')}</CardTitle>
            <div className="mt-2 text-sm text-text-secondary">
              {t('admin.departmentDescription')}
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus /> {t('admin.newDepartment')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.departmentName')}</TableHead>
                <TableHead>{t('admin.departmentPath')}</TableHead>
                <TableHead>{t('admin.parentDepartment')}</TableHead>
                <TableHead>{t('admin.departmentUsers')}</TableHead>
                <TableHead>{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length ? (
                departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-text-secondary" />
                        {department.name}
                      </div>
                    </TableCell>
                    <TableCell>{department.path}</TableCell>
                    <TableCell>
                      {departments.find(
                        (item) => item.id === department.parent_id,
                      )?.path || '-'}
                    </TableCell>
                    <TableCell>{userCounts[department.id] ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="transparent"
                          size="icon"
                          onClick={() => openEdit(department)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          disabled={(userCounts[department.id] ?? 0) > 0}
                          onClick={() => deleteMutation.mutate(department.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
              {t('admin.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
