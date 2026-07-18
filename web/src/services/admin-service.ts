import { history } from '@/utils/simple-history-util';
import axios from 'axios';

import message from '@/components/ui/message';
import { Authorization } from '@/constants/authorization';
import i18n from '@/locales/config';
import { Routes } from '@/routes';
import api from '@/utils/api';
import {
  adminAuthorizationUtil,
  getAdminAuthorization,
} from '@/utils/authorization-util';
import { convertTheKeysOfTheObjectToSnake } from '@/utils/common-util';
import { ResultCode, RetcodeMessage } from '@/utils/request';

const request = axios.create({
  timeout: 300000,
});

request.interceptors.request.use((config) => {
  const data = convertTheKeysOfTheObjectToSnake(config.data);
  const params = convertTheKeysOfTheObjectToSnake(config.params) as any;

  const newConfig = { ...config, data, params };

  // @ts-ignore
  if (!newConfig.skipToken) {
    newConfig.headers.set(Authorization, getAdminAuthorization());
  }

  return newConfig;
});

request.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response;
    }

    const { data } = response ?? {};

    if (data?.code === 100) {
      message.error(data?.message);
    } else if (data?.code === 401) {
      message.error(data?.message, {
        description: data?.message,
      });

      adminAuthorizationUtil.removeAll();
      history.push(Routes.Admin);
      window.location.reload();
    } else if (data?.code && data.code !== 0) {
      message.error(`${i18n.t('message.hint')}: ${data?.code}`, {
        description: data?.message,
      });
    }

    return response;
  },
  (error) => {
    const { response } = error;
    const { data } = response ?? {};

    if (error.message === 'Failed to fetch') {
      message.error({
        description: i18n.t('message.networkAnomalyDescription'),
        message: i18n.t('message.networkAnomaly'),
      });
    } else if (data?.code === 100) {
      message.error(data?.message);
    } else if (response.status === 401 || data?.code === 401) {
      message.error({
        message: data?.message || response.statusText,
        description:
          data?.message || RetcodeMessage[response?.status as ResultCode],
        duration: 3,
      });

      adminAuthorizationUtil.removeAll();
      history.push(Routes.Admin);
      window.location.reload();
    } else if (data?.code && data.code !== 0) {
      message.error({
        message: `${i18n.t('message.hint')}: ${data?.code}`,
        description: data?.message,
        duration: 3,
      });
    } else if (response.status) {
      message.error({
        message: `${i18n.t('message.requestError')} ${response.status}: ${response.config.url}`,
        description:
          RetcodeMessage[response.status as ResultCode] || response.statusText,
      });
    } else if (response.status === 413 || response?.status === 504) {
      message.error(RetcodeMessage[response?.status as ResultCode]);
    }

    throw error;
  },
);

const {
  adminLogin,
  adminLogout,
  adminListUsers,
  adminCreateUser,
  adminGetUserDetails,
  adminUpdateUserStatus,
  adminUpdateUserPassword,
  adminDeleteUser,
  adminListUserDatasets,
  adminListUserAgents,
  adminUpdateUserDepartment,
  adminGetUserLoginUrl,
  adminDepartments,
  adminDepartment,
  adminListManagedResources,
  adminListFailedDocuments,

  adminListServices,
  adminShowServiceDetails,

  adminListRoles,
  adminListRolesWithPermission,
  adminCreateRole,
  adminDeleteRole,
  adminUpdateRoleDescription,
  adminGetRolePermissions,
  adminAssignRolePermissions,
  adminRevokeRolePermissions,

  adminGetUserPermissions,
  adminUpdateUserRole,

  adminListResources,

  adminListWhitelist,
  adminCreateWhitelistEntry,
  adminUpdateWhitelistEntry,
  adminDeleteWhitelistEntry,
  adminImportWhitelist,

  adminGetSystemVersion,
  adminGetMonitoringSummary,

  adminListSandboxProviders,
  adminGetSandboxProviderSchema,
  adminGetSandboxConfig,
  adminSetSandboxConfig,
  adminTestSandboxConnection,
} = api;

type ResponseData<D = NonNullable<unknown>> = {
  code: number;
  message: string;
  data: D;
};

export const login = (params: { email: string; password: string }) =>
  request.post<ResponseData<AdminService.LoginData>>(adminLogin, params);
export const logout = () => request.get<ResponseData<boolean>>(adminLogout);
export const listUsers = () =>
  request.get<ResponseData<AdminService.ListUsersItem[]>>(adminListUsers, {});

export const createUser = (
  email: string,
  password: string,
  departmentId?: string,
) =>
  request.post<ResponseData<boolean>>(adminCreateUser, {
    username: email,
    password,
    department_id: departmentId || null,
  });

export const grantSuperuser = (email: string) =>
  request.put<ResponseData<void>>(api.adminSetSuperuser(email));

export const revokeSuperuser = (email: string) =>
  request.delete<ResponseData<void>>(api.adminSetSuperuser(email));

export const getUserDetails = (email: string) =>
  request.get<ResponseData<[AdminService.UserDetail]>>(
    adminGetUserDetails(email),
  );
export const updateUser = (
  email: string,
  data: {
    nickname: string;
    departmentId: string | null;
    isActive: boolean;
    isSuperuser: boolean;
    password?: string;
    remark?: string;
  },
) =>
  request.patch<ResponseData<{ id: string; email: string }>>(
    adminGetUserDetails(email),
    data,
  );
export const listUserDatasets = (email: string) =>
  request.get<ResponseData<AdminService.ListUserDatasetItem[]>>(
    adminListUserDatasets(email),
  );
export const listUserAgents = (email: string) =>
  request.get<ResponseData<AdminService.ListUserAgentItem[]>>(
    adminListUserAgents(email),
  );
export const updateUserDepartment = (email: string, departmentId?: string) =>
  request.put<ResponseData<boolean>>(adminUpdateUserDepartment(email), {
    department_id: departmentId || null,
  });
export const getUserLoginUrl = (email: string) =>
  request.post<ResponseData<{ url: string; email: string }>>(
    adminGetUserLoginUrl(email),
  );
export const listDepartments = (query?: string) =>
  request.get<ResponseData<AdminService.Department[]>>(adminDepartments, {
    params: { q: query || undefined },
  });
export const createDepartment = (name: string, parentId?: string) =>
  request.post<ResponseData<AdminService.Department>>(adminDepartments, {
    name,
    parent_id: parentId || null,
  });
export const updateDepartment = (
  departmentId: string,
  name: string,
  parentId?: string,
) =>
  request.put<ResponseData<AdminService.Department>>(
    adminDepartment(departmentId),
    { name, parent_id: parentId || null },
  );
export const deleteDepartment = (departmentId: string) =>
  request.delete<ResponseData<boolean>>(adminDepartment(departmentId));
export const listAdminTeams = () =>
  request.get<ResponseData<AdminService.Team[]>>(api.adminTeams);
export const createAdminTeam = (name: string, ownerId: string) =>
  request.post<ResponseData<AdminService.Team>>(api.adminTeams, {
    name,
    owner_id: ownerId,
  });
export const updateAdminTeam = (
  teamId: string,
  name: string,
  ownerId: string,
) =>
  request.put<ResponseData<AdminService.Team>>(api.adminTeam(teamId), {
    name,
    owner_id: ownerId,
  });
export const deleteAdminTeam = (teamId: string) =>
  request.delete<ResponseData<boolean>>(api.adminTeam(teamId));
export const listAdminTeamMembers = (teamId: string) =>
  request.get<ResponseData<AdminService.TeamMember[]>>(
    api.adminTeamMembers(teamId),
  );
export const addAdminTeamMember = (
  teamId: string,
  userId: string,
  role: AdminService.TeamMemberRole,
) =>
  request.post<ResponseData<boolean>>(api.adminTeamMembers(teamId), {
    user_id: userId,
    role,
  });
export const updateAdminTeamMember = (
  teamId: string,
  userId: string,
  role: AdminService.TeamMemberRole,
) =>
  request.put<ResponseData<boolean>>(api.adminTeamMember(teamId, userId), {
    role,
  });
export const deleteAdminTeamMember = (teamId: string, userId: string) =>
  request.delete<ResponseData<boolean>>(api.adminTeamMember(teamId, userId));
export const listManagedResources = (params: {
  type: AdminService.ManagedResourceType;
  page: number;
  pageSize: number;
  keywords?: string;
}) =>
  request.get<ResponseData<AdminService.ManagedResourceList>>(
    adminListManagedResources,
    { params },
  );
export const listFailedDocuments = (params: {
  page: number;
  pageSize: number;
  keywords?: string;
}) =>
  request.get<ResponseData<AdminService.FailedDocumentList>>(
    adminListFailedDocuments,
    { params },
  );
export const updateUserStatus = (email: string, status: 'on' | 'off') =>
  request.put(adminUpdateUserStatus(email), { activate_status: status });
export const updateUserPassword = (email: string, password: string) =>
  request.put(adminUpdateUserPassword(email), { new_password: password });
export const deleteUser = (email: string) =>
  request.delete(adminDeleteUser(email));

export const listServices = () =>
  request.get<ResponseData<AdminService.ListServicesItem[]>>(adminListServices);
export const getMonitoringSummary = () =>
  request.get<ResponseData<AdminService.MonitoringSummary>>(
    adminGetMonitoringSummary,
  );
export const showServiceDetails = (serviceId: number) =>
  request.get<ResponseData<AdminService.ServiceDetail>>(
    adminShowServiceDetails(String(serviceId)),
  );

export const createRole = (params: {
  roleName: string;
  description?: string;
}) =>
  request.post<ResponseData<AdminService.RoleDetail>>(adminCreateRole, params);
export const updateRoleDescription = (role: string, description: string) =>
  request.put<ResponseData<AdminService.RoleDetail>>(
    adminUpdateRoleDescription(role),
    { description },
  );
export const deleteRole = (role: string) =>
  request.delete<ResponseData<ResponseData<never>>>(adminDeleteRole(role));
export const listRoles = () =>
  request.get<
    ResponseData<{ roles: AdminService.ListRoleItem[]; total: number }>
  >(adminListRoles);
export const listRolesWithPermission = () =>
  request.get<
    ResponseData<{
      roles: AdminService.ListRoleItemWithPermission[];
      total: number;
    }>
  >(adminListRolesWithPermission);
export const getRolePermissions = (role: string) =>
  request.get<ResponseData<AdminService.RoleDetailWithPermission>>(
    adminGetRolePermissions(role),
  );
export const assignRolePermissions = (
  role: string,
  permissions: Partial<AdminService.AssignRolePermissionsInput>,
) =>
  request.post<ResponseData<never>>(adminAssignRolePermissions(role), {
    new_permissions: permissions,
  });
export const revokeRolePermissions = (
  role: string,
  permissions: Partial<AdminService.RevokeRolePermissionInput>,
) =>
  request.delete<ResponseData<never>>(adminRevokeRolePermissions(role), {
    data: { revoke_permissions: permissions },
  });

export const updateUserRole = (username: string, role: string) =>
  request.put<ResponseData<never>>(adminUpdateUserRole(username), {
    role_name: role,
  });
export const getUserPermissions = (username: string) =>
  request.get<ResponseData<AdminService.UserDetailWithPermission>>(
    adminGetUserPermissions(username),
  );
export const listResources = () =>
  request.get<ResponseData<AdminService.ResourceType>>(adminListResources);

export const listWhitelist = () =>
  request.get<
    ResponseData<{
      total: number;
      white_list: AdminService.ListWhitelistItem[];
    }>
  >(adminListWhitelist);

export const createWhitelistEntry = (email: string) =>
  request.post<ResponseData<never>>(adminCreateWhitelistEntry, { email });

export const updateWhitelistEntry = (id: number, email: string) =>
  request.put<ResponseData<never>>(adminUpdateWhitelistEntry(id), { email });

export const deleteWhitelistEntry = (email: string) =>
  request.delete<ResponseData<never>>(adminDeleteWhitelistEntry(email));

export const importWhitelistFromExcel = (file: File) => {
  const fd = new FormData();

  fd.append('file', file);

  return request.post<ResponseData<never>>(adminImportWhitelist, fd);
};

export const getSystemVersion = () =>
  request.get<ResponseData<{ version: string }>>(adminGetSystemVersion);

// Sandbox settings APIs
export const listSandboxProviders = () =>
  request.get<ResponseData<AdminService.SandboxProvider[]>>(
    adminListSandboxProviders,
  );

export const getSandboxProviderSchema = (providerId: string) =>
  request.get<ResponseData<Record<string, AdminService.SandboxConfigField>>>(
    adminGetSandboxProviderSchema(providerId),
  );

export const getSandboxConfig = () =>
  request.get<ResponseData<AdminService.SandboxConfig>>(adminGetSandboxConfig);

export const setSandboxConfig = (params: {
  providerType: string;
  config: Record<string, unknown>;
}) =>
  request.post<ResponseData<AdminService.SandboxConfig>>(
    adminSetSandboxConfig,
    {
      provider_type: params.providerType,
      config: params.config,
    },
  );

export const testSandboxConnection = (params: {
  providerType: string;
  config: Record<string, unknown>;
}) =>
  request.post<
    ResponseData<{
      success: boolean;
      message: string;
      details?: {
        exit_code: number;
        execution_time: number;
        stdout: string;
        stderr: string;
      };
    }>
  >(adminTestSandboxConnection, {
    provider_type: params.providerType,
    config: params.config,
  });
