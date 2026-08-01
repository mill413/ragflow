type OpenApiDocument = Record<string, any>;

export type MainApiGroupLabels = {
  title: string;
  description: string;
  team: string;
  dataset: string;
  chat: string;
  search: string;
};

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const GROUPS = [
  { key: 'team', prefixes: ['/api/v1/teams'] },
  { key: 'dataset', prefixes: ['/api/v1/datasets'] },
  {
    key: 'chat',
    prefixes: [
      '/api/v1/chats',
      '/api/v1/chat',
      '/api/v1/chatbots',
      '/api/v1/openai',
    ],
  },
  {
    key: 'search',
    prefixes: ['/api/v1/searches', '/api/v1/searchbots'],
  },
] as const;

const objectSchema = (
  properties: Record<string, any>,
  required: string[] = [],
) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: true,
});

function cloneOpenApiValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const REQUEST_SCHEMAS: Record<string, Record<string, any>> = {
  'post /api/v1/teams': objectSchema(
    { name: { type: 'string', description: '团队名称' } },
    ['name'],
  ),
  'patch /api/v1/teams/{team_id}': objectSchema(
    { name: { type: 'string', description: '新的团队名称' } },
    ['name'],
  ),
  'post /api/v1/teams/{team_id}/invitations': objectSchema(
    { email: { type: 'string', format: 'email', description: '受邀用户邮箱' } },
    ['email'],
  ),
  'patch /api/v1/teams/{team_id}/members/{user_id}': objectSchema({
    role: {
      type: 'string',
      enum: ['admin', 'member'],
      description: '成员角色；转移所有权时无需填写',
    },
    transfer_ownership: {
      type: 'boolean',
      description: '是否将团队所有权转移给该成员',
    },
  }),
  'post /api/v1/datasets': objectSchema(
    {
      name: { type: 'string', description: '知识库名称' },
      workspace_id: { type: 'string', description: '所属工作空间 ID' },
      avatar: { type: 'string', description: 'Base64 编码的图标' },
      description: { type: 'string' },
      embedding_model: { type: 'string', description: '嵌入模型名称' },
      chunk_method: { type: 'string', description: '分块方法标识' },
      parser_config: { type: 'object', additionalProperties: true },
    },
    ['name'],
  ),
  'delete /api/v1/datasets': objectSchema({
    ids: { type: 'array', items: { type: 'string' } },
    delete_all: { type: 'boolean' },
  }),
  'put /api/v1/datasets/{dataset_id}': objectSchema({
    name: { type: 'string' },
    avatar: { type: 'string' },
    description: { type: 'string' },
    embedding_model: { type: 'string' },
    chunk_method: { type: 'string' },
    parser_config: { type: 'object', additionalProperties: true },
  }),
  'delete /api/v1/datasets/{dataset_id}/documents': objectSchema({
    ids: { type: 'array', items: { type: 'string' } },
    delete_all: { type: 'boolean' },
  }),
  'post /api/v1/datasets/{dataset_id}/documents/parse': objectSchema(
    {
      document_ids: { type: 'array', items: { type: 'string' } },
      apply_kb_config: { type: 'boolean' },
    },
    ['document_ids'],
  ),
  'post /api/v1/datasets/{dataset_id}/documents/stop': objectSchema(
    { document_ids: { type: 'array', items: { type: 'string' } } },
    ['document_ids'],
  ),
  'post /api/v1/datasets/search': objectSchema(
    {
      dataset_ids: { type: 'array', items: { type: 'string' } },
      question: { type: 'string' },
      doc_ids: { type: 'array', items: { type: 'string' } },
      top_k: { type: 'integer' },
      similarity_threshold: { type: 'number' },
      vector_similarity_weight: { type: 'number' },
    },
    ['dataset_ids', 'question'],
  ),
  'post /api/v1/datasets/{dataset_id}/search': objectSchema(
    {
      question: { type: 'string' },
      doc_ids: { type: 'array', items: { type: 'string' } },
      top_k: { type: 'integer' },
      similarity_threshold: { type: 'number' },
      vector_similarity_weight: { type: 'number' },
    },
    ['question'],
  ),
  'post /api/v1/chats': objectSchema(
    {
      name: { type: 'string', description: '聊天应用名称' },
      workspace_id: { type: 'string', description: '所属工作空间 ID' },
      description: { type: 'string' },
      dataset_ids: { type: 'array', items: { type: 'string' } },
      llm_id: { type: 'string' },
      rerank_id: { type: 'string' },
      prompt_config: { type: 'object', additionalProperties: true },
      llm_setting: { type: 'object', additionalProperties: true },
    },
    ['name'],
  ),
  'delete /api/v1/chats': objectSchema({
    ids: { type: 'array', items: { type: 'string' } },
    delete_all: { type: 'boolean' },
  }),
  'put /api/v1/chats/{chat_id}': objectSchema({
    name: { type: 'string' },
    description: { type: 'string' },
    dataset_ids: { type: 'array', items: { type: 'string' } },
    llm_id: { type: 'string' },
    rerank_id: { type: 'string' },
    prompt_config: { type: 'object', additionalProperties: true },
    llm_setting: { type: 'object', additionalProperties: true },
  }),
  'patch /api/v1/chats/{chat_id}': objectSchema({
    name: { type: 'string' },
    description: { type: 'string' },
    dataset_ids: { type: 'array', items: { type: 'string' } },
    llm_id: { type: 'string' },
    rerank_id: { type: 'string' },
    prompt_config: { type: 'object', additionalProperties: true },
    llm_setting: { type: 'object', additionalProperties: true },
  }),
  'post /api/v1/chats/{chat_id}/prompt/optimize': objectSchema(
    {
      prompt: { type: 'string' },
      llm_id: { type: 'string' },
      tenant_llm_id: { type: 'string' },
    },
    ['prompt'],
  ),
  'post /api/v1/chats/{chat_id}/sessions': objectSchema({
    name: { type: 'string', default: 'New session' },
  }),
  'patch /api/v1/chats/{chat_id}/sessions/{session_id}': objectSchema({
    name: { type: 'string' },
  }),
  'delete /api/v1/chats/{chat_id}/sessions': objectSchema({
    ids: { type: 'array', items: { type: 'string' } },
    delete_all: { type: 'boolean' },
  }),
  'put /api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback':
    objectSchema(
      {
        thumbup: { type: 'boolean' },
        feedback: { type: 'string' },
      },
      ['thumbup'],
    ),
  'post /api/v1/searches': objectSchema(
    {
      name: { type: 'string', description: '搜索应用名称' },
      workspace_id: { type: 'string', description: '所属工作空间 ID' },
      description: { type: 'string' },
      search_config: { type: 'object', additionalProperties: true },
    },
    ['name'],
  ),
  'put /api/v1/searches/{search_id}': objectSchema(
    {
      name: { type: 'string' },
      description: { type: 'string' },
      search_config: { type: 'object', additionalProperties: true },
    },
    ['name', 'search_config'],
  ),
  'post /api/v1/searches/{search_id}/completion': objectSchema(
    {
      question: { type: 'string' },
      kb_ids: { type: 'array', items: { type: 'string' } },
    },
    ['question'],
  ),
  'post /api/v1/searches/{search_id}/completions': objectSchema(
    {
      question: { type: 'string' },
      kb_ids: { type: 'array', items: { type: 'string' } },
    },
    ['question'],
  ),
};

const OPERATION_SUMMARIES: Record<string, string> = {
  'post /api/v1/chat/audio/speech': '将文字转换为语音',
  'post /api/v1/chat/audio/transcription': '将语音转换为文字',
  'post /api/v1/chat/completions': '发送聊天消息',
  'post /api/v1/chat/mindmap': '生成聊天思维导图',
  'post /api/v1/chat/recommendation': '生成聊天推荐问题',
  'post /api/v1/chatbots/{dialog_id}/completions': '调用聊天应用',
  'get /api/v1/chatbots/{dialog_id}/info': '获取聊天应用输入配置',
  'delete /api/v1/chats': '批量删除聊天应用',
  'get /api/v1/chats': '列出聊天应用',
  'post /api/v1/chats': '创建聊天应用',
  'delete /api/v1/chats/{chat_id}': '删除聊天应用',
  'get /api/v1/chats/{chat_id}': '获取聊天应用详情',
  'patch /api/v1/chats/{chat_id}': '部分更新聊天应用',
  'put /api/v1/chats/{chat_id}': '更新聊天应用',
  'post /api/v1/chats/{chat_id}/completions': '调用聊天应用（已废弃）',
  'post /api/v1/chats/{chat_id}/prompt/optimize': '优化聊天提示词',
  'delete /api/v1/chats/{chat_id}/sessions': '批量删除聊天会话',
  'get /api/v1/chats/{chat_id}/sessions': '列出聊天会话',
  'post /api/v1/chats/{chat_id}/sessions': '创建聊天会话',
  'get /api/v1/chats/{chat_id}/sessions/{session_id}': '获取聊天会话详情',
  'patch /api/v1/chats/{chat_id}/sessions/{session_id}': '更新聊天会话',
  'put /api/v1/chats/{chat_id}/sessions/{session_id}': '更新聊天会话（已废弃）',
  'delete /api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}':
    '删除聊天消息',
  'put /api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback':
    '提交聊天消息反馈',
  'post /api/v1/openai/{chat_id}/chat/completions':
    '使用 OpenAI 兼容格式调用聊天应用',

  'delete /api/v1/datasets': '批量删除知识库',
  'get /api/v1/datasets': '列出知识库',
  'post /api/v1/datasets': '创建知识库',
  'get /api/v1/datasets/metadata/flattened': '获取知识库扁平化元数据',
  'post /api/v1/datasets/search': '跨知识库检索测试',
  'get /api/v1/datasets/tags/aggregation': '聚合知识库标签',
  'get /api/v1/datasets/{dataset_id}': '获取知识库详情',
  'put /api/v1/datasets/{dataset_id}': '更新知识库配置',
  'get /api/v1/datasets/{dataset_id}/any_artifact':
    '检查知识库是否包含编译产物',
  'get /api/v1/datasets/{dataset_id}/any_skill': '检查知识库是否包含技能树',
  'delete /api/v1/datasets/{dataset_id}/artifacts': '清空知识库编译产物',
  'get /api/v1/datasets/{dataset_id}/artifacts': '列出知识库编译产物',
  'get /api/v1/datasets/{dataset_id}/artifacts/graph':
    '获取知识库编译产物关系图',
  'get /api/v1/datasets/{dataset_id}/artifacts_topics': '列出知识库编译主题',
  'delete /api/v1/datasets/{dataset_id}/chunks': '停止知识库分块任务',
  'post /api/v1/datasets/{dataset_id}/chunks': '启动知识库分块任务',
  'delete /api/v1/datasets/{dataset_id}/documents': '批量删除知识库文件',
  'get /api/v1/datasets/{dataset_id}/documents': '列出知识库文件',
  'post /api/v1/datasets/{dataset_id}/documents': '上传知识库文件',
  'post /api/v1/datasets/{dataset_id}/documents/batch-update-status':
    '批量更新知识库文件状态',
  'patch /api/v1/datasets/{dataset_id}/documents/metadatas':
    '批量更新文件元数据',
  'post /api/v1/datasets/{dataset_id}/documents/parse': '批量解析知识库文件',
  'post /api/v1/datasets/{dataset_id}/documents/stop': '停止知识库文件解析',
  'get /api/v1/datasets/{dataset_id}/documents/{document_id}': '下载知识库文件',
  'patch /api/v1/datasets/{dataset_id}/documents/{document_id}':
    '更新知识库文件',
  'put /api/v1/datasets/{dataset_id}/documents/{document_id}':
    '更新知识库文件（已废弃）',
  'delete /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks':
    '批量删除文件分块',
  'get /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks':
    '列出文件分块',
  'patch /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks':
    '批量更新文件分块状态',
  'post /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks':
    '新增文件分块',
  'get /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}':
    '获取文件分块详情',
  'patch /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}':
    '更新文件分块',
  'put /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}':
    '更新文件分块（已废弃）',
  'put /api/v1/datasets/{dataset_id}/documents/{document_id}/metadata/config':
    '更新文件元数据配置',
  'delete /api/v1/datasets/{dataset_id}/documents/{document_id}/structure/graph':
    '删除文件结构图',
  'get /api/v1/datasets/{dataset_id}/documents/{document_id}/structure/graph':
    '获取文件结构图',
  'post /api/v1/datasets/{dataset_id}/embedding/check': '检查嵌入模型兼容性',
  'get /api/v1/datasets/{dataset_id}/graph': '获取知识图谱',
  'delete /api/v1/datasets/{dataset_id}/index': '删除知识库索引',
  'get /api/v1/datasets/{dataset_id}/index': '查看知识库索引进度',
  'post /api/v1/datasets/{dataset_id}/index': '构建知识库索引',
  'get /api/v1/datasets/{dataset_id}/ingestions': '列出知识处理日志',
  'get /api/v1/datasets/{dataset_id}/ingestions/summary': '获取知识处理汇总',
  'get /api/v1/datasets/{dataset_id}/ingestions/{log_id}':
    '获取知识处理日志详情',
  'delete /api/v1/datasets/{dataset_id}/knowledge_graph':
    '删除知识图谱（已废弃）',
  'get /api/v1/datasets/{dataset_id}/knowledge_graph': '获取知识图谱（已废弃）',
  'get /api/v1/datasets/{dataset_id}/metadata/config': '获取自动元数据配置',
  'put /api/v1/datasets/{dataset_id}/metadata/config': '更新自动元数据配置',
  'get /api/v1/datasets/{dataset_id}/metadata/summary': '获取知识库元数据汇总',
  'post /api/v1/datasets/{dataset_id}/metadata/update': '批量更新知识库元数据',
  'post /api/v1/datasets/{dataset_id}/run_graphrag':
    '构建 GraphRAG 索引（已废弃）',
  'post /api/v1/datasets/{dataset_id}/run_raptor': '构建 RAPTOR 索引（已废弃）',
  'post /api/v1/datasets/{dataset_id}/search': '知识库检索测试',
  'get /api/v1/datasets/{dataset_id}/skills': '获取知识库技能树',
  'delete /api/v1/datasets/{dataset_id}/tags': '删除知识库标签',
  'get /api/v1/datasets/{dataset_id}/tags': '列出知识库标签',
  'put /api/v1/datasets/{dataset_id}/tags': '重命名知识库标签',
  'get /api/v1/datasets/{dataset_id}/trace_graphrag':
    '查看 GraphRAG 进度（已废弃）',
  'get /api/v1/datasets/{dataset_id}/trace_raptor':
    '查看 RAPTOR 进度（已废弃）',
  'delete /api/v1/datasets/{dataset_id}/{index_type}':
    '删除指定类型的知识库索引',
  'get /api/v1/datasets/{entity_id}/changes': '获取知识库未提交变更',
  'get /api/v1/datasets/{entity_id}/commits': '列出知识库版本提交',
  'post /api/v1/datasets/{entity_id}/commits': '创建知识库版本提交',
  'get /api/v1/datasets/{entity_id}/commits/diff': '比较知识库版本提交',
  'get /api/v1/datasets/{entity_id}/commits/{commit_id}':
    '获取知识库版本提交详情',
  'get /api/v1/datasets/{entity_id}/commits/{commit_id}/files':
    '列出知识库版本文件',
  'get /api/v1/datasets/{entity_id}/commits/{commit_id}/files/{file_id}/content':
    '获取知识库版本文件内容',
  'get /api/v1/datasets/{entity_id}/commits/{commit_id}/tree':
    '获取知识库版本目录树',
  'get /api/v1/datasets/{skill_kwd}': '获取知识库技能页面',
  'get /api/v1/datasets/{slug}': '获取知识库编译页面',
  'put /api/v1/datasets/{slug}': '更新知识库编译页面',

  'post /api/v1/searchbots/ask': '调用嵌入式搜索',
  'get /api/v1/searchbots/detail': '获取嵌入式搜索配置',
  'post /api/v1/searchbots/mindmap': '生成搜索结果思维导图',
  'post /api/v1/searchbots/related_questions': '生成搜索相关问题',
  'post /api/v1/searchbots/retrieval_test': '执行嵌入式检索测试',
  'get /api/v1/searches': '列出搜索应用',
  'post /api/v1/searches': '创建搜索应用',
  'delete /api/v1/searches/{search_id}': '删除搜索应用',
  'get /api/v1/searches/{search_id}': '获取搜索应用详情',
  'put /api/v1/searches/{search_id}': '更新搜索应用',
  'post /api/v1/searches/{search_id}/completion': '调用搜索应用',
  'post /api/v1/searches/{search_id}/completions': '调用搜索应用',

  'get /api/v1/teams': '列出团队',
  'post /api/v1/teams': '创建团队',
  'get /api/v1/teams/invitations': '列出团队邀请',
  'delete /api/v1/teams/{team_id}': '删除团队',
  'get /api/v1/teams/{team_id}': '获取团队详情',
  'patch /api/v1/teams/{team_id}': '更新团队信息',
  'post /api/v1/teams/{team_id}/invitations': '邀请团队成员',
  'post /api/v1/teams/{team_id}/invitations/accept': '接受团队邀请',
  'get /api/v1/teams/{team_id}/members': '列出团队成员',
  'delete /api/v1/teams/{team_id}/members/{user_id}': '移除团队成员',
  'patch /api/v1/teams/{team_id}/members/{user_id}': '更新团队成员角色',
};

const GROUP_DESCRIPTIONS = {
  team: '用于管理当前用户有权访问的团队、邀请和成员。',
  dataset: '用于管理当前用户有权访问的知识库、文件、分块、元数据和索引。',
  chat: '用于管理或调用当前用户有权访问的聊天应用及其会话。',
  search: '用于管理或调用当前用户有权访问的搜索应用。',
} as const;

const DEPRECATED_REPLACEMENTS: Record<string, string> = {
  'post /api/v1/chats/{chat_id}/completions':
    '请改用 POST /api/v1/chat/completions。',
  'put /api/v1/chats/{chat_id}/sessions/{session_id}':
    '请改用 PATCH /api/v1/chats/{chat_id}/sessions/{session_id}。',
  'put /api/v1/datasets/{dataset_id}/documents/{document_id}':
    '请改用 PATCH /api/v1/datasets/{dataset_id}/documents/{document_id}。',
  'put /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}':
    '请改用 PATCH /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}。',
  'delete /api/v1/datasets/{dataset_id}/knowledge_graph':
    '请改用 DELETE /api/v1/datasets/{dataset_id}/graph。',
  'get /api/v1/datasets/{dataset_id}/knowledge_graph':
    '请改用 GET /api/v1/datasets/{dataset_id}/graph。',
  'post /api/v1/datasets/{dataset_id}/run_graphrag':
    '请改用 POST /api/v1/datasets/{dataset_id}/index?type=graph。',
  'post /api/v1/datasets/{dataset_id}/run_raptor':
    '请改用 POST /api/v1/datasets/{dataset_id}/index?type=raptor。',
  'get /api/v1/datasets/{dataset_id}/trace_graphrag':
    '请改用 GET /api/v1/datasets/{dataset_id}/index?type=graph。',
  'get /api/v1/datasets/{dataset_id}/trace_raptor':
    '请改用 GET /api/v1/datasets/{dataset_id}/index?type=raptor。',
};

const RESPONSE_DESCRIPTIONS: Record<string, string> = {
  '200': '请求成功',
  '201': '资源创建成功',
  '204': '请求成功，无响应内容',
  '400': '请求参数错误',
  '401': '未登录或凭证无效',
  '403': '没有操作权限',
  '404': '资源不存在',
  '409': '资源状态冲突',
  '422': '请求内容无法处理',
  '500': '服务器内部错误',
  default: '请求已处理',
};

const findGroup = (path: string) =>
  GROUPS.find(({ prefixes }) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );

const operationId = (method: string, path: string) =>
  `${method}_${path}`
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export function buildMainOpenApiSpec(
  source: OpenApiDocument,
  labels: MainApiGroupLabels,
) {
  const paths: Record<string, any> = {};

  for (const [path, sourcePathItem] of Object.entries(source.paths || {})) {
    const group = findGroup(path);
    if (!group) continue;

    const pathItem: Record<string, any> = {};
    for (const [method, sourceOperation] of Object.entries(
      sourcePathItem as Record<string, any>,
    )) {
      if (!HTTP_METHODS.has(method)) {
        pathItem[method] = sourceOperation;
        continue;
      }

      const operation = cloneOpenApiValue(sourceOperation);
      const documentationKey = `${method} ${path}`;
      const summary =
        OPERATION_SUMMARIES[documentationKey] ||
        `${labels[group.key]}接口：${method.toUpperCase()} ${path}`;
      operation.tags = [labels[group.key]];
      operation.summary = summary;
      operation.description = `${summary}。${GROUP_DESCRIPTIONS[group.key]}`;
      if (DEPRECATED_REPLACEMENTS[documentationKey]) {
        operation.deprecated = true;
        operation.description = `该接口已废弃。${DEPRECATED_REPLACEMENTS[documentationKey]}`;
      }
      operation.operationId = operationId(method, path);
      operation.security = [{ BearerAuth: [] }];
      if (!Object.keys(operation.responses || {}).length) {
        operation.responses = {
          200: { description: RESPONSE_DESCRIPTIONS['200'] },
        };
      } else {
        for (const [status, response] of Object.entries(operation.responses)) {
          (response as Record<string, any>).description =
            RESPONSE_DESCRIPTIONS[status] || RESPONSE_DESCRIPTIONS.default;
        }
      }

      const requestSchema = REQUEST_SCHEMAS[`${method} ${path}`];
      if (requestSchema) {
        operation.requestBody = {
          required: true,
          content: { 'application/json': { schema: requestSchema } },
        };
      } else if (
        method === 'post' &&
        path === '/api/v1/datasets/{dataset_id}/documents'
      ) {
        operation.requestBody = {
          required: true,
          content: {
            'multipart/form-data': {
              schema: objectSchema(
                {
                  file: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                  parent_path: { type: 'string' },
                },
                ['file'],
              ),
            },
          },
        };
      }
      pathItem[method] = operation;
    }
    paths[path] = pathItem;
  }

  return {
    ...source,
    info: {
      ...(source.info || {}),
      title: labels.title,
      description: labels.description,
    },
    tags: GROUPS.map(({ key }) => ({ name: labels[key] })),
    paths,
    components: {
      ...(source.components || {}),
      securitySchemes: {
        ...(source.components?.securitySchemes || {}),
        BearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
  };
}
