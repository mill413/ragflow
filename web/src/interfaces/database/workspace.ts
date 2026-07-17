export interface IWorkspaceCapabilities {
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface IWorkspaceResource {
  workspace_type?: 'personal' | 'team';
  workspace_name?: string;
  capabilities?: IWorkspaceCapabilities;
}
