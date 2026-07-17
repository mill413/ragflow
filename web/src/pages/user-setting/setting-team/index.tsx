import Spotlight from '@/components/spotlight';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import {
  useCreateTeam,
  useDeleteTeam,
  useFetchUserInfo,
  useListTenant,
  useUpdateTeam,
} from '@/hooks/use-user-setting-request';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileSettingWrapperCard } from '../components/user-setting-header';
import AddingUserModal from './add-user-modal';
import { useAddUser } from './hooks';
import { TeamNameModal } from './team-name-modal';
import TenantTable from './tenant-table';
import UserTable from './user-table';

const UserSettingTeam = () => {
  const { data: userInfo } = useFetchUserInfo();
  const { data: teams } = useListTenant();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamModalMode, setTeamModalMode] = useState<
    'create' | 'rename' | null
  >(null);
  const selectedTeam = useMemo(
    () => teams.find((team) => team.tenant_id === selectedTeamId),
    [selectedTeamId, teams],
  );
  const canManage = Boolean(selectedTeam?.capabilities?.manage_members);
  const canTransfer = selectedTeam?.role === 'owner';
  const { createTeam, loading: creating } = useCreateTeam();
  const { updateTeam, loading: updating } = useUpdateTeam();
  const { deleteTeam } = useDeleteTeam();
  const {
    addingTenantModalVisible,
    hideAddingTenantModal,
    showAddingTenantModal,
    handleAddUserOk,
  } = useAddUser(selectedTeamId);

  useEffect(() => {
    if (
      !selectedTeamId ||
      !teams.some((team) => team.tenant_id === selectedTeamId)
    ) {
      setSelectedTeamId(teams[0]?.tenant_id || '');
    }
  }, [selectedTeamId, teams]);

  const saveTeamName = async (name: string) => {
    if (teamModalMode === 'create') {
      const response = await createTeam(name);
      if (response?.code === 0 && response.data?.tenant_id)
        setSelectedTeamId(response.data.tenant_id);
    } else if (selectedTeam) {
      await updateTeam({ tenantId: selectedTeam.tenant_id, name });
    }
    setTeamModalMode(null);
  };

  return (
    <ProfileSettingWrapperCard
      header={
        <header className="flex items-center justify-between">
          <h2 className="text-2xl font-medium text-text-primary">
            {userInfo?.nickname} {t('setting.workspace')}
          </h2>
          <Button onClick={() => setTeamModalMode('create')}>
            <Plus className="h-4 w-4" />
            {t('setting.createTeam')}
          </Button>
        </header>
      }
    >
      <Spotlight />
      <div className="h-full overflow-y-auto">
        <Card className="border-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">
                {t('setting.teamMembers')}
              </CardTitle>
              <select
                className="h-9 rounded-md border border-border-default bg-bg-input px-3"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {!teams.length && (
                  <option value="">{t('common.noData')}</option>
                )}
                {teams.map((team) => (
                  <option key={team.tenant_id} value={team.tenant_id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {selectedTeam?.capabilities?.update && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTeamModalMode('rename')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {selectedTeam?.capabilities?.delete && (
                <ConfirmDeleteDialog
                  title={t('setting.deleteTeam')}
                  onOk={() => deleteTeam(selectedTeam.tenant_id)}
                >
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ConfirmDeleteDialog>
              )}
            </div>
            {selectedTeam && (
              <section className="flex items-center gap-4">
                <SearchInput
                  className="w-32 bg-bg-input"
                  value={searchUser}
                  onChange={(event) => setSearchUser(event.target.value)}
                />
                <Button disabled={!canManage} onClick={showAddingTenantModal}>
                  <UserPlus className="h-4 w-4" />
                  {t('setting.invite')}
                </Button>
              </section>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {selectedTeam && (
              <UserTable
                searchUser={searchUser}
                tenantId={selectedTeamId}
                canManage={canManage}
                canTransfer={canTransfer}
              />
            )}
          </CardContent>
        </Card>
        <Card className="mt-8 border-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <CardTitle className="text-base">
              {t('setting.joinedTeams')}
            </CardTitle>
            <SearchInput
              className="w-32 bg-bg-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <TenantTable searchTerm={searchTerm} />
          </CardContent>
        </Card>
      </div>
      {addingTenantModalVisible && (
        <AddingUserModal
          visible
          hideModal={hideAddingTenantModal}
          onOk={handleAddUserOk}
        />
      )}
      <TeamNameModal
        open={teamModalMode !== null}
        initialName={teamModalMode === 'rename' ? selectedTeam?.name : ''}
        loading={creating || updating}
        onClose={() => setTeamModalMode(null)}
        onOk={saveTeamName}
      />
    </ProfileSettingWrapperCard>
  );
};

export default UserSettingTeam;
