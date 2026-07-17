import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAgreeTenant,
  useDeleteTenantUser,
  useFetchUserInfo,
  useListTeamInvitations,
  useListTenant,
} from '@/hooks/use-user-setting-request';
import { useWorkspace } from '@/hooks/use-workspace';
import { LogOut } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const TenantTable = ({ searchTerm }: { searchTerm: string }) => {
  const { t } = useTranslation();
  const { data: teams, loading } = useListTenant();
  const { data: invitations } = useListTeamInvitations();
  const { data: user } = useFetchUserInfo();
  const { agreeTenant } = useAgreeTenant();
  const { deleteTenantUser } = useDeleteTenantUser();
  const { setWorkspaceId } = useWorkspace();
  const data = useMemo(
    () =>
      [...invitations, ...teams].filter((team) =>
        (team.name || '').toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [invitations, searchTerm, teams],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-bg-input">
      <Table>
        <TableHeader className="bg-bg-title">
          <TableRow>
            <TableHead>{t('setting.teamName')}</TableHead>
            <TableHead>{t('setting.role')}</TableHead>
            <TableHead>{t('common.action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-bg-base">
          {!loading && data.length ? (
            data.map((team) => (
              <TableRow key={`${team.tenant_id}-${team.role}`}>
                <TableCell>{team.name}</TableCell>
                <TableCell>{team.role}</TableCell>
                <TableCell>
                  {team.role === 'invite' ? (
                    <div className="flex gap-2">
                      <Button
                        variant="link"
                        onClick={() => agreeTenant(team.tenant_id)}
                      >
                        {t('setting.agree')}
                      </Button>
                      <Button
                        variant="link"
                        onClick={() =>
                          deleteTenantUser({
                            tenantId: team.tenant_id,
                            userId: user.id,
                          })
                        }
                      >
                        {t('setting.refuse')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="link"
                        onClick={() => setWorkspaceId(team.tenant_id)}
                      >
                        {t('setting.view')}
                      </Button>
                      {team.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('setting.quit')}
                          onClick={() =>
                            deleteTenantUser({
                              tenantId: team.tenant_id,
                              userId: user.id,
                            })
                          }
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TenantTable;
