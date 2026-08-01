import { buildMainOpenApiSpec } from '../main-openapi';

const labels = {
  title: '主站资源 API',
  description: '主站接口说明',
  team: '团队',
  dataset: '知识库',
  chat: '聊天',
  search: '搜索',
};

describe('buildMainOpenApiSpec', () => {
  it('replaces source English documentation with Chinese documentation', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/api/v1/datasets': {
          get: {
            summary: 'List datasets.',
            description: 'Returns datasets available to the current user.',
            responses: { 200: { description: 'Successful response' } },
          },
        },
      },
    };

    const operation = buildMainOpenApiSpec(source, labels).paths[
      '/api/v1/datasets'
    ].get;

    expect(operation.summary).toBe('列出知识库');
    expect(operation.description).toBe(
      '列出知识库。用于管理当前用户有权访问的知识库、文件、分块、元数据和索引。',
    );
    expect(operation.responses['200'].description).toBe('请求成功');
  });

  it('provides a Chinese replacement for deprecated endpoints', () => {
    const source = {
      paths: {
        '/api/v1/chats/{chat_id}/completions': {
          post: { responses: {} },
        },
      },
    };

    const operation = buildMainOpenApiSpec(source, labels).paths[
      '/api/v1/chats/{chat_id}/completions'
    ].post;

    expect(operation.deprecated).toBe(true);
    expect(operation.description).toBe(
      '该接口已废弃。请改用 POST /api/v1/chat/completions。',
    );
  });
});
