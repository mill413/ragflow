export interface IWorkspaceCapabilities {
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface IWorkspaceQuota {
  file_count_limit: number | null;
  storage_bytes_limit: number | null;
  file_count_used: number;
  storage_bytes_used: number;
}

export interface IWorkspace {
  tenant_id: string;
  name: string;
  role?: string;
  workspace_type: 'personal' | 'team';
  quota: IWorkspaceQuota;
  capabilities: IWorkspaceCapabilities & {
    create_knowledgebase?: boolean;
    create_shared_resource?: boolean;
    create_collaborative_resource?: boolean;
    manage_members?: boolean;
  };
}

export interface IWorkspaceResource {
  workspace_type?: 'personal' | 'team';
  workspace_name?: string;
  creator_name?: string;
  capabilities?: IWorkspaceCapabilities;
}
