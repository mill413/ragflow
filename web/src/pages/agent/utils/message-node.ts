import { Operator } from '@/constants/agent';
import { RAGFlowNodeType } from '@/interfaces/database/agent';

export function isEmptyMessageContent(content?: unknown): boolean {
  return (
    !Array.isArray(content) ||
    !content.some((item) => typeof item === 'string' && item.trim() !== '')
  );
}

export function getEmptyMessageNodeNames(nodes: RAGFlowNodeType[]): string[] {
  return nodes
    .filter(
      (node) =>
        node.data?.label === Operator.Message &&
        isEmptyMessageContent(node.data?.form?.content),
    )
    .map((node) => node.data?.name ?? node.id);
}
