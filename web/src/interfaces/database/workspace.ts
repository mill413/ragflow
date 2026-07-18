export interface IWorkspaceCapabilities {
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface IWorkspace {
  tenant_id: string;
  name: string;
  role?: string;
  workspace_type: 'personal' | 'team';
  capabilities: IWorkspaceCapabilities & {
    create_knowledgebase?: boolean;
    create_shared_resource?: boolean;
    manage_members?: boolean;
  };
}

export interface IWorkspaceResource {
  workspace_type?: 'personal' | 'team';
  workspace_name?: string;
  creator_name?: string;
  capabilities?: IWorkspaceCapabilities;
}
