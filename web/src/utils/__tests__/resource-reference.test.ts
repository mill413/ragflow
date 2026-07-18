jest.mock('@/locales/config', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: { resource?: string; defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'message.resourceInUse': '无法删除：资源正在被引用',
        'message.resourceReferenceTarget': '{{resource}} 被以下资源引用：',
        'message.resourceTypes.compilationTemplate': '知识编译模板',
        'message.resourceTypes.dataset': '知识库',
        'message.resourceTypes.agent': '智能体',
      };
      return (translations[key] || options?.defaultValue || key).replace(
        '{{resource}}',
        options?.resource || '',
      );
    },
  },
}));

import { formatResourceReferenceConflict } from '@/utils/resource-reference';

describe('formatResourceReferenceConflict', () => {
  it('lists the exact target and every referring resource', () => {
    const conflict = formatResourceReferenceConflict({
      code: 409,
      data: {
        reason: 'resource_in_use',
        targets: [
          {
            resource_type: 'compilation_template',
            resource_id: 'template-1',
            resource_name: '合同编译模板',
          },
        ],
        references: [
          {
            resource_type: 'dataset',
            resource_id: 'dataset-1',
            resource_name: '合同知识库',
            target_resource_id: 'template-1',
          },
          {
            resource_type: 'agent',
            resource_id: 'agent-1',
            resource_name: '合同助手',
            target_resource_id: 'template-1',
          },
        ],
      },
    });

    expect(conflict).toEqual({
      title: '无法删除：资源正在被引用',
      description:
        '知识编译模板「合同编译模板」 被以下资源引用：\n' +
        '• 知识库「合同知识库」\n' +
        '• 智能体「合同助手」',
    });
  });

  it('does not replace unrelated errors', () => {
    expect(
      formatResourceReferenceConflict({
        code: 500,
        data: { reason: 'server_error', references: [] },
      }),
    ).toBeUndefined();
  });
});
