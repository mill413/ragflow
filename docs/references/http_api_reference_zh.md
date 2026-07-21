# RAGFlow HTTP API 中文参考

本文档面向当前二次开发版本，列出可用的 HTTP API、认证方式、通用响应结构和常见调用示例。

## 快速开始

### 服务地址

以下示例假设 RAGFlow 服务地址为：

```text
http://127.0.0.1:18082
```

API 基础路径为：

```text
/api/v1
```

### API Token 认证

除健康检查等公开接口外，请在请求头中携带 API Token：

```http
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

API Token 与创建时选择的个人或团队工作空间绑定，只能访问该工作空间中的资源。团队 Token 不绑定签发用户，团队 owner 发生转移后 Token 仍然有效。

### 通用请求示例

```bash
curl --request GET \
  --url 'http://127.0.0.1:18082/api/v1/datasets?page=1&page_size=20' \
  --header 'Authorization: Bearer <API_TOKEN>'
```

### 通用响应结构

大多数接口返回以下 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | 整数 | `0` 表示成功，其他值表示失败 |
| `message` | 字符串 | 执行结果或错误信息 |
| `data` | 任意 | 接口返回的数据 |

### 常见状态码

| HTTP 状态码 | 说明 |
| --- | --- |
| `200` | 请求成功，业务结果仍需检查响应中的 `code` |
| `400` | 请求参数错误 |
| `401` | 未认证或 Token 无效 |
| `403` | 无权访问目标工作空间或资源 |
| `404` | 资源不存在 |
| `500` | 服务端错误 |

## OpenAI 兼容接口

### 对话补全

`POST /api/v1/openai/{chat_id}/chat/completions`

使用指定聊天助手，以 OpenAI Chat Completions 兼容格式生成回答。

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/openai/<CHAT_ID>/chat/completions' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "model",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### 智能体补全

`POST /api/v1/agents_openai/{agent_id}/chat/completions`

使用指定智能体，以 OpenAI Chat Completions 兼容格式执行任务。

## 知识库管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 创建知识库 | `POST /api/v1/datasets` | 创建个人或团队知识库；团队 Token 自动限定到绑定团队 |
| 批量删除知识库 | `DELETE /api/v1/datasets` | 请求体通过 `ids` 指定知识库 ID 列表 |
| 更新知识库 | `PUT /api/v1/datasets/{dataset_id}` | 更新名称、描述、解析配置、嵌入模型等 |
| 查询知识库列表 | `GET /api/v1/datasets` | 支持分页、排序、名称和 ID 筛选 |
| 获取知识图谱 | `GET /api/v1/datasets/{dataset_id}/knowledge_graph` | 返回知识库的知识图谱 |
| 删除知识图谱 | `DELETE /api/v1/datasets/{dataset_id}/knowledge_graph` | 删除已构建的知识图谱 |
| 构建知识图谱 | `POST /api/v1/datasets/{dataset_id}/run_graphrag` | 启动 GraphRAG 构建任务 |
| 查询知识图谱任务 | `GET /api/v1/datasets/{dataset_id}/trace_graphrag` | 查询 GraphRAG 构建进度和结果 |
| 构建 RAPTOR | `POST /api/v1/datasets/{dataset_id}/run_raptor` | 启动 RAPTOR 构建任务 |
| 查询 RAPTOR 任务 | `GET /api/v1/datasets/{dataset_id}/trace_raptor` | 查询 RAPTOR 构建进度和结果 |

### 创建知识库示例

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/datasets' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "制度资料库",
    "description": "制度和流程文档",
    "chunk_method": "naive",
    "embedding_model": "<EMBEDDING_MODEL>"
  }'
```

### 查询知识库参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` | 整数 | 页码，从 `1` 开始 |
| `page_size` | 整数 | 每页数量 |
| `orderby` | 字符串 | 排序字段 |
| `desc` | 布尔值 | 是否倒序 |
| `name` | 字符串 | 按名称筛选 |
| `id` | 字符串 | 按知识库 ID 筛选 |
| `include_parsing_status` | 布尔值 | 是否返回解析状态统计 |

## 文档管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 上传文档 | `POST /api/v1/datasets/{dataset_id}/documents` | 使用 `multipart/form-data` 上传一个或多个文件 |
| 更新文档 | `PUT /api/v1/datasets/{dataset_id}/documents/{document_id}` | 更新文档名称、元数据或解析配置 |
| 下载文档 | `GET /api/v1/datasets/{dataset_id}/documents/{document_id}` | 下载原始文件 |
| 查询文档列表 | `GET /api/v1/datasets/{dataset_id}/documents` | 支持分页、关键词、后缀、状态和时间范围筛选 |
| 批量删除文档 | `DELETE /api/v1/datasets/{dataset_id}/documents` | 请求体通过 `ids` 指定文档 ID 列表 |
| 启动解析 | `POST /api/v1/datasets/{dataset_id}/chunks` | 请求体通过 `document_ids` 指定待解析文档 |
| 直接摄取文档 | `POST /api/v1/documents/ingest` | 上传并执行摄取流程 |
| 停止解析 | `DELETE /api/v1/datasets/{dataset_id}/chunks` | 停止指定文档的解析任务 |

### 上传文档示例

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/datasets/<DATASET_ID>/documents' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --form 'file=@/path/to/document.pdf'
```

### 查询文档参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page`、`page_size` | 整数 | 分页参数 |
| `orderby`、`desc` | 字符串、布尔值 | 排序字段和方向 |
| `keywords` | 字符串 | 搜索文档名称 |
| `id` | 字符串 | 文档 ID |
| `name` | 字符串 | 文档名称 |
| `suffix` | 字符串 | 文件扩展名 |
| `run` | 字符串 | 解析运行状态 |
| `create_time_from`、`create_time_to` | Unix 时间戳 | 创建时间范围 |
| `metadata_condition` | JSON 字符串 | 元数据筛选条件 |

## 分块管理与检索

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 新增分块 | `POST /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks` | 手动向文档添加分块 |
| 查询分块列表 | `GET /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks` | 支持关键词、ID 和分页筛选 |
| 获取分块 | `GET /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` | 获取单个分块详情 |
| 批量删除分块 | `DELETE /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks` | 请求体通过 `chunk_ids` 指定分块 |
| 更新分块 | `PATCH /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` | 更新分块内容、关键词等 |
| 更新分块可用状态 | `PATCH /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks` | 批量启用或禁用分块 |
| 获取元数据摘要 | `GET /api/v1/datasets/{dataset_id}/metadata/summary` | 汇总知识库文档元数据 |
| 更新或删除元数据 | `POST /api/v1/datasets/{dataset_id}/metadata/update` | 批量更新元数据字段 |
| 检索分块 | `POST /api/v1/retrieval` | 在一个或多个知识库中执行检索 |

### 检索示例

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/retrieval' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "question": "公司的请假流程是什么？",
    "dataset_ids": ["<DATASET_ID>"],
    "page": 1,
    "page_size": 10,
    "similarity_threshold": 0.2,
    "vector_similarity_weight": 0.3
  }'
```

## 聊天助手管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 创建聊天助手 | `POST /api/v1/chats` | 创建聊天助手并关联知识库 |
| 完整更新聊天助手 | `PUT /api/v1/chats/{chat_id}` | 替换聊天助手配置 |
| 获取聊天助手 | `GET /api/v1/chats/{chat_id}` | 获取聊天助手详情 |
| 局部更新聊天助手 | `PATCH /api/v1/chats/{chat_id}` | 更新指定配置字段 |
| 删除聊天助手 | `DELETE /api/v1/chats/{chat_id}` | 删除单个聊天助手 |
| 批量删除聊天助手 | `DELETE /api/v1/chats` | 请求体通过 `ids` 指定聊天助手 |
| 查询聊天助手列表 | `GET /api/v1/chats` | 支持分页、排序、名称和所有者筛选 |
| 创建会话 | `POST /api/v1/chats/{chat_id}/sessions` | 为聊天助手创建会话 |
| 更新会话 | `PATCH /api/v1/chats/{chat_id}/sessions/{session_id}` | 更新会话名称等信息 |
| 查询会话列表 | `GET /api/v1/chats/{chat_id}/sessions` | 查询聊天助手的会话 |
| 获取会话 | `GET /api/v1/chats/{chat_id}/sessions/{session_id}` | 获取会话及消息详情 |
| 删除消息 | `DELETE /api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}` | 删除指定消息 |
| 提交消息反馈 | `PUT /api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback` | 设置点赞、点踩或反馈内容 |
| 批量删除会话 | `DELETE /api/v1/chats/{chat_id}/sessions` | 删除指定会话 |
| 发起聊天 | `POST /api/v1/chat/completions` | 与聊天助手进行普通或流式对话 |

### 创建聊天助手示例

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/chats' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "制度问答助手",
    "dataset_ids": ["<DATASET_ID>"],
    "llm": {"model_name": "<CHAT_MODEL>"},
    "prompt": {"opener": "您好，请问需要查询什么制度？"}
  }'
```

### 发起聊天示例

```bash
curl --request POST \
  --url 'http://127.0.0.1:18082/api/v1/chat/completions' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "chat_id": "<CHAT_ID>",
    "question": "请介绍报销流程",
    "stream": false
  }'
```

## 智能体管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 查询智能体列表 | `GET /api/v1/agents` | 支持分页、排序、名称和 ID 筛选 |
| 创建智能体 | `POST /api/v1/agents` | 使用 DSL 创建智能体 |
| 更新智能体 | `PUT /api/v1/agents/{agent_id}` | 更新智能体名称、描述、DSL 等 |
| 删除智能体 | `DELETE /api/v1/agents/{agent_id}` | 删除智能体 |
| 创建智能体会话 | `POST /api/v1/agents/{agent_id}/sessions` | 创建智能体运行会话 |
| 与智能体对话 | `POST /api/v1/agents/chat/completions` | 执行智能体，支持流式返回 |
| 查询智能体会话 | `GET /api/v1/agents/{agent_id}/sessions` | 支持分页、用户和 DSL 筛选 |
| 删除智能体会话 | `DELETE /api/v1/agents/{agent_id}/sessions` | 批量删除会话 |
| 文本转语音 | `POST /api/v1/chat/audio/speech` | 将文本转换为音频 |
| 语音转文本 | `POST /api/v1/chat/audio/transcription` | 将音频转换为文本 |
| 生成思维导图 | `POST /api/v1/chat/mindmap` | 根据文本生成思维导图 |
| 生成相关问题 | `POST /api/v1/chat/recommandation` | 根据上下文推荐相关问题 |

## 记忆管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 创建记忆 | `POST /api/v1/memories` | 创建记忆库 |
| 更新记忆 | `PUT /api/v1/memories/{memory_id}` | 更新记忆配置 |
| 查询记忆列表 | `GET /api/v1/memories` | 支持类型、存储方式、关键词和分页筛选 |
| 获取记忆配置 | `GET /api/v1/memories/{memory_id}/config` | 获取记忆库配置 |
| 删除记忆 | `DELETE /api/v1/memories/{memory_id}` | 删除记忆库 |
| 查询记忆消息 | `GET /api/v1/memories/{memory_id}` | 查询指定记忆库中的消息 |
| 添加消息 | `POST /api/v1/messages` | 向记忆库添加消息 |
| 遗忘消息 | `DELETE /api/v1/messages/{memory_id}:{message_id}` | 标记或删除记忆消息 |
| 更新消息状态 | `PUT /api/v1/messages/{memory_id}:{message_id}` | 更新消息状态 |
| 搜索消息 | `GET /api/v1/messages/search` | 按问题和相似度搜索记忆 |
| 获取最近消息 | `GET /api/v1/messages` | 按记忆、智能体和会话获取最近消息 |
| 获取消息内容 | `GET /api/v1/messages/{memory_id}:{message_id}/content` | 获取完整消息内容 |

## 文件管理

文件接口只返回当前 API Token 所绑定工作空间内有权访问的文件。

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 上传文件 | `POST /api/v1/files` | 使用表单上传文件 |
| 上传并创建文档 | `POST /api/v1/documents/upload` | 上传文件并转换为知识库文档 |
| 下载智能体附件 | `GET /api/v1/agents/attachments/{attachment_id}/download` | 下载智能体会话附件 |
| 创建文件夹 | `POST /api/v1/files` | 使用 JSON 请求创建文件夹 |
| 查询文件列表 | `GET /api/v1/files` | 按父目录、关键词、分页和排序查询 |
| 获取父目录 | `GET /api/v1/files/{file_id}/parent` | 获取直接父目录 |
| 获取祖先目录 | `GET /api/v1/files/{file_id}/ancestors` | 获取完整目录路径 |
| 批量删除文件 | `DELETE /api/v1/files` | 请求体通过 `file_ids` 指定文件 |
| 下载文件 | `GET /api/v1/files/{file_id}` | 下载文件内容 |
| 移动或重命名 | `POST /api/v1/files/move` | 移动文件或修改名称 |
| 关联知识库 | `POST /api/v1/files/link-to-datasets` | 将文件关联到知识库并转换为文档 |

## 文件版本管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 创建提交 | `POST /api/v1/folders/{folder_id}/commits` | 为目录创建版本提交 |
| 查询提交列表 | `GET /api/v1/folders/{folder_id}/commits` | 查询目录提交历史 |
| 获取提交 | `GET /api/v1/folders/{folder_id}/commits/{commit_id}` | 获取提交详情 |
| 查询提交文件 | `GET /api/v1/folders/{folder_id}/commits/{commit_id}/files` | 查询某次提交包含的文件 |
| 比较提交 | `GET /api/v1/folders/{folder_id}/commits/diff` | 使用 `from` 和 `to` 比较两个提交 |
| 获取未提交变更 | `GET /api/v1/folders/{folder_id}/changes` | 查询当前目录变更 |
| 获取提交目录树 | `GET /api/v1/folders/{folder_id}/commits/{commit_id}/tree` | 获取某次提交的目录树 |
| 获取历史文件内容 | `GET /api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content` | 获取提交中的文件内容 |
| 获取文件版本历史 | `GET /api/v1/files/{file_id}/versions` | 查询文件的历史版本 |

## 搜索应用管理

| 功能 | 方法和路径 | 说明 |
| --- | --- | --- |
| 创建搜索应用 | `POST /api/v1/searches` | 创建并配置搜索应用 |
| 查询搜索应用 | `GET /api/v1/searches` | 支持关键词、所有者、分页和排序筛选 |
| 获取搜索应用 | `GET /api/v1/searches/{search_id}` | 获取搜索应用详情 |
| 更新搜索应用 | `PUT /api/v1/searches/{search_id}` | 更新搜索应用配置 |
| 删除搜索应用 | `DELETE /api/v1/searches/{search_id}` | 删除搜索应用 |
| 执行搜索 | `POST /api/v1/searches/{search_id}/completions` | 使用搜索应用检索并生成回答 |

## 系统接口

### 健康检查

`GET /api/v1/system/healthz`

检查数据库、缓存、对象存储和检索引擎等依赖是否可用。

```bash
curl --request GET \
  --url 'http://127.0.0.1:18082/api/v1/system/healthz'
```

## 分页和排序约定

支持列表查询的接口通常使用以下参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `page` | `1` | 页码，从 `1` 开始 |
| `page_size` | 接口默认值 | 每页记录数 |
| `orderby` | `create_time` | 排序字段 |
| `desc` | `true` | `true` 为倒序，`false` 为正序 |
| `keywords` | 空字符串 | 模糊搜索关键词 |

## 工作空间权限说明

- 个人 API Token 只能访问对应个人工作空间。
- 团队 API Token 只能访问对应团队工作空间。
- 团队普通成员不能签发团队 API Token。
- 团队 owner、管理员和超级管理员可以签发团队 API Token。
- API Token 不能通过请求参数切换到其他工作空间。
- 资源 ID 属于其他工作空间时，接口应返回无权限或资源不存在。

## 调用注意事项

- 文件上传接口使用 `multipart/form-data`，其他写接口通常使用 `application/json`。
- 流式接口会返回 Server-Sent Events，请逐行处理 `data:` 消息。
- 删除和批量修改操作执行前应确认资源 ID 与 Token 工作空间一致。
- 模型、知识库、聊天、智能体、搜索和记忆之间的引用必须位于同一工作空间。
- 具体请求字段会随功能演进，以当前服务返回的参数校验错误为准。
