import { AgentCategory } from '@/constants/agent';
import { IPipeLineListRequest } from '@/interfaces/database/agent';

export function buildWorkspaceDataFlowQuery(workspaceId: string): {
  params: IPipeLineListRequest;
  enabled: boolean;
} {
  return {
    params: {
      canvas_category: AgentCategory.DataflowCanvas,
      owner_ids: workspaceId,
    },
    enabled: Boolean(workspaceId),
  };
}
