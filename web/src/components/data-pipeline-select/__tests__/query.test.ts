import { AgentCategory } from '@/constants/agent';
import { buildWorkspaceDataFlowQuery } from '../query';

describe('buildWorkspaceDataFlowQuery', () => {
  it('limits DataFlows to the selected workspace', () => {
    expect(buildWorkspaceDataFlowQuery('team-1')).toEqual({
      params: {
        canvas_category: AgentCategory.DataflowCanvas,
        owner_ids: 'team-1',
      },
      enabled: true,
    });
  });

  it('does not query all visible workspaces before the workspace loads', () => {
    expect(buildWorkspaceDataFlowQuery('')).toEqual({
      params: {
        canvas_category: AgentCategory.DataflowCanvas,
        owner_ids: '',
      },
      enabled: false,
    });
  });
});
