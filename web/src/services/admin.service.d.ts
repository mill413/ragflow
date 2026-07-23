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

  export type ResourceQuota = {
    file_count_limit: number | null;
    storage_bytes_limit: number | null;
    team_count_limit: number | null;
    dataset_count_limit: number | null;
    chat_count_limit: number | null;
    search_count_limit: number | null;
    agent_count_limit: number | null;
    memory_count_limit: number | null;
    file_count_used: number;
    storage_bytes_used: number;
    team_count_used: number;
    dataset_count_used: number;
    chat_count_used: number;
    search_count_used: number;
    agent_count_used: number;
    memory_count_used: number;
  };

  export type ResourceQuotaLimits = Pick<
    ResourceQuota,
    | 'file_count_limit'
    | 'storage_bytes_limit'
    | 'team_count_limit'
    | 'dataset_count_limit'
    | 'chat_count_limit'
    | 'search_count_limit'
    | 'agent_count_limit'
    | 'memory_count_limit'
  >;

  export type ResourceQuotaScopeType = 'personal' | 'team' | 'dataset';

  export type ResourceQuotaItem = ResourceQuota & {
    scope_type: ResourceQuotaScopeType;
    scope_id: string;
    name: string;
    workspace_id: string;
    workspace_name: string;
    workspace_type?: 'personal' | 'team';
    email?: string;
  };

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
    quota: ResourceQuota;
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
    quota: ResourceQuota;
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
    web_session_count?: number;
    api_session_count?: number;
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
    quota?: ResourceQuota;
  };

  export type UserModelConfig = {
    id: string;
    name: string;
    provider_name: string;
    instance_name: string;
    api_key: string;
    base_url: string;
    model_types: string[];
    features?: string[];
    max_tokens: number;
    status: 'active' | 'inactive';
    create_date: string;
    update_date: string;
  };

  export type UserDefaultModelConfig = {
    model_type: string;
    model_name: string;
    model_id: string;
  };

  export type UserModelConfiguration = {
    defaults: UserDefaultModelConfig[];
    models: UserModelConfig[];
  };

  export type WorkspaceResourceMap = Record<
    ManagedResourceType,
    ManagedResourceItem[]
  > & {
    model: UserModelConfiguration;
  };

  export type ManagedResourceList = {
    resources: ManagedResourceItem[];
    total: number;
  };

  export type DatasetDocumentDetail = {
    id: string;
    file_id?: string;
    name: string;
    creator_id?: string;
    creator_name?: string;
    file_type?: string;
    suffix?: string;
    source_type?: string;
    size: number;
    parser_id?: string;
    pipeline_id?: string;
    parser_config?: Record<string, unknown>;
    chunk_num: number;
    token_num: number;
    progress: number;
    progress_msg?: string;
    process_begin_at?: string;
    process_duration?: number;
    run?: string;
    parse_status: 'pending' | 'processing' | 'completed' | 'failed';
    create_date: string;
    update_date: string;
  };

  export type DatasetResourceDetail = ManagedResourceItem & {
    description?: string;
    language?: string;
    embd_id?: string;
    parser_id?: string;
    pipeline_id?: string;
    parser_config?: Record<string, unknown>;
    pagerank?: number;
    similarity_threshold?: number;
    vector_similarity_weight?: number;
  };

  export type DatasetResourceDetailResponse = {
    dataset: DatasetResourceDetail;
    documents: DatasetDocumentDetail[];
    document_total: number;
  };

  export type StandardManagedResourceDetail = ManagedResourceItem & {
    description?: string;
    language?: string;
    llm_id?: string;
    rerank_id?: string;
    prompt_type?: string;
    similarity_threshold?: number;
    vector_similarity_weight?: number;
    top_n?: number;
    top_k?: number;
    do_refer?: string;
    canvas_category?: string;
    tags?: string;
    embd_id?: string;
    forgetting_policy?: string;
    location?: string;
  };

  export type RelatedManagedResource = {
    resource_type: ManagedResourceType;
    id: string;
    name: string;
    detail?: string;
  };

  export type StandardManagedResourceDetailResponse = {
    resource: StandardManagedResourceDetail;
    configuration: Record<string, unknown>;
    related_resources: RelatedManagedResource[];
  };

  export type ManagedChatSessionSource = 'web' | 'chatbot' | 'openai';

  export type ManagedChatSession = {
    id: string;
    name?: string;
    source: ManagedChatSessionSource;
    user_id?: string;
    external_user_id?: string;
    actor_id?: string;
    actor_name?: string;
    message_count: number;
    round?: number;
    tokens?: number;
    duration?: number;
    errors?: string;
    create_date?: string;
    update_date?: string;
  };

  export type ManagedChatMessage = {
    id?: string;
    role: string;
    content: unknown;
    reasoning_content?: unknown;
    created_at?: number;
  };

  export type ManagedChatSessionDetail = ManagedChatSession & {
    messages: ManagedChatMessage[];
    references: unknown[];
  };

  export type ManagedChatSessionList = {
    sessions: ManagedChatSession[];
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

  export type ModelWorkspace = {
    id: string;
    name: string;
    type: 'personal' | 'team';
  };

  export type ManagedModel = {
    id: string;
    name: string;
    provider_name: string;
    provider_id: string;
    owner_workspace_id: string;
    owner_workspace_name: string;
    owner_workspace: ModelWorkspace;
    instance_name: string;
    instance_id: string;
    api_key: string;
    base_url: string;
    model_types: string[];
    features?: string[];
    max_tokens: number;
    status: 'active' | 'inactive';
    source: 'shared' | 'private';
    visibility: 'all' | 'selected' | 'private';
    workspace_ids: string[];
    workspaces: ModelWorkspace[];
    created_by: string;
    create_date: string;
    update_date: string;
    provider_config?: {
      vision?: boolean;
      mineru_output_dir?: string;
      mineru_backend?: string;
      mineru_server_url?: string;
      mineru_delete_output?: boolean;
    };
  };

  export type ManagedModelInput = {
    provider_name: string;
    instance_name: string;
    model_name: string;
    api_key: string;
    base_url: string;
    model_types: string[];
    features?: string[];
    max_tokens: number;
    status?: 'active' | 'inactive';
    visibility: 'all' | 'selected';
    workspace_ids: string[];
    provider_config?: {
      vision?: boolean;
      mineru_output_dir?: string;
      mineru_backend?: string;
      mineru_server_url?: string;
      mineru_delete_output?: boolean;
    };
  };

  export type ManagedModelVerification = {
    valid: boolean;
    message: string;
    results: Record<string, number>;
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
    files_total: number;
    storage_bytes: number;
  };

  export type MonitoringSummary = {
    users_total: number;
    active_users: number;
    teams_total: number;
    datasets_total: number;
    documents_total: number;
    storage_bytes: number;
    files_total: number;
    files_storage_bytes: number;
    failed_documents: number;
    processing_documents: number;
    pending_tasks: number;
    chats_total: number;
    searches_total: number;
    agents_total: number;
    memories_total: number;
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
