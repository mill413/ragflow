import { AgentFormContext } from '@/pages/agent/context';
import { Operator } from '@/pages/agent/constant';
import useGraphStore from '@/pages/agent/store';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { useUpdateAgentNodeTools } from './use-update-tools';

const mockReactRuntime = React;
(globalThis as any).React = mockReactRuntime;

jest.mock('@/locales/config', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  DEFAULT_LANGUAGE_CODE: 'en',
}));

jest.mock('@/pages/agent/constant', () => ({
  Operator: new Proxy({}, { get: (_target, key) => String(key) }),
  NodeHandleId: new Proxy({}, { get: (_target, key) => String(key) }),
  SwitchElseTo: 'switch_else',
}));

jest.mock('@/pages/agent/store', () => {
  let state: any = { nodes: [], edges: [] };
  const actions = {
    generateAgentToolId: (value: string) => `${value}:0`,
    updateNodeForm: (nodeId: string, value: unknown, path: string[]) => {
      const node = state.nodes.find((item: any) => item.id === nodeId);
      if (node && path[0] === 'tools') node.data.form.tools = value;
    },
  };
  const useStore: any = (selector: (value: any) => unknown) =>
    selector({ ...state, ...actions });
  useStore.setState = (next: any) => {
    state = { ...state, ...next };
  };
  useStore.getState = () => ({ ...state, ...actions });
  return { __esModule: true, default: useStore };
});

// The initial-values hook pulls in the whole operator-params catalog; the
// params payload is irrelevant to duplicate-guard behavior.
jest.mock('@/pages/agent/hooks/use-agent-tool-initial-values', () => ({
  useAgentToolInitialValues: () => ({
    initializeAgentToolValues: () => ({}),
  }),
}));

type Tool = {
  component_name: string;
  name: string;
  params: object;
  id?: string;
};

const agentNode = (tools: Tool[]) =>
  ({
    id: 'agent:0',
    type: 'ragNode',
    position: { x: 0, y: 0 },
    data: { label: Operator.Agent, name: 'agent:0', form: { tools } },
  }) as any;

function seedStore(tools: Tool[]) {
  useGraphStore.setState({ nodes: [agentNode(tools)], edges: [] });
}

// Mirror the real tree: the context node always comes from the live store,
// so a toggle re-reads the tools written by the previous toggle.
function Wrapper({ children }: any) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === 'agent:0'));
  return React.createElement(
    AgentFormContext.Provider,
    { value: node as any },
    children,
  );
}

const currentTools = () =>
  (useGraphStore.getState().nodes[0].data.form as any).tools as Tool[];

describe('useUpdateAgentNodeTools (creation-time duplicate guard)', () => {
  beforeEach(() => seedStore([]));

  const renderTools = () =>
    renderHook(() => useUpdateAgentNodeTools(), { wrapper: Wrapper });

  it('adds a tool that is not present yet, named after the component', () => {
    const { result } = renderTools();
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    expect(currentTools().map((x) => x.component_name)).toEqual([
      Operator.Retrieval,
    ]);
    expect(currentTools()[0].name).toBe(Operator.Retrieval);
  });

  it('selecting an already-added tool removes it instead of appending a duplicate', () => {
    seedStore([
      { component_name: Operator.Retrieval, name: Operator.Retrieval, params: {} },
    ]);
    const { result } = renderTools();
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    expect(currentTools()).toEqual([]);
  });

  it('never holds two copies of the same tool, Retrieval included', () => {
    const { result } = renderTools();
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    // A second select toggles it off — previously this appended a second
    // Retrieval tool, which later crashed the Go runtime with
    // "duplicate agent tool name \"search_my_dateset\"".
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    const copies = currentTools().filter(
      (x) => x.component_name === Operator.Retrieval,
    );
    expect(copies).toHaveLength(1);
  });

  it('cleans up a legacy canvas that already carries duplicates', () => {
    seedStore([
      { component_name: Operator.Retrieval, name: 'Retrieval', params: {} },
      { component_name: Operator.Retrieval, name: 'Retrieval_0', params: {} },
    ]);
    const { result } = renderTools();
    act(() => result.current.updateNodeTools(Operator.Retrieval));
    expect(
      currentTools().filter((x) => x.component_name === Operator.Retrieval),
    ).toHaveLength(0);
  });
});
