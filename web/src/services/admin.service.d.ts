declare namespace AdminService {
  export type LoginData = {
    access_token: string;
    avatar: unknown;
    color_schema: 'Bright' | 'Dark';
    create_date: string;
    create_time: number;
    email: string;
    id: string;
    is_active: '0' | '1';
    is_anonymous: '0' | '1';
    is_authenticated: '0' | '1';
    is_superuser: boolean;
    language: string;
    last_login_time: string;
    login_channel: unknown;
    nickname: string;
    password_plain: string;
    department_id?: string;
    department_path: string;
    password: string;
    status: '0' | '1';
    timezone: string;
    update_date: [string];
    update_time: [number];
  };

  export type Department = {
    id: string;
    name: string;
    parent_id?: string;
    path: string;
    user_count: number;
    created_at?: string;
    updated_at?: string;
  };

  export type TeamMemberRole = 'owner' | 'admin' | 'normal' | 'invite';

  export type Team = {
    id: string;
    name: string;
    owner_id: string;
    owner_email: string;
    owner_name: string;
    member_count: number;
    invite_count: number;
    dataset_count: number;
    document_count: number;
    storage_bytes: number;
    create_date: string;
    update_date: string;
  };

  export type TeamMember = {
    id: string;
    user_id: string;
    email: string;
    nickname: string;
    avatar?: string;
    role: TeamMemberRole;
    is_active: '0' | '1';
    is_superuser: boolean;
    update_date: string;
  };

  export type ListUsersItem = {
    id: string;
    create_date: string;
    last_login_time?: string;
    email: string;
    is_active: '0' | '1';
    is_superuser: boolean;
    role: string;
    nickname: string;
    password_plain: string;
    department_id?: string;
    department_path: string;
    teams_total: number;
    created_datasets: number;
    uploaded_documents: number;
    uploaded_storage_bytes: number;
  };

  export type UserDetail = {
    id: string;
    avatar?: string;
    create_date: string;
    email: string;
    nickname: string;
    password_plain: string;
    department_id?: string;
    department_path: string;
    remark?: string;
    is_active: '0' | '1';
    is_anonymous: '0' | '1';
    is_superuser: boolean;
    language: string;
    last_login_time: string;
    login_channel: unknown;
    status: '0' | '1';
    update_date: string;
    role: string;
  };

  export type ListUserDatasetItem = {
    avatar?: string;
    chunk_num: number;
    create_date: string;
    doc_num: number;
    language: string;
    name: string;
    permission: string;
    status: '0' | '1';
    token_num: number;
    update_date: string;
  };

  export type ListUserAgentItem = {
    avatar?: string;
    canvas_category: 'agent';
    permission: 'string';
    title: string;
  };

  export type ManagedResourceType =
    | 'dataset'
    | 'chat'
    | 'agent'
    | 'search'
    | 'memory'
    | 'file';

  export type ManagedResourceItem = {
    id: string;
    resource_type: ManagedResourceType;
    name: string;
    workspace_id: string;
    workspace_name: string;
    workspace_type: 'personal' | 'team';
    creator_id?: string;
    creator_name?: string;
    permission: 'me' | 'team';
    create_date: string;
    update_date: string;
    doc_num?: number;
    chunk_num?: number;
    token_num?: number;
    storage_bytes?: number;
    failed_documents?: number;
    processing_documents?: number;
    dataset_count?: number;
    document_count?: number;
    session_count?: number;
    release?: boolean;
    canvas_type?: string;
    memory_type?: number;
    storage_type?: string;
    memory_size?: number;
    size?: number;
    parent_id?: string;
    file_type?: string;
    source_type?: string;
    deletable: boolean;
  };

  export type ManagedResourceList = {
    resources: ManagedResourceItem[];
    total: number;
  };

  export type FailedDocumentItem = {
    id: string;
    name: string;
    dataset_id: string;
    dataset_name: string;
    workspace_id: string;
    workspace_name: string;
    workspace_type: 'personal' | 'team';
    failure_reason: string;
    size: number;
    create_date: string;
  };

  export type FailedDocumentList = {
    documents: FailedDocumentItem[];
    total: number;
  };

  export type TaskExecutorHeartbeatItem = {
    name: string;
    boot_at: string;
    now: string;
    ip_address: string;
    current: Record<string, object>;
    done: number;
    failed: number;
    lag: number;
    pending: number;
    pid: number;
  };

  export type TaskExecutorInfo = Record<string, TaskExecutorHeartbeatItem[]>;

  export type ListServicesItem = {
    extra: Record<string, unknown>;
    host: string;
    id: number;
    name: string;
    port: number;
    service_type: string;
    status: 'alive' | 'timeout' | 'fail';
  };

  export type ServiceDetail =
    | {
        service_name: string;
        status: 'alive' | 'timeout';
        message: string | Record<string, any> | Record<string, any>[];
      }
    | {
        service_name: 'task_executor';
        status: 'alive' | 'timeout';
        message: AdminService.TaskExecutorInfo;
      };

  export type MonitoringStorageItem = {
    workspace_id: string;
    workspace_name: string;
    workspace_type: 'personal' | 'team';
    datasets_total: number;
    documents_total: number;
    storage_bytes: number;
  };

  export type MonitoringSummary = {
    users_total: number;
    active_users: number;
    teams_total: number;
    datasets_total: number;
    documents_total: number;
    storage_bytes: number;
    failed_documents: number;
    processing_documents: number;
    pending_tasks: number;
    chats_total: number;
    agents_total: number;
    storage_distribution: MonitoringStorageItem[];
  };

  export type PermissionData = {
    enable: boolean;
    read: boolean;
    write: boolean;
    share: boolean;
  };

  export type ListRoleItem = {
    id: string;
    role_name: string;
    description: string;
    create_date: string;
    update_date: string;
  };

  export type ListRoleItemWithPermission = ListRoleItem & {
    permissions: Record<string, PermissionData>;
  };

  export type RoleDetailWithPermission = {
    role: {
      id: string;
      name: string;
      description: string;
    };
    permissions: Record<string, PermissionData>;
  };

  export type RoleDetail = {
    id: string;
    name: string;
    description: string;
    create_date: string;
    update_date: string;
  };

  export type AssignRolePermissionsInput = Record<
    string,
    Partial<PermissionData>
  >;
  export type RevokeRolePermissionInput = AssignRolePermissionsInput;

  export type UserDetailWithPermission = {
    user: {
      id: string;
      username: string;
      role: string;
    };
    role_permissions: Record<string, PermissionData>;
  };

  export type ResourceType = {
    resource_types: string[];
  };

  export type ListWhitelistItem = {
    id: number;
    email: string;
    create_date: string;
    create_time: number;
    update_date: string;
    update_time: number;
  };

  // Sandbox settings types
  export type SandboxProvider = {
    id: string;
    name: string;
    description: string;
    tags: string[];
  };

  export type SandboxConfigFieldBase = {
    required?: boolean;
    label?: string;
    placeholder?: string;
    description?: string;
    multiline?: boolean;
    readonly?: boolean;
    scope?: 'runtime' | 'deployment';
  };

  export type SandboxConfigStringField = SandboxConfigFieldBase & {
    type: 'string';
    default?: string;
    secret?: boolean;
  };

  export type SandboxConfigIntegerField = SandboxConfigFieldBase & {
    type: 'integer';
    default?: number;
    min?: number;
    max?: number;
  };

  export type SandboxConfigBooleanField = SandboxConfigFieldBase & {
    type: 'boolean';
    default?: boolean;
  };

  export type SandboxConfigJsonField = SandboxConfigFieldBase & {
    type: 'json';
    default?: unknown;
  };

  export type SandboxConfigField =
    | SandboxConfigStringField
    | SandboxConfigIntegerField
    | SandboxConfigBooleanField
    | SandboxConfigJsonField;

  export type SandboxConfig = {
    provider_type: string;
    config: Record<string, unknown>;
  };
}
