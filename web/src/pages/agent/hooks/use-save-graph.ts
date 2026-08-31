import {
  useFetchAgent,
  useResetAgent,
  useSetAgent,
} from '@/hooks/use-agent-request';
import message from '@/components/ui/message';
import {
  GlobalVariableType,
  RAGFlowNodeType,
} from '@/interfaces/database/agent';
import { formatDate } from '@/utils/date';
import { useDebounceEffect } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import useGraphStore from '../store';
import { findAgentNodeWithoutModel } from '../utils/agent-node-model';
import { getEmptyMessageNodeNames } from '../utils/message-node';
import { useBuildDslData } from './use-build-dsl';

export const useSaveGraph = (showMessage: boolean = true) => {
  const { data } = useFetchAgent();
  const { setAgent, loading } = useSetAgent(showMessage);
  const { id } = useParams();
  const { buildDslData } = useBuildDslData();
  const { t } = useTranslation();

  const saveGraph = useCallback(
    async (
      currentNodes?: RAGFlowNodeType[],
      otherParam?: {
        globalVariables: Record<string, GlobalVariableType>;
      },
      release?: boolean,
    ) => {
      const nodes = currentNodes ?? useGraphStore.getState().nodes;
      const agentWithoutModel = findAgentNodeWithoutModel(nodes);
      if (agentWithoutModel) {
        if (showMessage) {
          message.warning(
            t('flow.agentModelMissing', {
              name: agentWithoutModel.data?.name,
            }),
          );
        }
        return;
      }

      if (showMessage) {
        const emptyMessageNodeNames = getEmptyMessageNodeNames(nodes);
        if (emptyMessageNodeNames.length > 0) {
          message.warning(
            `${emptyMessageNodeNames.join(', ')}: ${t('flow.messageMsg')}`,
          );
        }
      }

      const params: Record<string, any> = {
        id,
        title: data.title,
        dsl: buildDslData(currentNodes, otherParam),
      };

      if (release) {
        params.release = 'true';
      }

      return setAgent(params);
    },
    [setAgent, data, id, buildDslData, showMessage, t],
  );

  return { saveGraph, loading };
};

export const useSaveGraphBeforeOpeningDebugDrawer = (show: () => void) => {
  const { saveGraph, loading } = useSaveGraph();
  const { resetAgent } = useResetAgent();

  const handleRun = useCallback(
    async (nextNodes?: RAGFlowNodeType[]) => {
      const saveRet = await saveGraph(nextNodes);
      if (saveRet?.code === 0) {
        // Call the reset api before opening the run drawer each time
        const resetRet = await resetAgent();
        // After resetting, all previous messages will be cleared.
        if (resetRet?.code === 0) {
          show();
        }
      }
    },
    [saveGraph, resetAgent, show],
  );

  return { handleRun, loading };
};

export const useWatchAgentChange = (chatDrawerVisible: boolean) => {
  const [time, setTime] = useState<string>();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const { saveGraph } = useSaveGraph(false);
  const { data: flowDetail } = useFetchAgent();

  const setSaveTime = useCallback((updateTime: number) => {
    setTime(formatDate(updateTime));
  }, []);

  useEffect(() => {
    setSaveTime(flowDetail?.update_time);
  }, [flowDetail, setSaveTime]);

  const saveAgent = useCallback(async () => {
    if (!chatDrawerVisible) {
      const ret = await saveGraph();
      setSaveTime(ret.data.update_time);
    }
  }, [chatDrawerVisible, saveGraph, setSaveTime]);

  useDebounceEffect(
    () => {
      saveAgent();
    },
    [nodes, edges],
    {
      wait: 1000 * 20,
    },
  );

  return time;
};
