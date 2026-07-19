import { type MouseEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus,
  Clock3,
  Crown,
  FileText,
  HardDrive,
  Library,
  MailQuestion,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRoundPlus,
  UsersRound,
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
import { Badge } from '@/components/ui/badge';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addAdminTeamMember,
  createAdminTeam,
  deleteAdminTeam,
  deleteAdminTeamMember,
  listAdminTeamMembers,
  listAdminTeams,
  listUsers,
  updateAdminTeam,
  updateAdminTeamMember,
} from '@/services/admin-service';
import { formatDate } from '@/utils/date';
import { getSortIcon } from './utils';
import { UserStatusBadge } from './components/user-status';
import { AdminTableMultiFilters } from './components/table-multi-filters';
import {
  createFilterOptions,
  matchesSelectedFilter,
} from './components/table-filter-utils';
import { DetailInformationCard } from './components/detail-information-card';
import { StorageSize } from './components/storage-size';

type TeamSortKey =
  | 'name'
  | 'owner_email'
  | 'member_count'
  | 'dataset_count'
  | 'document_count'
  | 'storage_bytes'
  | 'update_date';
type TeamMemberSortKey = 'email' | 'nickname' | 'role' | 'is_active';

type PendingRole = {
  member: AdminService.TeamMember;
  role: AdminService.TeamMemberRole;
};

const editableRoles: AdminService.TeamMemberRole[] = [
  'owner',
  'admin',
  'normal',
];

export default function AdminTeams() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [memberRoles, setMemberRoles] = useState<string[]>([]);
  const [memberStatuses, setMemberStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<{
    key: TeamSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'update_date', direction: 'desc' });
  const [memberSort, setMemberSort] = useState<{
    key: TeamMemberSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'email', direction: 'asc' });
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<AdminService.Team>();
  const [teamName, setTeamName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [deletingTeam, setDeletingTeam] = useState<AdminService.Team>();
  const [selectedTeam, setSelectedTeam] = useState<AdminService.Team>();
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] =
    useState<AdminService.TeamMemberRole>('normal');
  const [deletingMember, setDeletingMember] =
    useState<AdminService.TeamMember>();
  const [pendingRole, setPendingRole] = useState<PendingRole>();

  const { data: teams = [], isFetching } = useQuery({
    queryKey: ['admin/teams'],
    queryFn: async () => (await listAdminTeams()).data.data,
    retry: false,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin/listUsers'],
    queryFn: async () => (await listUsers()).data.data,
    retry: false,
  });
  const { data: members = [], isFetching: membersFetching } = useQuery({
    queryKey: ['admin/teams/members', selectedTeam?.id],
    queryFn: async () =>
      (await listAdminTeamMembers(selectedTeam!.id)).data.data,
    enabled: Boolean(selectedTeam),
    retry: false,
  });
  const { data: editingMembers = [] } = useQuery({
    queryKey: ['admin/teams/members', editingTeam?.id],
    queryFn: async () =>
      (await listAdminTeamMembers(editingTeam!.id)).data.data,
    enabled: Boolean(editingTeam),
    retry: false,
  });

  const invalidateTeams = () => {
    queryClient.invalidateQueries({ queryKey: ['admin/teams'] });
    queryClient.invalidateQueries({ queryKey: ['admin/teams/members'] });
    queryClient.invalidateQueries({ queryKey: ['admin/monitoring'] });
    queryClient.invalidateQueries({ queryKey: ['admin/listUsers'] });
  };

  const saveTeamMutation = useMutation({
    mutationFn: () =>
      editingTeam
        ? updateAdminTeam(editingTeam.id, teamName, ownerId)
        : createAdminTeam(teamName, ownerId),
    onSuccess: () => {
      invalidateTeams();
      setTeamDialogOpen(false);
      message.success(t('admin.teamManagement.teamSaved'));
    },
  });
  const deleteTeamMutation = useMutation({
    mutationFn: deleteAdminTeam,
    onSuccess: () => {
      invalidateTeams();
      setDeletingTeam(undefined);
      setSelectedTeam(undefined);
      message.success(t('admin.teamManagement.teamDeleted'));
    },
  });
  const addMemberMutation = useMutation({
    mutationFn: () =>
      addAdminTeamMember(selectedTeam!.id, memberUserId, memberRole),
    onSuccess: () => {
      invalidateTeams();
      setMemberDialogOpen(false);
      message.success(t('admin.teamManagement.memberSaved'));
    },
  });
  const updateMemberMutation = useMutation({
    mutationFn: ({ member, role }: PendingRole) =>
      updateAdminTeamMember(selectedTeam!.id, member.user_id, role),
    onSuccess: () => {
      invalidateTeams();
      setPendingRole(undefined);
      message.success(t('admin.teamManagement.memberSaved'));
    },
  });
  const deleteMemberMutation = useMutation({
    mutationFn: (member: AdminService.TeamMember) =>
      deleteAdminTeamMember(selectedTeam!.id, member.user_id),
    onSuccess: () => {
      invalidateTeams();
      setDeletingMember(undefined);
      message.success(t('admin.teamManagement.memberDeleted'));
    },
  });

  const filteredTeams = useMemo(() => {
    const query = keywords.trim().toLocaleLowerCase();
    return [...teams]
      .filter((team) =>
        [team.name, team.id, team.owner_email, team.owner_name].some((value) =>
          String(value || '')
            .toLocaleLowerCase()
            .includes(query),
        ),
      )
      .filter(
        (team) =>
          matchesSelectedFilter(team.id, teamIds) &&
          matchesSelectedFilter(team.owner_id, ownerIds),
      )
      .sort((left, right) => {
        const result = String(left[sort.key] ?? '').localeCompare(
          String(right[sort.key] ?? ''),
          undefined,
          { numeric: true },
        );
        return sort.direction === 'asc' ? result : -result;
      });
  }, [keywords, ownerIds, sort, teamIds, teams]);

  const availableUsers = users.filter(
    (user) =>
      user.is_active === '1' &&
      !members.some((member) => member.user_id === user.id),
  );
  const sortedMembers = useMemo(() => {
    return [...members]
      .filter(
        (member) =>
          matchesSelectedFilter(member.role, memberRoles) &&
          matchesSelectedFilter(member.is_active, memberStatuses),
      )
      .sort((left, right) => {
        const result = String(left[memberSort.key] ?? '').localeCompare(
          String(right[memberSort.key] ?? ''),
          undefined,
          { numeric: true },
        );
        return memberSort.direction === 'asc' ? result : -result;
      });
  }, [memberRoles, memberSort, memberStatuses, members]);
  const ownerOptions = editingTeam
    ? editingMembers.filter(
        (member) => member.is_active === '1' && member.role !== 'invite',
      )
    : users.filter((user) => user.is_active === '1');
  const selectedTeamDetails =
    teams.find((team) => team.id === selectedTeam?.id) ?? selectedTeam;
  const activeMemberCount = teams.reduce(
    (total, team) => total + team.member_count,
    0,
  );
  const datasetCount = teams.reduce(
    (total, team) => total + team.dataset_count,
    0,
  );
  const storageBytes = teams.reduce(
    (total, team) => total + team.storage_bytes,
    0,
  );

  const openCreateTeam = () => {
    setEditingTeam(undefined);
    setTeamName('');
    setOwnerId('');
    setTeamDialogOpen(true);
  };
  const openEditTeam = (team: AdminService.Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setOwnerId(team.owner_id);
    setTeamDialogOpen(true);
  };
  const openAddMember = () => {
    setMemberUserId('');
    setMemberRole('normal');
    setMemberDialogOpen(true);
  };
  const toggleSort = (key: TeamSortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortButton = (label: string, key: TeamSortKey) => (
    <Button variant="ghost" onClick={() => toggleSort(key)}>
      {label}
      {getSortIcon(sort.key === key ? sort.direction : false)}
    </Button>
  );
  const memberSortButton = (label: string, key: TeamMemberSortKey) => (
    <Button
      variant="ghost"
      onClick={() =>
        setMemberSort((current) => ({
          key,
          direction:
            current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }))
      }
    >
      {label}
      {getSortIcon(memberSort.key === key ? memberSort.direction : false)}
    </Button>
  );
  const roleLabel = (role: AdminService.TeamMemberRole) =>
    t(`admin.teamManagement.roles.${role}`);

  return (
    <Card className="!shadow-none relative h-full flex flex-col border-0.5 border-border-button bg-transparent rounded-xl overflow-hidden">
      <Spotlight />
      <ScrollArea className="size-full">
        <CardHeader className="space-y-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              <CardTitle>{t('admin.teamManagement.title')}</CardTitle>
              <div className="mt-2 text-sm text-text-secondary">
                {t('admin.teamManagement.description')}
              </div>
            </div>
            <Button onClick={openCreateTeam}>
              <Plus /> {t('admin.teamManagement.newTeam')}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: t('admin.teamManagement.teams'),
                value: teams.length,
                icon: UsersRound,
              },
              {
                label: t('admin.teamManagement.activeMemberships'),
                value: activeMemberCount,
                icon: UserRoundPlus,
              },
              {
                label: t('admin.teamManagement.teamDatasets'),
                value: datasetCount,
                icon: Library,
              },
              {
                label: t('admin.teamManagement.storage'),
                value: <StorageSize bytes={storageBytes} />,
                icon: HardDrive,
              },
            ].map(({ label, value, icon: MetricIcon }) => {
              return (
                <div
                  key={label}
                  className="rounded-lg border-0.5 border-border-button bg-bg-input p-4"
                >
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{label}</span>
                    <MetricIcon className="size-4" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{value}</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AdminTableMultiFilters
              filters={[
                {
                  id: 'team',
                  label: t('admin.teamManagement.team'),
                  options: teams.map((team) => ({
                    value: team.id,
                    label: team.name,
                  })),
                  value: teamIds,
                  onChange: setTeamIds,
                },
                {
                  id: 'owner',
                  label: t('admin.teamManagement.owner'),
                  options: createFilterOptions(
                    teams,
                    (team) => team.owner_id,
                    (ownerId) => {
                      const team = teams.find(
                        (candidate) => candidate.owner_id === ownerId,
                      );
                      return team?.owner_name || team?.owner_email || ownerId;
                    },
                  ),
                  value: ownerIds,
                  onChange: setOwnerIds,
                },
              ]}
              resetLabel={t('admin.reset')}
              onReset={() => {
                setTeamIds([]);
                setOwnerIds([]);
              }}
            />
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <Input
                className="pl-9"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder={t('admin.teamManagement.search')}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {sortButton(t('admin.teamManagement.team'), 'name')}
                </TableHead>
                <TableHead>
                  {sortButton(t('admin.teamManagement.owner'), 'owner_email')}
                </TableHead>
                <TableHead className="text-center">
                  {sortButton(
                    t('admin.teamManagement.members'),
                    'member_count',
                  )}
                </TableHead>
                <TableHead className="text-center">
                  {sortButton(
                    t('admin.teamManagement.datasets'),
                    'dataset_count',
                  )}
                </TableHead>
                <TableHead className="text-center">
                  {sortButton(
                    t('admin.teamManagement.documents'),
                    'document_count',
                  )}
                </TableHead>
                <TableHead className="text-center">
                  {sortButton(
                    t('admin.teamManagement.storage'),
                    'storage_bytes',
                  )}
                </TableHead>
                <TableHead>
                  {sortButton(t('admin.lastUpdateTime'), 'update_date')}
                </TableHead>
                <TableHead className="w-36">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.map((team) => (
                <TableRow
                  key={team.id}
                  className="group/row cursor-pointer"
                  onClick={() => setSelectedTeam(team)}
                >
                  <TableCell>
                    <div className="font-medium">{team.name}</div>
                    <div
                      className="max-w-48 truncate text-xs text-text-secondary"
                      title={team.id}
                    >
                      {team.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{team.owner_name || '-'}</div>
                    <div className="text-xs text-text-secondary">
                      {team.owner_email}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {team.member_count}
                    {team.invite_count > 0 && (
                      <Badge className="ml-2" variant="outline">
                        {t('admin.teamManagement.invites', {
                          count: team.invite_count,
                        })}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {team.dataset_count}
                  </TableCell>
                  <TableCell className="text-center">
                    {team.document_count}
                  </TableCell>
                  <TableCell className="text-center">
                    <StorageSize bytes={team.storage_bytes} />
                  </TableCell>
                  <TableCell>{formatDate(team.update_date) || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title={t('admin.teamManagement.editTeam')}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          openEditTeam(team);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title={t('admin.teamManagement.deleteTeam')}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          setDeletingTeam(team);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isFetching && filteredTeams.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-text-secondary"
                  >
                    {t('admin.teamManagement.noTeams')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </ScrollArea>

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTeam
                ? t('admin.teamManagement.editTeam')
                : t('admin.teamManagement.newTeam')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('admin.teamManagement.teamName')}</Label>
              <Input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.teamManagement.owner')}</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('admin.teamManagement.selectOwner')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {ownerOptions.map((user) => {
                    const id = 'user_id' in user ? user.user_id : user.id;
                    return (
                      <SelectItem key={id} value={id}>
                        {user.nickname} / {user.email}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {editingTeam && (
                <p className="text-xs text-text-secondary">
                  {t('admin.teamManagement.ownerTransferHint')}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              disabled={!teamName.trim() || (!editingTeam && !ownerId)}
              onClick={() => saveTeamMutation.mutate()}
            >
              {t('admin.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedTeam)}
        onOpenChange={(open) => !open && setSelectedTeam(undefined)}
      >
        <SheetContent className="w-[min(900px,80vw)] max-w-none p-0">
          <SheetHeader className="border-b border-border-button px-6 py-5">
            <SheetTitle>{selectedTeamDetails?.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {t('admin.teamManagement.teamId')}：
              {selectedTeamDetails?.id || '-'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-97px)] px-6">
            <section className="border-b border-border-button py-5">
              <div className="mb-3 text-sm font-medium">
                {t('admin.teamManagement.teamInformation')}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: t('admin.teamManagement.owner'),
                    value:
                      [
                        selectedTeamDetails?.owner_name,
                        selectedTeamDetails?.owner_email,
                      ]
                        .filter(Boolean)
                        .join(' / ') || '-',
                    icon: Crown,
                  },
                  {
                    label: t('admin.teamManagement.members'),
                    value: selectedTeamDetails?.member_count ?? 0,
                    icon: UsersRound,
                  },
                  {
                    label: t('admin.teamManagement.pendingInvites'),
                    value: selectedTeamDetails?.invite_count ?? 0,
                    icon: MailQuestion,
                  },
                  {
                    label: t('admin.teamManagement.datasets'),
                    value: selectedTeamDetails?.dataset_count ?? 0,
                    icon: Library,
                  },
                  {
                    label: t('admin.teamManagement.documents'),
                    value: selectedTeamDetails?.document_count ?? 0,
                    icon: FileText,
                  },
                  {
                    label: t('admin.teamManagement.storage'),
                    value: (
                      <StorageSize
                        bytes={selectedTeamDetails?.storage_bytes ?? 0}
                      />
                    ),
                    icon: HardDrive,
                  },
                  {
                    label: t('admin.createTime'),
                    value: formatDate(selectedTeamDetails?.create_date) || '-',
                    icon: CalendarPlus,
                  },
                  {
                    label: t('admin.lastUpdateTime'),
                    value: formatDate(selectedTeamDetails?.update_date) || '-',
                    icon: Clock3,
                  },
                ].map(({ label, value, icon }) => (
                  <DetailInformationCard
                    key={label}
                    icon={icon}
                    label={label}
                    value={value}
                  />
                ))}
              </div>
            </section>
            <div className="flex items-center justify-between py-4">
              <div className="text-sm font-medium">
                {t('admin.teamManagement.memberManagement')}
              </div>
              <Button onClick={openAddMember} disabled={!availableUsers.length}>
                <UserRoundPlus /> {t('admin.teamManagement.addMember')}
              </Button>
            </div>
            <AdminTableMultiFilters
              className="pb-4"
              filters={[
                {
                  id: 'member-role',
                  label: t('admin.teamManagement.role'),
                  options: createFilterOptions(
                    members,
                    (member) => member.role,
                    (role) => roleLabel(role as AdminService.TeamMemberRole),
                  ),
                  value: memberRoles,
                  onChange: setMemberRoles,
                },
                {
                  id: 'member-status',
                  label: t('admin.status'),
                  options: [
                    { value: '1', label: t('admin.active') },
                    { value: '0', label: t('admin.inactive') },
                  ],
                  value: memberStatuses,
                  onChange: setMemberStatuses,
                },
              ]}
              resetLabel={t('admin.reset')}
              onReset={() => {
                setMemberRoles([]);
                setMemberStatuses([]);
              }}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {memberSortButton(t('admin.email'), 'email')}
                  </TableHead>
                  <TableHead>
                    {memberSortButton(t('admin.nickname'), 'nickname')}
                  </TableHead>
                  <TableHead>
                    {memberSortButton(t('admin.teamManagement.role'), 'role')}
                  </TableHead>
                  <TableHead>
                    {memberSortButton(t('admin.status'), 'is_active')}
                  </TableHead>
                  <TableHead className="w-20">{t('admin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => (
                  <TableRow key={member.user_id} className="group/member">
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.nickname}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        disabled={member.role === 'owner'}
                        onValueChange={(role) =>
                          setPendingRole({
                            member,
                            role: role as AdminService.TeamMemberRole,
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {member.role === 'invite' && (
                            <SelectItem value="invite" disabled>
                              {roleLabel('invite')}
                            </SelectItem>
                          )}
                          {editableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabel(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge active={member.is_active} />
                    </TableCell>
                    <TableCell>
                      {member.role !== 'owner' && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t('admin.teamManagement.removeMember')}
                          className="opacity-0 transition-opacity group-hover/member:opacity-100"
                          onClick={() => setDeletingMember(member)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!membersFetching && sortedMembers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-text-secondary"
                    >
                      {t('admin.teamManagement.noMembers')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.teamManagement.addMember')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('admin.teamManagement.member')}</Label>
              <Select value={memberUserId} onValueChange={setMemberUserId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('admin.teamManagement.selectMember')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nickname} / {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.teamManagement.role')}</Label>
              <Select
                value={memberRole}
                onValueChange={(role) =>
                  setMemberRole(role as AdminService.TeamMemberRole)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['admin', 'normal'] as AdminService.TeamMemberRole[]).map(
                    (role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberDialogOpen(false)}
            >
              {t('admin.cancel')}
            </Button>
            <Button
              disabled={!memberUserId}
              onClick={() => addMemberMutation.mutate()}
            >
              {t('admin.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingTeam)}
        onOpenChange={(open) => !open && setDeletingTeam(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.teamManagement.deleteTeam')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.teamManagement.deleteTeamDescription', {
                name: deletingTeam?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingTeam && deleteTeamMutation.mutate(deletingTeam.id)
              }
            >
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingMember)}
        onOpenChange={(open) => !open && setDeletingMember(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.teamManagement.removeMember')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.teamManagement.removeMemberDescription', {
                email: deletingMember?.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingMember && deleteMemberMutation.mutate(deletingMember)
              }
            >
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRole)}
        onOpenChange={(open) => !open && setPendingRole(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.teamManagement.changeRole')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.teamManagement.changeRoleDescription', {
                email: pendingRole?.member.email,
                role: pendingRole ? roleLabel(pendingRole.role) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingRole && updateMemberMutation.mutate(pendingRole)
              }
            >
              {t('admin.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
