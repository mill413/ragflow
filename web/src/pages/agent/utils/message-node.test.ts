import { Operator } from '@/constants/agent';
import { getEmptyMessageNodeNames, isEmptyMessageContent } from './message-node';

describe('Message node content validation', () => {
  test('treats missing and blank-only content as empty', () => {
    expect(isEmptyMessageContent()).toBe(true);
    expect(isEmptyMessageContent([])).toBe(true);
    expect(isEmptyMessageContent(['', '  '])).toBe(true);
    expect(isEmptyMessageContent(['hello'])).toBe(false);
  });

  test('returns only empty Message node names', () => {
    const nodes = [
      {
        id: 'message-empty',
        data: {
          label: Operator.Message,
          name: 'Empty message',
          form: { content: [''] },
        },
      },
      {
        id: 'message-valid',
        data: {
          label: Operator.Message,
          name: 'Valid message',
          form: { content: ['ok'] },
        },
      },
    ];

    expect(getEmptyMessageNodeNames(nodes as any)).toEqual(['Empty message']);
  });
});
