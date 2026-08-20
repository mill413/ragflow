---
sidebar_position: 4
slug: /http_api_reference
sidebar_custom_props: { categoryIcon: LucideGlobe }
---

# HTTP API 参考

本文档适用于当前基于 RAGFlow `0.26.4` 的二次开发版本，介绍可供外部程序调用的 RESTful API。除特别说明外，接口路径均以 `/api/v1` 开头，请求和响应使用 JSON。

## 请求地址

将示例中的 `{address}` 替换为实际部署地址：

```text
http://{address}/api/v1
```

如果服务通过 HTTPS 或反向代理发布，请使用对外提供的完整地址。

## 身份认证

在个人中心的 **API** 页面创建 API Token。创建时需要选择 Token 所属的工作空间；Token 与该工作空间绑定，只能访问同一工作空间中的资源，不能跨个人或团队工作空间使用。

通过 `Authorization` 请求头携带 Token：

```http
Authorization: Bearer <API_TOKEN>
```

示例：

```bash
curl --request GET \
     --url 'http://{address}/api/v1/datasets' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

除 `Bearer` 格式外，服务端目前也兼容直接在 `Authorization` 请求头中传入 Token，但新接入应统一使用标准的 `Bearer` 格式。

## 工作空间范围

- 个人 Token 只能访问对应的个人工作空间。
- 团队 Token 只能访问对应的团队工作空间。
- 创建团队 Token 需要具备该团队共享资源的管理权限。
- 请求参数或请求体中的 `workspace_id`、`tenant_id`、`owner_tenant_id` 如果与 Token 所属工作空间不一致，服务端将拒绝请求。
- 资源 ID 对应的资源不在 Token 所属工作空间时，即使 ID 有效，也不能通过该 Token 访问。

## 通用响应结构

大多数接口返回以下结构：

```json
{
  "code": 0,
  "data": {},
  "message": ""
}
```

| 字段      | 类型           | 说明                                                      |
| --------- | -------------- | --------------------------------------------------------- |
| `code`    | `integer`      | 业务状态码，`0` 表示成功，其他值表示失败或非完成状态      |
| `data`    | 任意 JSON 类型 | 接口返回的数据；失败时可能为 `false`、`null` 或错误上下文 |
| `message` | `string`       | 状态说明或错误信息                                        |

下载、预览、流式对话和健康检查等接口可能返回文件流、SSE 数据或专用结构，应以对应章节的说明为准。

> 调用方应优先检查响应体中的 `code`，不能只根据 HTTP 状态码判断业务是否成功。部分业务校验失败仍可能使用 HTTP `200` 返回，并通过响应体中的非零 `code` 表示错误。

---
## 错误码

接口的业务状态通过响应体中的 `code` 字段表示。HTTP 状态码通常用于表示认证失败、路由不存在等协议层错误，但并非所有业务错误都会映射为对应的 HTTP 状态码。

### 业务状态码

| `code` | 名称                   | 说明                                             |
| -----: | ---------------------- | ------------------------------------------------ |
|    `0` | `SUCCESS`              | 请求成功                                         |
|   `10` | `NOT_EFFECTIVE`        | 操作未生效，或当前状态不允许执行该操作           |
|  `100` | `EXCEPTION_ERROR`      | 请求处理过程中发生异常                           |
|  `101` | `ARGUMENT_ERROR`       | 请求参数缺失、格式错误或取值无效                 |
|  `102` | `DATA_ERROR`           | 目标数据不存在、数据状态异常或业务数据校验失败   |
|  `103` | `OPERATING_ERROR`      | 业务操作执行失败                                 |
|  `105` | `CONNECTION_ERROR`     | 依赖服务、模型服务或外部连接不可用               |
|  `106` | `RUNNING`              | 任务仍在运行，尚未产生最终结果                   |
|  `108` | `PERMISSION_ERROR`     | 当前账号不具备所需权限                           |
|  `109` | `AUTHENTICATION_ERROR` | 身份、Token 或资源访问校验失败                   |
|  `400` | `BAD_REQUEST`          | 请求内容不合法                                   |
|  `401` | `UNAUTHORIZED`         | 未提供认证信息，或认证信息无效                   |
|  `403` | `FORBIDDEN`            | 已完成身份认证，但无权访问目标工作空间或资源     |
|  `404` | `NOT_FOUND`            | 接口路径或目标资源不存在                         |
|  `409` | `CONFLICT`             | 当前操作与资源状态冲突，例如资源仍被其他对象引用 |
|  `500` | `SERVER_ERROR`         | 服务端处理失败                                   |

原文中的 `1001` 和 `1002` 不属于当前版本的统一状态码定义，因此不再作为通用错误码列出。具体接口仍可能在 `message` 或 `data` 中返回更详细的错误原因。

### 错误响应示例

```json
{
  "code": 403,
  "data": null,
  "message": "API token cannot access another workspace."
}
```

### 调用方处理建议

1. 首先判断 HTTP 请求是否成功到达服务端。
2. 对 JSON 响应继续检查 `code` 是否为 `0`。
3. 对 `106` 等非最终状态按照对应接口约定继续轮询。
4. 将 `message` 用于日志和故障定位，不要依赖完整英文文本编写业务分支。
5. 遇到 `401` 或 `109` 时检查 Token；遇到 `403` 或 `108` 时检查 Token 所属工作空间及资源权限。

---
## 已废弃的 API 别名

当前版本仍注册以下历史接口，以便已有调用逐步迁移。兼容层接收这些旧路径并在服务端记录警告日志，但不保证旧接口与替代接口长期保持完全一致，因此不应继续用于新接入。

### 聊天与智能体

| 已废弃接口                                                   | 替代接口                                                  | 迁移说明                             |
| ------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------ |
| **POST** `/api/v1/chats/{chat_id}/completions`               | **POST** `/api/v1/chat/completions`                       | 使用当前聊天补全接口                 |
| **POST** `/api/v1/chats_openai/{chat_id}/chat/completions`   | **POST** `/api/v1/openai/{chat_id}/chat/completions`      | 使用当前 OpenAI 兼容接口             |
| **POST** `/api/v1/agents/{agent_id}/completions`             | **POST** `/api/v1/agents/chat/completions`                | 使用当前智能体补全接口               |
| **POST** `/api/v1/agents_openai/{agent_id}/chat/completions` | **POST** `/api/v1/agents/chat/completions`                | 请求中设置 `openai-compatible: true` |
| **PUT** `/api/v1/chats/{chat_id}/sessions/{session_id}`      | **PATCH** `/api/v1/chats/{chat_id}/sessions/{session_id}` | 请求体保持不变，修改 HTTP 方法       |
| **POST** `/api/v1/sessions/related_questions`                | **POST** `/api/v1/chat/recommendation`                    | 使用当前相关问题生成接口             |

### 知识库、索引与文档

| 已废弃接口                                                                        | 替代接口                                                                            | 迁移说明                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------- |
| **GET** `/api/v1/datasets/{dataset_id}/knowledge_graph`                           | **GET** `/api/v1/datasets/{dataset_id}/graph`                                       | 获取知识图谱              |
| **DELETE** `/api/v1/datasets/{dataset_id}/knowledge_graph`                        | **DELETE** `/api/v1/datasets/{dataset_id}/graph`                                    | 删除知识图谱              |
| **POST** `/api/v1/datasets/{dataset_id}/run_graphrag`                             | **POST** `/api/v1/datasets/{dataset_id}/index?type=graph`                           | 启动知识图谱构建          |
| **GET** `/api/v1/datasets/{dataset_id}/trace_graphrag`                            | **GET** `/api/v1/datasets/{dataset_id}/index?type=graph`                            | 查询知识图谱构建状态      |
| **POST** `/api/v1/datasets/{dataset_id}/run_raptor`                               | **POST** `/api/v1/datasets/{dataset_id}/index?type=raptor`                          | 启动 RAPTOR 构建          |
| **GET** `/api/v1/datasets/{dataset_id}/trace_raptor`                              | **GET** `/api/v1/datasets/{dataset_id}/index?type=raptor`                           | 查询 RAPTOR 构建状态      |
| **PUT** `/api/v1/datasets/{dataset_id}/documents/{document_id}`                   | **PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}`                   | 修改 HTTP 方法            |
| **PUT** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` | **PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` | 修改 HTTP 方法            |
| **POST** `/api/v1/file/upload_info`                                               | **POST** `/api/v1/documents/upload`                                                 | 使用当前文档上传信息接口  |
| **POST** `/v1/document/upload_info`                                               | **POST** `/api/v1/documents/upload`                                                 | 同时迁移到 `/api/v1` 前缀 |
| **GET** `/api/v1/document/get/{document_id}`                                      | **GET** `/api/v1/documents/{document_id}/preview`                                   | 使用当前文档预览接口      |
| **GET** `/api/v1/document/download/{document_id}`                                 | **GET** `/api/v1/agents/attachments/{document_id}/download`                         | 使用当前附件下载接口      |
| **GET** `/v1/document/download/{attachment_id}`                                   | **GET** `/api/v1/agents/attachments/{attachment_id}/download`                       | 同时迁移到 `/api/v1` 前缀 |

### 文件管理

| 已废弃接口                                                 | 替代接口                                    | 迁移说明                            |
| ---------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| **POST** `/api/v1/file/upload`                             | **POST** `/api/v1/files`                    | 使用 `multipart/form-data` 上传文件 |
| **POST** `/api/v1/file/create`                             | **POST** `/api/v1/files`                    | 通过请求体区分创建文件夹和上传文件  |
| **GET** `/api/v1/file/list`                                | **GET** `/api/v1/files`                     | 查询参数迁移到新接口                |
| **GET** `/api/v1/file/root_folder`                         | **GET** `/api/v1/files`                     | 使用合适的 `parent_id` 查询根目录   |
| **GET** `/api/v1/file/parent_folder?file_id={file_id}`     | **GET** `/api/v1/files/{file_id}/parent`    | 将 `file_id` 从查询参数移到路径参数 |
| **GET** `/api/v1/file/all_parent_folder?file_id={file_id}` | **GET** `/api/v1/files/{file_id}/ancestors` | 将 `file_id` 从查询参数移到路径参数 |
| **GET** `/api/v1/file/get/{file_id}`                       | **GET** `/api/v1/files/{file_id}`           | 使用当前文件获取接口                |
| **POST** `/api/v1/file/rm`                                 | **DELETE** `/api/v1/files`                  | 请求体使用 `ids` 指定待删除文件     |
| **POST** `/api/v1/file/mv`                                 | **POST** `/api/v1/files/move`               | 使用 `src_file_ids` 和目标目录参数  |
| **POST** `/api/v1/file/rename`                             | **POST** `/api/v1/files/move`               | 使用 `src_file_ids` 和 `new_name`   |
| **POST** `/api/v1/file/convert`                            | **POST** `/api/v1/files/link-to-datasets`   | 将文件关联到知识库并转换为文档      |

### 系统接口

| 已废弃接口                   | 替代接口                         | 迁移说明                    |
| ---------------------------- | -------------------------------- | --------------------------- |
| **GET** `/v1/system/healthz` | **GET** `/api/v1/system/healthz` | 迁移到统一的 `/api/v1` 前缀 |

> 兼容接口只用于迁移现有调用。后续版本可能删除这些别名，客户端应尽快切换到替代接口。

---
## 团队管理

本章介绍团队的创建、查询、删除和成员管理接口。团队是独立的工作空间，团队成员角色包括：

| 角色 | 值 | 说明 |
| --- | --- | --- |
| 所有者 | `owner` | 管理团队和成员，并且可以删除团队 |
| 管理员 | `admin` | 管理团队和普通成员，但不能删除团队或移除所有者 |
| 普通成员 | `normal` | 访问团队资源，可以主动退出团队 |
| 待接受邀请 | `invite` | 已收到邀请但尚未成为正式成员 |

团队接口均需要身份认证。普通用户只能查询自己已经加入的团队；超级管理员可以查询和管理所有团队。

团队对象中的常用字段如下。部分响应还可能包含该工作空间的默认模型和解析器配置。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tenant_id` | `string` | 团队及其工作空间的唯一 ID |
| `name` | `string` | 团队名称 |
| `role` | `string` | 当前调用用户在团队中的角色 |
| `workspace_type` | `string` | 团队固定为 `team` |
| `capabilities` | `object` | 当前调用用户对团队的操作能力 |

`capabilities` 中的常用字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `read` | `boolean` | 是否可以查看团队 |
| `manage_members` | `boolean` | 是否可以邀请、移除或调整成员 |
| `update` | `boolean` | 是否可以修改团队信息 |
| `delete` | `boolean` | 是否可以删除团队 |
| `create_knowledgebase` | `boolean` | 是否可以在团队工作空间创建知识库 |
| `create_shared_resource` | `boolean` | 是否可以创建团队共享资源 |
| `create_collaborative_resource` | `boolean` | 是否可以创建团队协作资源 |

---

### 创建团队

**POST** `/api/v1/teams`

创建一个团队，并将当前用户设置为团队所有者。新团队不会复制所有者个人工作空间中的模型配置。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/teams' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "name": "产品研发团队"
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 团队名称；去除首尾空白后长度必须为 1 至 100 个字符 |

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
    "name": "产品研发团队",
    "role": "owner",
    "workspace_type": "team",
    "capabilities": {
      "read": true,
      "create_knowledgebase": true,
      "create_shared_resource": true,
      "create_collaborative_resource": true,
      "manage_members": true,
      "update": true,
      "delete": true
    }
  }
}
```

如果当前用户没有个人工作空间、团队数量已达到配额，或名称不符合要求，接口返回非零业务状态码。

---

### 获取团队列表

**GET** `/api/v1/teams`

普通用户获取自己已经加入的团队。尚未接受的邀请不会出现在此列表中；超级管理员获取所有有效团队。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/teams' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

该接口当前不支持分页、搜索或排序参数。

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
      "name": "产品研发团队",
      "role": "owner",
      "workspace_type": "team",
      "capabilities": {
        "read": true,
        "create_knowledgebase": true,
        "create_shared_resource": true,
        "create_collaborative_resource": true,
        "manage_members": true,
        "update": true,
        "delete": true
      }
    }
  ]
}
```

没有已加入的团队时，`data` 返回空数组。

---

### 获取待接受的团队邀请

**GET** `/api/v1/teams/invitations`

获取当前用户尚未接受的团队邀请。待接受邀请不会出现在团队列表中。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/teams/invitations' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

该接口当前不支持分页、搜索或排序参数。

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
      "name": "产品研发团队",
      "role": "invite",
      "invited_by": "91fc7a26ee8b11f0a1740242ac120002",
      "workspace_type": "team"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tenant_id` | `string` | 被邀请加入的团队 ID |
| `name` | `string` | 团队名称 |
| `role` | `string` | 待接受邀请固定为 `invite` |
| `invited_by` | `string` | 发起邀请的用户 ID |
| `workspace_type` | `string` | 固定为 `team` |

没有待接受邀请时，`data` 返回空数组。

---

### 获取团队详情

**GET** `/api/v1/teams/{team_id}`

团队有效成员和超级管理员可以获取团队详情。待接受邀请的用户不属于有效成员。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/teams/{team_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
    "name": "产品研发团队",
    "role": "normal",
    "workspace_type": "team",
    "capabilities": {
      "read": true,
      "create_knowledgebase": false,
      "create_shared_resource": false,
      "create_collaborative_resource": true,
      "manage_members": false,
      "update": false,
      "delete": false
    }
  }
}
```

团队不存在时返回 `404` 业务状态码；当前用户无权访问时返回 `403`。

---

### 修改团队

**PATCH** `/api/v1/teams/{team_id}`

团队所有者、团队管理员和超级管理员可以修改团队名称。

#### 请求示例

```bash
curl --request PATCH \
     --url 'http://{address}/api/v1/teams/{team_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "name": "产品平台团队"
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |
| `name` | 请求体 | `string` | 是 | 新团队名称；去除首尾空白后长度必须为 1 至 100 个字符 |

#### 成功响应

成功时，`data` 返回修改后的完整团队对象：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
    "name": "产品平台团队",
    "role": "admin",
    "workspace_type": "team",
    "capabilities": {
      "read": true,
      "create_knowledgebase": true,
      "create_shared_resource": true,
      "create_collaborative_resource": true,
      "manage_members": true,
      "update": true,
      "delete": false
    }
  }
}
```

当前用户没有团队管理权限、团队不存在或名称不符合要求时，接口返回非零业务状态码。

---

### 删除团队

**DELETE** `/api/v1/teams/{team_id}`

只有团队所有者和超级管理员可以删除团队。删除前必须先删除团队中的知识库、聊天、搜索、智能体、记忆、数据源、MCP、知识编译模板和普通文件等资源。

#### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/teams/{team_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 待删除的团队 ID |

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": true
}
```

删除操作会停用团队及其成员关系，并清理团队的 Token、模型配置和配额配置。团队中仍存在资源时，服务端拒绝删除并返回非零业务状态码。

---

### 邀请团队成员

**POST** `/api/v1/teams/{team_id}/invitations`

团队所有者、团队管理员和超级管理员可以邀请已经注册的用户。邀请创建后，该用户的角色为 `invite`；用户接受邀请后才会成为 `normal` 普通成员。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/teams/{team_id}/invitations' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "email": "member@example.com"
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |
| `email` | 请求体 | `string` | 是 | 已注册用户的邮箱地址 |

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "513c9e5eee8c11f0a1740242ac120002",
    "email": "member@example.com",
    "nickname": "张三",
    "avatar": null
  }
}
```

以下情况会导致邀请失败：

- 邮箱对应的用户不存在；
- 用户已经是团队成员或已有待接受邀请；
- 当前调用用户没有成员管理权限。

服务端会异步尝试发送邀请邮件；邮件发送失败不会撤销已经创建的邀请关系。

---

### 接受团队邀请

**POST** `/api/v1/teams/{team_id}/invitations/accept`

当前用户接受指定团队的邀请。只有在该团队中处于 `invite` 状态的用户可以调用；接受成功后，用户角色变为 `normal`。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/teams/{team_id}/invitations/accept' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 接受邀请的团队 ID |

该接口不需要请求体。

#### 成功响应

成功时，`data` 返回加入后的完整团队对象：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tenant_id": "8f4e67d8ee8b11f0a1740242ac120002",
    "name": "产品研发团队",
    "role": "normal",
    "workspace_type": "team",
    "capabilities": {
      "read": true,
      "create_knowledgebase": false,
      "create_shared_resource": false,
      "create_collaborative_resource": true,
      "manage_members": false,
      "update": false,
      "delete": false
    }
  }
}
```

邀请不存在、已接受或已经失效时，接口返回 `404` 业务状态码。

---

### 获取团队成员列表

**GET** `/api/v1/teams/{team_id}/members`

团队有效成员和超级管理员可以获取成员列表。列表包含正式成员以及尚未接受邀请的用户，可通过 `role` 区分。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/teams/{team_id}/members' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |

该接口当前不支持分页、搜索或排序参数。

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "63348632ee8c11f0a1740242ac120002",
      "user_id": "513c9e5eee8c11f0a1740242ac120002",
      "role": "normal",
      "nickname": "张三",
      "email": "member@example.com",
      "avatar": null,
      "is_superuser": false
    },
    {
      "id": "74af68b0ee8c11f0a1740242ac120002",
      "user_id": "6151a650ee8c11f0a1740242ac120002",
      "role": "invite",
      "nickname": "李四",
      "email": "invitee@example.com",
      "avatar": null,
      "is_superuser": false
    }
  ]
}
```

成员对象中的 `id` 是成员关系 ID；移除成员接口使用的是 `user_id`，不要将二者混用。

---

### 修改成员角色或转移所有权

**PATCH** `/api/v1/teams/{team_id}/members/{user_id}`

该接口有两种互斥用法：

- 通过 `role` 将成员设置为管理员或普通成员；
- 通过 `transfer_ownership: true` 将团队所有权转移给目标成员。

#### 修改成员角色

团队所有者、团队管理员和超级管理员可以将非所有者成员的角色修改为 `admin` 或 `normal`。

```bash
curl --request PATCH \
     --url 'http://{address}/api/v1/teams/{team_id}/members/{user_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "role": "admin"
     }'
```

#### 转移团队所有权

只有当前团队所有者和超级管理员可以转移所有权。目标用户必须是团队的有效成员；转移完成后，原所有者变为 `admin`，目标成员变为 `owner`。

```bash
curl --request PATCH \
     --url 'http://{address}/api/v1/teams/{team_id}/members/{user_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "transfer_ownership": true
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |
| `user_id` | 路径 | `string` | 是 | 目标成员的用户 ID，不是成员关系 ID |
| `role` | 请求体 | `string` | 条件必填 | 目标角色，只能是 `admin` 或 `normal` |
| `transfer_ownership` | 请求体 | `boolean` | 条件必填 | 设置为 `true` 时执行所有权转移，并忽略 `role` |

请求体必须选择一种操作。不要同时依赖 `role` 和 `transfer_ownership` 的值。

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": true
}
```

不能通过 `role` 直接设置或取消 `owner`。修改所有者必须使用 `transfer_ownership: true`。

---

### 移除团队成员

**DELETE** `/api/v1/teams/{team_id}/members/{user_id}`

团队所有者可以移除管理员或普通成员；团队管理员只能移除普通成员；超级管理员可以移除所有者之外的成员。普通成员可以使用自己的 `user_id` 主动退出团队。

团队所有者不能直接被移除，必须先转移团队所有权。

#### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/teams/{team_id}/members/{user_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `team_id` | 路径 | `string` | 是 | 团队 ID |
| `user_id` | 路径 | `string` | 是 | 待移除用户的用户 ID，不是成员关系 ID |

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": true
}
```

移除操作会将成员关系标记为无效。成员不存在、尝试移除所有者或当前调用用户权限不足时，接口返回非零业务状态码。

---
## OpenAI 兼容 API

本章介绍如何使用 OpenAI Chat Completions 兼容格式调用聊天应用和智能体。请求仍由 RAGFlow 处理，并受 API Token 所属工作空间及资源权限约束。

---

### 创建聊天补全

**POST** `/api/v1/openai/{chat_id}/chat/completions`

调用指定聊天应用生成回复。请求与响应采用 OpenAI Chat Completions 兼容格式。

:::caution 已废弃的地址
`POST /api/v1/chats_openai/{chat_id}/chat/completions` 已废弃，请改用本节所述地址。
:::

#### 请求

- 方法：`POST`
- 地址：`/api/v1/openai/{chat_id}/chat/completions`
- 请求头：
  - `Content-Type: application/json`
  - `Authorization: Bearer <YOUR_API_KEY>`

请求示例：

```bash
curl --request POST \
  --url http://{address}/api/v1/openai/{chat_id}/chat/completions \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "model": "model",
    "messages": [
      {"role": "user", "content": "请概括知识库中的产品说明。"}
    ],
    "stream": true,
    "extra_body": {
      "reference": true,
      "reference_metadata": {
        "include": true,
        "fields": ["author", "year", "source"]
      },
      "metadata_condition": {
        "logic": "and",
        "conditions": [
          {
            "name": "author",
            "comparison_operator": "is",
            "value": "张三"
          }
        ]
      }
    }
  }'
```

#### 路径参数

- `chat_id`：`string`，必填。聊天应用 ID。调用者必须有权访问该聊天应用。

#### 请求体参数

- `model`：`string`，必填。用于生成回复的模型。传入 `"model"` 时沿用聊天应用配置的模型；传入具体模型标识时，该模型必须可供聊天应用所属工作空间使用。
- `messages`：`array<object>`，必填。对话消息列表，至少包含一条消息，最后一条消息必须为 `user` 角色。
  - `role`：`string`。支持 `system`、`user` 和 `assistant`。
  - `content`：`string | array`。字符串，或由 OpenAI 文本内容片段组成的数组。当前接口会忽略非文本内容片段。
- `stream`：`boolean`，可选。为 `true` 时返回 SSE 流；默认为非流式响应。
- `session_id`：`string`，可选。继续已有的 OpenAI 兼容会话。也可以通过 `extra_body.session_id` 传入。
- `user`：`string`，可选。调用方的外部用户标识，用于隔离同一聊天应用下的会话。
- `extra_body`：`object`，可选。RAGFlow 扩展参数：
  - `reference`：`boolean`。是否在最终响应中包含引用分块。
  - `session_id`：`string`。继续已有会话，与顶层 `session_id` 等效。
  - `user_id`：`string`。外部用户标识；未设置顶层 `user` 时生效。
  - `reference_metadata`：`object`。引用分块的元数据配置。
    - `include`：`boolean`。是否包含文档元数据。
    - `fields`：`array<string>`。允许返回的元数据字段；省略时返回全部字段，空数组表示不返回任何元数据字段。
  - `metadata_condition`：`object`。对检索结果应用的元数据过滤条件。
    - `logic`：`string`。条件间的逻辑关系，如 `and` 或 `or`。
    - `conditions`：`array<object>`。具体过滤条件。

请求还可以携带兼容的生成参数，例如 `temperature`、`top_p`、`presence_penalty`、`frequency_penalty` 和 `max_tokens`。这些参数仅影响本次请求，不修改聊天应用的持久化配置。

#### 流式响应

响应类型为 `text/event-stream`。每个事件以 `data:` 开头，最后以 `data:[DONE]` 结束：

```text
data:{"id":"chatcmpl-<chat_id>","object":"chat.completion.chunk","created":1755084508,"model":"model","choices":[{"index":0,"delta":{"role":"assistant","content":"这是"},"finish_reason":null}],"usage":null}

data:{"id":"chatcmpl-<chat_id>","object":"chat.completion.chunk","created":1755084508,"model":"model","choices":[{"index":0,"delta":{"role":"assistant","content":"回复内容。"},"finish_reason":null}],"usage":null}

data:{"id":"chatcmpl-<chat_id>","object":"chat.completion.chunk","created":1755084508,"model":"model","choices":[{"index":0,"delta":{"role":"assistant","content":null},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":6,"total_tokens":18}}

data:[DONE]
```

当 `extra_body.reference` 为 `true` 时，最后一个数据块的 `choices[0].delta` 还会包含：

- `reference`：引用分块列表。
- `final_content`：完整回复文本。

#### 非流式响应

```json
{
  "id": "chatcmpl-<chat_id>",
  "object": "chat.completion",
  "created": 1755084403,
  "model": "model",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "这是根据知识库生成的回复。"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 10,
    "total_tokens": 22
  },
  "session_id": "<session_id>"
}
```

当 `extra_body.reference` 为 `true` 时，引用信息位于 `choices[0].message.reference`。

#### 失败响应示例

```json
{
  "code": 102,
  "message": "The last content of this conversation is not from user."
}
```

常见失败原因包括：聊天应用不存在或无权访问、模型不可用、消息列表为空、最后一条消息不是用户消息，以及 `session_id` 不属于当前聊天应用或外部用户。

---

### 创建智能体补全

**POST** `/api/v1/agents/chat/completions`

以 OpenAI Chat Completions 兼容格式运行指定智能体。

:::caution 已废弃的地址
`POST /api/v1/agents_openai/{agent_id}/chat/completions` 已废弃。旧地址仅用于兼容已有调用；新调用应使用本节所述地址，并在请求体中传入 `agent_id` 和 `openai-compatible`。
:::

#### 请求

- 方法：`POST`
- 地址：`/api/v1/agents/chat/completions`
- 请求头：
  - `Content-Type: application/json`
  - `Authorization: Bearer <YOUR_API_KEY>`

请求示例：

```bash
curl --request POST \
  --url http://{address}/api/v1/agents/chat/completions \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "agent_id": "<agent_id>",
    "openai-compatible": true,
    "model": "model",
    "messages": [
      {"role": "user", "content": "请执行这个任务。"}
    ],
    "stream": true
  }'
```

#### 请求体参数

- `agent_id`：`string`，必填。智能体 ID。调用者必须有权访问该智能体。
- `openai-compatible`：`boolean`，必填。设为 `true` 后返回 OpenAI 兼容格式。
- `model`：`string`，可选。兼容 OpenAI 客户端的模型字段；智能体实际使用的模型由其流程配置决定。
- `messages`：`array<object>`，必填。至少包含一条消息。接口使用消息列表中最后一条 `user` 消息作为本次输入。
- `stream`：`boolean`，可选。为 `true` 时返回 SSE 流，否则返回完整响应。
- `session_id`：`string`，可选。继续已有智能体会话。该会话必须属于指定智能体，并且调用者必须有权访问。

#### 流式响应

```text
data:{"id":"<completion_id>","object":"chat.completion.chunk","model":"<agent_id>","choices":[{"index":0,"delta":{"content":"任务"},"finish_reason":null}]}

data:{"id":"<completion_id>","object":"chat.completion.chunk","model":"<agent_id>","choices":[{"index":0,"delta":{"content":"已完成。"},"finish_reason":null}]}

data:[DONE]
```

智能体流程使用知识库检索时，响应中的 `delta` 还可能包含 `reference` 引用信息。

#### 非流式响应

```json
{
  "id": "<completion_id>",
  "object": "chat.completion",
  "model": "<agent_id>",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "任务已完成。"
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 8,
    "completion_tokens": 6,
    "total_tokens": 14
  }
}
```

#### 失败响应示例

未提供智能体 ID：

```json
{
  "code": 102,
  "data": false,
  "message": "`agent_id` is required."
}
```

无权访问智能体：

```json
{
  "code": 102,
  "data": false,
  "message": "Make sure you have permission to access the agent."
}
```

已有会话与智能体不匹配时，请求也会被拒绝，不能用一个智能体的 `session_id` 调用另一个智能体。

## 知识库管理

---

本章介绍知识库的创建、查询、更新、删除，以及知识图谱和 RAPTOR 索引任务接口。

所有接口均需在请求头中携带 API Token：

```http
Authorization: Bearer <YOUR_API_KEY>
```

API Token 与工作空间绑定。接口只会返回该 Token 所属用户有权访问的工作空间资源；创建、修改、删除和构建索引还会校验相应资源的写权限。

### 创建知识库

**POST** `/api/v1/datasets`

在指定工作空间中创建知识库。

#### 请求示例

```bash
curl --request POST \
  --url http://{address}/api/v1/datasets \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "产品资料库",
    "workspace_id": "<WORKSPACE_ID>",
    "chunk_method": "naive"
  }'
```

使用 DataFlow 解析流水线创建知识库：

```bash
curl --request POST \
  --url http://{address}/api/v1/datasets \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "流水线知识库",
    "workspace_id": "<WORKSPACE_ID>",
    "parse_type": 2,
    "pipeline_id": "d0bebe30ae2211f0970942010a8e0005"
  }'
```

#### 请求体参数

- `name`：`string`，必填。知识库名称，去除首尾空白后长度为 1～128 个字符；同一工作空间内名称不区分大小写且不可重复。
- `workspace_id`：`string`，可选。32 位工作空间 ID。未传入时使用当前用户的个人工作空间。调用者必须有权在该工作空间创建知识库。
- `avatar`：`string | null`，可选。带 MIME 前缀的 Base64 图片，仅支持 JPEG 和 PNG，例如 `data:image/png;base64,...`，最大 65535 个字符。
- `description`：`string | null`，可选。知识库描述，最大 65535 个字符。
- `embedding_model`：`string | null`，可选。嵌入模型实例 ID，或 `模型名称@提供商` 格式的模型标识。未提供时使用工作空间默认嵌入模型。
- `chunk_method`：`string | null`，可选。内置分块方法，可选值见下表。
- `parser_config`：`object | null`，可选。分块和解析配置。
- `parse_type`：`integer | null`，可选，范围为 0～64。使用 DataFlow 时表示解析模式。
- `pipeline_id`：`string | null`，可选。32 位 DataFlow ID。
- `auto_metadata_config`：`object | null`，可选。自动元数据提取配置。
- `ext`：`object`，可选。扩展配置。
- `permission`：`"me" | "team"`，可选。为兼容接口保留；服务端会根据目标工作空间类型将个人空间设为 `me`、团队空间设为 `team`。

支持的 `chunk_method`：

| 值 | 含义 |
| --- | --- |
| `naive` | 通用 |
| `book` | 图书 |
| `email` | 邮件 |
| `laws` | 法律文件 |
| `manual` | 手册 |
| `one` | 整体作为一个分块 |
| `paper` | 论文 |
| `picture` | 图片 |
| `presentation` | 演示文稿 |
| `qa` | 问答 |
| `table` | 表格 |
| `tag` | 标签集 |

常用 `parser_config` 字段：

- `chunk_token_num`：分块的目标 Token 数。
- `delimiter`：分隔符。
- `layout_recognize`：版面识别方式。
- `html4excel`：是否将 Excel 转换为 HTML。
- `auto_keywords`：自动生成关键词数量。
- `auto_questions`：自动生成问题数量。
- `task_page_size`：PDF 单个解析任务处理的页数。
- `tag_kb_ids`：使用标签集时引用的知识库 ID 列表。
- `raptor`：RAPTOR 配置，例如 `{"use_raptor": false}`。
- `graphrag`：GraphRAG 配置，例如 `{"use_graphrag": false}`。
- `parent_child`：父子分块配置，包括 `use_parent_child` 和 `children_delimiter`。

:::caution 解析方式互斥
使用内置分块方法时设置 `chunk_method`，可同时设置 `parser_config`；使用 DataFlow 时设置 `parse_type` 和 `pipeline_id`。不要在同一次请求中混用这两种方式。均未设置时，服务端默认使用 `naive`。
:::

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "3b4de7d4241d11f0a6a79f24fc270c7f",
    "name": "产品资料库",
    "tenant_id": "3af81804241d11f0a6a79f24fc270c7f",
    "created_by": "69736c5e723611efb51b0242ac120007",
    "chunk_method": "naive",
    "embedding_model": "BAAI/bge-large-zh-v1.5@BAAI",
    "document_count": 0,
    "chunk_count": 0,
    "token_num": 0,
    "permission": "team"
  }
}
```

创建失败时会返回非零 `code`，常见原因包括名称无效或重复、目标工作空间不可写、嵌入模型不可用，以及 DataFlow 与知识库不属于同一工作空间。

---

### 删除知识库

**DELETE** `/api/v1/datasets`

批量删除知识库。

#### 请求示例

```bash
curl --request DELETE \
  --url http://{address}/api/v1/datasets \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "ids": [
      "d94a8dc02c9711f0930f7fbc369eab6d",
      "e94a8dc02c9711f0930f7fbc369eab6e"
    ]
  }'
```

删除当前用户创建的全部知识库：

```bash
curl --request DELETE \
  --url http://{address}/api/v1/datasets \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{"delete_all": true}'
```

#### 请求体参数

- `ids`：`array<string> | null`，可选。待删除的知识库 ID；不允许包含重复 ID。
- `delete_all`：`boolean`，可选，默认 `false`。当 `ids` 未提供、为 `null` 或空数组时，设为 `true` 会删除当前用户创建且有权删除的全部知识库。

当 `ids` 为空且 `delete_all` 为 `false` 时，不删除任何数据。

删除前服务端会检查权限和资源引用。如果知识库或其中的文件正被聊天、智能体等资源引用，接口会拒绝删除并返回引用信息。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "success_count": 2
  }
}
```

---

### 更新知识库

**PUT** `/api/v1/datasets/{dataset_id}`

更新指定知识库的配置。只需提交需要修改的字段；该接口不能移动知识库所属工作空间。

#### 请求示例

```bash
curl --request PUT \
  --url http://{address}/api/v1/datasets/{dataset_id} \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "更新后的资料库",
    "description": "产品和研发资料"
  }'
```

#### 参数

- `dataset_id`：路径参数，必填。知识库 ID。
- `name`：`string`，可选。新名称，规则与创建接口一致。
- `avatar`：`string | null`，可选。新头像。
- `description`：`string | null`，可选。新描述。
- `embedding_model`：`string | null`，可选。新嵌入模型。已有分块时切换嵌入模型可能需要重新处理文档。
- `chunk_method`：`string | null`，可选。新分块方法。
- `parser_config`：`object | null`，可选。与已有解析配置进行合并。
- `pagerank`：`integer`，可选，范围为 0～100。仅 Elasticsearch 检索引擎支持非零值。
- `language`：`string | null`，可选，最大 32 个字符。
- `connectors`：`array<object>`，可选。关联的数据源；数据源必须与知识库属于同一工作空间。
- `auto_metadata_config`：`object | null`，可选。自动元数据提取配置。
- `permission`：兼容字段。服务端仍按知识库实际工作空间类型确定其值。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "3b4de7d4241d11f0a6a79f24fc270c7f",
    "name": "更新后的资料库",
    "description": "产品和研发资料"
  }
}
```

无写权限、名称冲突、模型不可用或跨工作空间引用数据源/编译模板时，接口会返回非零 `code`。

---

### 获取知识库列表

**GET** `/api/v1/datasets`

返回当前用户可见的知识库。

#### 请求示例

```bash
curl --get http://{address}/api/v1/datasets \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=30' \
  --data-urlencode 'scope=all' \
  --data-urlencode 'orderby=update_time' \
  --data-urlencode 'desc=true' \
  --data-urlencode 'include_parsing_status=true'
```

#### 查询参数

- `page`：`integer`，默认 `1`。页码。
- `page_size`：`integer`，默认 `30`。每页数量。
- `orderby`：`string`，默认 `create_time`。排序字段，常用值为 `create_time`、`update_time`。
- `desc`：`boolean`，默认 `true`。是否降序排列。
- `id`：`string`，可选。按知识库 ID 精确筛选。
- `name`：`string`，可选。按名称筛选。
- `scope`：`"all" | "personal" | "team"`，默认 `all`。工作空间范围。
- `workspace_id`：`string`，可选。筛选具体工作空间。`scope=team` 时必须提供有效的团队工作空间 ID。
- `include_parsing_status`：`boolean`，默认 `false`。是否统计各解析状态的文件数。

`include_parsing_status=true` 时，每个知识库还会包含：

- `unstart_count`：未开始解析的文件数。
- `running_count`：正在解析的文件数。
- `cancel_count`：已取消解析的文件数。
- `done_count`：解析成功的文件数。
- `fail_count`：解析失败的文件数。

#### 成功响应

```json
{
  "code": 0,
  "data": [
    {
      "id": "6e211ee0723611efa10a0242ac120007",
      "name": "产品资料库",
      "tenant_id": "69736c5e723611efb51b0242ac120007",
      "created_by": "69736c5e723611efb51b0242ac120007",
      "chunk_method": "naive",
      "embedding_model": "BAAI/bge-large-zh-v1.5@BAAI",
      "document_count": 3,
      "chunk_count": 59,
      "token_num": 12744,
      "done_count": 2,
      "running_count": 1,
      "fail_count": 0,
      "update_time": 1728533243536
    }
  ],
  "total": 1
}
```

---

### 获取知识图谱

**GET** `/api/v1/datasets/{dataset_id}/graph`

读取指定知识库已生成的知识图谱。调用者需要对知识库具有读取权限。

#### 请求示例

```bash
curl --request GET \
  --url http://{address}/api/v1/datasets/{dataset_id}/graph \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "graph": {
      "directed": false,
      "nodes": [
        {
          "id": "entity-id",
          "label": "产品"
        }
      ],
      "edges": [
        {
          "source": "产品",
          "target": "文档",
          "weight": 1.0
        }
      ]
    }
  }
}
```

:::caution 旧接口已废弃
`GET /api/v1/datasets/{dataset_id}/knowledge_graph` 仅作为兼容别名保留。新调用请使用 `/graph`。
:::

---

### 删除知识图谱索引

**DELETE** `/api/v1/datasets/{dataset_id}/graph`

停止知识图谱构建任务，并默认删除已经生成的图谱索引数据。调用者需要对知识库具有修改权限。

#### 查询参数

- `wipe`：`boolean`，默认 `true`。为 `false` 时只停止任务并保留已有进度，以便后续恢复。

#### 请求示例

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/graph?wipe=true' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

也可以使用统一索引地址：`DELETE /api/v1/datasets/{dataset_id}/index?type=graph&wipe=true`。

:::caution 旧接口已废弃
`DELETE /api/v1/datasets/{dataset_id}/knowledge_graph` 仅作为兼容别名保留。
:::

---

### 构建知识图谱

**POST** `/api/v1/datasets/{dataset_id}/index?type=graph`

为知识库提交知识图谱构建任务。知识库必须至少包含一个文件，且调用者需要具有修改权限。同一类型已有任务运行时不会重复创建。

#### 请求示例

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/index?type=graph' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "task_id": "50d3c31cbfbd11f0ba028f704583b57b"
  }
}
```

:::caution 旧接口已废弃
`POST /api/v1/datasets/{dataset_id}/run_graphrag` 仅作为兼容别名保留。
:::

---

### 查询知识图谱构建状态

**GET** `/api/v1/datasets/{dataset_id}/index?type=graph`

查询当前知识图谱任务。尚未创建任务时，`data` 为空对象。

#### 请求示例

```bash
curl --request GET \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/index?type=graph' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "50d3c31cbfbd11f0ba028f704583b57b",
    "task_type": "graphrag",
    "progress": 0.6,
    "progress_msg": "Processing...",
    "begin_at": "2026-07-21T10:00:00"
  }
}
```

:::caution 旧接口已废弃
`GET /api/v1/datasets/{dataset_id}/trace_graphrag` 仅作为兼容别名保留。
:::

---

### 构建 RAPTOR 索引

**POST** `/api/v1/datasets/{dataset_id}/index?type=raptor`

为知识库提交 RAPTOR 构建任务。知识库必须至少包含一个文件，且调用者需要具有修改权限。

#### 请求示例

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/index?type=raptor' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "task_id": "50d3c31cbfbd11f0ba028f704583b57b"
  }
}
```

:::caution 旧接口已废弃
`POST /api/v1/datasets/{dataset_id}/run_raptor` 仅作为兼容别名保留。
:::

---

### 查询 RAPTOR 构建状态

**GET** `/api/v1/datasets/{dataset_id}/index?type=raptor`

查询当前 RAPTOR 任务。尚未创建任务时，`data` 为空对象。

#### 请求示例

```bash
curl --request GET \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/index?type=raptor' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "50d3c31cbfbd11f0ba028f704583b57b",
    "task_type": "raptor",
    "progress": 1.0,
    "progress_msg": "Task done",
    "process_duration": 0.948244
  }
}
```

:::caution 旧接口已废弃
`GET /api/v1/datasets/{dataset_id}/trace_raptor` 仅作为兼容别名保留。
:::

---

统一索引接口还接受 `type=mindmap`，其提交、状态查询和删除方式与 `graph`、`raptor` 相同。
## 知识库文件管理

本章介绍如何通过 HTTP API 上传、查询、更新、下载、删除和解析知识库中的文件。

:::note 权限说明
读取文件列表和下载文件要求 API 密钥所属工作空间对知识库具有读取权限；上传、修改、删除、开始解析和停止解析要求该工作空间对知识库具有修改权限。文件 ID 还必须属于路径中指定的知识库。
:::

---

### 上传文件

**POST** `/api/v1/datasets/{dataset_id}/documents`

向指定知识库添加一个或多个文件。查询参数 `type` 决定文件的创建方式：

- `local`：上传本地文件，也是未指定 `type` 时的默认方式。
- `web`：抓取网页并将其保存为 PDF 文件。
- `empty`：创建一个不包含内容的虚拟文件。

#### 请求

- 请求头：`Authorization: Bearer <YOUR_API_KEY>`
- 路径参数：
  - `dataset_id`：目标知识库 ID。
- 查询参数：
  - `type`：可选，取值为 `local`、`web` 或 `empty`，默认为 `local`。
  - `return_raw_files`：仅用于 `local`，可选。设为 `true` 时返回未经 API 字段映射的原始文件数据，默认为 `false`。

#### 上传本地文件

请求体使用 `multipart/form-data`：

- `file`：必填，可重复传递以一次上传多个文件。
- `parent_path`：可选，文件在知识库文件目录下的相对路径，使用 `/` 分隔层级。
- `parser_config`：可选，JSON 字符串。当前上传接口仅接受表格列配置字段 `table_column_mode` 和 `table_column_roles`，其他字段会被忽略。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --form 'file=@./manual.txt' \
  --form 'file=@./report.pdf' \
  --form 'parent_path=产品资料/2026'
```

#### 抓取网页

请求体使用 `multipart/form-data`：

- `name`：必填，生成文件的名称；系统会为其添加 `.pdf` 后缀。
- `url`：必填，需要抓取的 HTTP 或 HTTPS 地址。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents?type=web' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --form 'name=产品说明' \
  --form 'url=https://example.com/manual'
```

#### 创建空文件

请求体使用 `application/json`：

- `name`：必填，文件名在同一知识库内不能重复。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents?type=empty' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"notes.txt"}'
```

:::note 配额限制
三种创建方式都会检查工作空间及知识库的文件数量和存储配额。超过任一配额时，接口拒绝上传或创建文件，并在 `message` 中返回具体原因。
:::

#### 响应

本地文件上传成功后，`data` 为文件数组；网页和空文件创建成功后，`data` 为单个文件对象。

```json
{
  "code": 0,
  "data": [
    {
      "id": "b330ec2e91ec11efbc510242ac120004",
      "name": "manual.txt",
      "location": "manual.txt",
      "dataset_id": "527fa74891e811ef9c650242ac120006",
      "created_by": "69736c5e723611efb51b0242ac120007",
      "chunk_method": "naive",
      "chunk_count": 0,
      "token_count": 0,
      "run": "UNSTART",
      "size": 17966,
      "type": "doc"
    }
  ]
}
```

未提交文件时的响应示例：

```json
{
  "code": 101,
  "message": "No file part!"
}
```

---

### 更新文件配置

**PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}`

更新指定文件的名称、元数据、分块方式、解析配置或可用状态。

:::caution 旧请求方法
`PUT /api/v1/datasets/{dataset_id}/documents/{document_id}` 仅作为兼容别名保留，已弃用。新调用应使用 `PATCH`。
:::

#### 请求

- 请求头：
  - `Authorization: Bearer <YOUR_API_KEY>`
  - `Content-Type: application/json`
- 路径参数：
  - `dataset_id`：文件所属知识库 ID。
  - `document_id`：需要更新的文件 ID。
- 请求体参数均为可选，只需提交需要修改的字段：
  - `name`：`string`，新文件名；在同一知识库中不能与其他文件重名。
  - `meta_fields`：`object`，文件元数据。值可以是字符串、数字或由这些标量组成的数组。
  - `chunk_method`：`string`，分块方式。可用值包括 `naive`、`manual`、`qa`、`table`、`paper`、`book`、`laws`、`presentation`、`picture`、`one`、`knowledge_graph`、`email` 和 `tag`。
  - `parser_config`：`object`，与所选分块方式对应的解析配置。
  - `pipeline_id`：`string`，数据流水线 ID；传入空字符串可切回内置解析流程。
  - `enabled`：`integer`，`1` 表示可用于检索，`0` 表示停用。

修改分块方式、数据流水线或影响解析结果的知识编译模板配置时，文件会被重置为需要重新解析的状态。`parser_config` 引用的知识编译模板必须与知识库属于同一工作空间。

```bash
curl --request PATCH \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "user-manual.txt",
    "chunk_method": "naive",
    "parser_config": {
      "chunk_token_num": 512,
      "delimiter": "\\n"
    },
    "meta_fields": {
      "department": "研发部"
    },
    "enabled": 1
  }'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "cd38dd72d4a611f0af9c71de94a988ef",
    "dataset_id": "5f546a1ad4a611f0af9c71de94a988ef",
    "name": "user-manual.txt",
    "chunk_method": "naive",
    "chunk_count": 2,
    "token_count": 8126,
    "run": "DONE",
    "enabled": 1,
    "meta_fields": {
      "department": "研发部"
    }
  }
}
```

文件不属于指定知识库时，接口返回错误，例如：

```json
{
  "code": 102,
  "message": "The dataset doesn't own the document."
}
```

---

### 下载文件

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}`

下载指定知识库中的原始文件。成功响应是文件流，不是 JSON。

#### 请求

- 请求头：`Authorization: Bearer <YOUR_API_KEY>`
- 路径参数：
  - `dataset_id`：文件所属知识库 ID。
  - `document_id`：文件 ID。

```bash
curl --request GET \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --output ./downloaded-file.pdf
```

#### 响应

成功时返回原始文件内容，并通过 `Content-Disposition` 提供文件名。文件不存在、为空或调用方无权读取时返回 JSON 错误响应。

---

### 查询文件列表

**GET** `/api/v1/datasets/{dataset_id}/documents`

分页查询指定知识库中的文件。

#### 请求

- 请求头：`Authorization: Bearer <YOUR_API_KEY>`
- 路径参数：
  - `dataset_id`：知识库 ID。
- 查询参数：
  - `page`：`integer`，页码，默认为 `1`。
  - `page_size`：`integer`，每页数量，默认为 `30`，并受服务端最大分页数量限制。
  - `orderby`：`string`，排序字段，默认为 `create_time`。
  - `desc`：`boolean`，是否按降序排列，默认为 `true`；只有字符串 `false` 表示升序。
  - `keywords`：`string`，按文件名进行关键词搜索。
  - `id`：`string`，精确匹配单个文件 ID。设置后会忽略其他文件集合过滤条件。
  - `ids`：`array<string>`，按多个文件 ID 过滤；可重复传递，如 `ids=id1&ids=id2`。
  - `name`：`string`，精确匹配文件名。
  - `types`：`array<string>`，按文件类型过滤，可重复传递。
  - `suffix`：`array<string>`，按扩展名过滤，可重复传递，如 `suffix=pdf&suffix=txt`。
  - `run` 或 `run_status`：`array<string>`，按解析状态过滤。支持状态值 `0` 至 `4`，也支持 `UNSTART`、`RUNNING`、`CANCEL`、`DONE` 和 `FAIL`；可重复传递。
  - `create_time_from`：`integer`，创建时间下界的 Unix 毫秒时间戳，`0` 表示不限制。
  - `create_time_to`：`integer`，创建时间上界的 Unix 毫秒时间戳，`0` 表示不限制。
  - `metadata`：`object`，以 JSON 字符串传递，用于元数据键值精确匹配。
  - `metadata_condition`：`object`，以 JSON 字符串传递，用于组合元数据条件。
  - `return_empty_metadata`：`boolean`，控制是否包含没有元数据的文件。

解析状态对应关系：

| 数值 | 名称 | 含义 |
| --- | --- | --- |
| `0` | `UNSTART` | 尚未开始 |
| `1` | `RUNNING` | 正在解析 |
| `2` | `CANCEL` | 已取消 |
| `3` | `DONE` | 已完成 |
| `4` | `FAIL` | 解析失败 |

`metadata_condition` 的结构如下：

- `logic`：`and` 或 `or`，默认为 `and`。
- `conditions`：条件数组，每项包含 `name`、`comparison_operator` 和 `value`。
- `comparison_operator` 支持 `is`、`not is`、`contains`、`not contains`、`in`、`not in`、`start with`、`end with`、`>`、`<`、`≥`、`≤`、`empty` 和 `not empty`。

```bash
curl --get \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=10' \
  --data-urlencode 'suffix=pdf' \
  --data-urlencode 'run=DONE' \
  --data-urlencode 'metadata_condition={"logic":"and","conditions":[{"name":"department","comparison_operator":"is","value":"研发部"}]}'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "docs": [
      {
        "id": "3bcfbf8a8a0c11ef8aba0242ac120006",
        "dataset_id": "7898da028a0511efbf750242ac120005",
        "name": "manual.pdf",
        "location": "manual.pdf",
        "chunk_method": "naive",
        "chunk_count": 8,
        "token_count": 4096,
        "run": "DONE",
        "size": 102400,
        "source_type": "local",
        "create_time": 1728897061948,
        "update_time": 1728897061948
      }
    ]
  }
}
```

---

### 删除文件

**DELETE** `/api/v1/datasets/{dataset_id}/documents`

按 ID 删除文件，或者删除指定知识库中的全部文件。删除文件时会同时清理其存储对象、解析任务和分块数据；如果文件仍被其他资源引用，接口会拒绝删除并返回引用详情。

#### 请求

- 请求头：
  - `Authorization: Bearer <YOUR_API_KEY>`
  - `Content-Type: application/json`
- 路径参数：
  - `dataset_id`：知识库 ID。
- 请求体使用以下两种方式之一：
  - `ids`：`array<string>`，需要删除的文件 ID。ID 不能重复，且都必须属于指定知识库。
  - `delete_all`：`boolean`，设为 `true` 时删除知识库中的全部文件。

`ids` 和 `delete_all: true` 不能同时提供；两者都未提供时不会执行删除并返回参数错误。

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "ids": [
      "97a5f1c2759811efaa500242ac120004",
      "97ad64b6759811ef9fc30242ac120004"
    ]
  }'
```

删除全部文件：

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/documents' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"delete_all":true}'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "deleted": 2
  }
}
```

---

### 使用内置分块流程解析文件

**POST** `/api/v1/datasets/{dataset_id}/chunks`

启动指定文件的解析任务。此接口会清理文件已有的任务和索引数据，然后按照当前文件配置重新生成分块。

:::caution 数据流水线知识库
该接口仅适用于使用内置分块方式的知识库。知识库配置了数据流水线时，应调用 `POST /api/v1/documents/ingest`。
:::

#### 请求

- 请求头：
  - `Authorization: Bearer <YOUR_API_KEY>`
  - `Content-Type: application/json`
- 路径参数：
  - `dataset_id`：知识库 ID。
- 请求体：
  - `document_ids`：`array<string>`，必填且不能为空。所有文件都必须属于指定知识库。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/chunks' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "document_ids": [
      "97a5f1c2759811efaa500242ac120004",
      "97ad64b6759811ef9fc30242ac120004"
    ]
  }'
```

#### 响应

```json
{
  "code": 0
}
```

文件正在解析、文件不属于知识库或 `document_ids` 缺失时，接口返回错误响应。重复 ID 可能产生部分成功响应，详情位于 `data.errors`。

---

### 使用数据流水线处理文件

**POST** `/api/v1/documents/ingest`

启动、取消或重新运行文件的数据流水线任务。每个文件所属的知识库都必须允许 API 密钥所属工作空间修改。

#### 请求

- 请求头：
  - `Authorization: Bearer <YOUR_API_KEY>`
  - `Content-Type: application/json`
- 请求体：
  - `doc_ids`：`array<string>`，必填，文件 ID 列表。
  - `run`：`string`，必填。`"1"` 表示启动，`"2"` 表示取消。
  - `delete`：`boolean`，可选。设为 `true` 时，在重新运行前删除已有任务和分块，默认为 `false`。
  - `apply_kb`：`boolean`，可选。启动任务时，将知识库当前的模型和元数据配置应用到文件解析配置。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/documents/ingest' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "doc_ids": ["97a5f1c2759811efaa500242ac120004"],
    "run": "1",
    "delete": true,
    "apply_kb": true
  }'
```

#### 响应

```json
{
  "code": 0,
  "data": true
}
```

---

### 停止内置分块解析

**DELETE** `/api/v1/datasets/{dataset_id}/chunks`

停止指定文件当前正在运行的解析任务，并清理其已生成的分块索引。只有处于 `RUNNING` 状态的文件可以通过此接口停止。

#### 请求

- 请求头：
  - `Authorization: Bearer <YOUR_API_KEY>`
  - `Content-Type: application/json`
- 路径参数：
  - `dataset_id`：知识库 ID。
- 请求体：
  - `document_ids`：`array<string>`，必填且不能为空。所有文件都必须属于指定知识库。

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/datasets/{dataset_id}/chunks' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "document_ids": [
      "97a5f1c2759811efaa500242ac120004",
      "97ad64b6759811ef9fc30242ac120004"
    ]
  }'
```

#### 响应

```json
{
  "code": 0
}
```

如果文件未在解析、文件不属于知识库或 `document_ids` 缺失，接口返回错误响应。

---
## 知识库内分块管理

本章介绍知识库文档分块的增删改查、可用状态切换、文档元数据管理以及分块检索接口。

所有接口都需要在 `Authorization` 请求头中携带 API Token。读取接口要求 Token 对目标知识库具有访问权限；新增、修改、删除接口要求 Token 对目标知识库具有修改权限。知识库、文档和分块必须位于 Token 所属工作空间内。

---

### 添加分块

**POST** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

向指定文档添加一个分块。服务端会使用文档配置的嵌入模型为分块生成向量，因此调用前必须确保该工作空间已配置可用的嵌入模型。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "content": "RAGFlow 是一个开源的 RAG 引擎。",
       "important_keywords": ["RAGFlow", "RAG"],
       "questions": ["什么是 RAGFlow？"],
       "tag_kwd": ["产品介绍"]
     }'
```

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dataset_id` | `string` | 是 | 知识库 ID |
| `document_id` | `string` | 是 | 文档 ID；该文档必须属于指定知识库 |

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `content` | `string` | 是 | 分块正文，不能为空或只包含空白字符 |
| `important_keywords` | `string[]` | 否 | 重要关键词列表，默认 `[]` |
| `questions` | `string[]` | 否 | 与分块关联的问题列表；非空问题将参与向量生成，默认 `[]` |
| `tag_kwd` | `string[]` | 否 | 标签列表，所有元素必须为字符串 |
| `tag_feas` | `object` | 否 | 标签特征分数，键为非空字符串，值为大于 `0` 的有限数值 |
| `image_base64` | `string` | 否 | 与分块关联的图片内容，仅接受不带 Data URL 前缀的有效 Base64 字符串 |

分块 ID 根据 `content` 和 `document_id` 计算。添加成功后，服务端会更新文档的分块数和 Token 数。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "chunk": {
      "id": "12ccdc56e59837e5",
      "content": "RAGFlow 是一个开源的 RAG 引擎。",
      "document_id": "61d68474be0111ef98dd0242ac120006",
      "dataset_id": "72f36e1ebdf411efb7250242ac120006",
      "important_keywords": ["RAGFlow", "RAG"],
      "questions": ["什么是 RAGFlow？"],
      "tag_kwd": ["产品介绍"],
      "create_time": "2026-07-21 10:30:00",
      "create_timestamp": 1784601000.0
    }
  }
}
```

#### 常见失败响应

```json
{
  "code": 102,
  "message": "`content` is required"
}
```

---

### 获取分块列表

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

分页获取指定文档的普通分块。知识编译生成的结构化索引不会出现在此列表中。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks?page=1&page_size=30&keywords=RAGFlow&available=true' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dataset_id` | `string` | 是 | 知识库 ID |
| `document_id` | `string` | 是 | 文档 ID；该文档必须属于指定知识库 |

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | `integer` | 否 | `1` | 页码 |
| `page_size` | `integer` | 否 | `30` | 每页数量，最大为 `100` |
| `keywords` | `string` | 否 | `""` | 按分块正文搜索；命中内容可能包含高亮标记 |
| `id` | `string` | 否 | — | 仅返回指定分块；设置后忽略分页搜索 |
| `chunk_ids` | `string` 或重复参数 | 否 | — | 按多个分块 ID 过滤；支持逗号分隔或多次传入，例如 `chunk_ids=id1,id2` |
| `available` | `string` | 否 | — | 可用状态过滤；值等于 `true` 时筛选可用分块，其他值筛选不可用分块 |

如只需读取一个分块，也可以使用下文的“获取单个分块”接口。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "chunks": [
      {
        "id": "b48c170e90f70af998485c1065490726",
        "content": "这是一个测试分块。",
        "document_id": "b330ec2e91ec11efbc510242ac120004",
        "dataset_id": "527fa74891e811ef9c650242ac120006",
        "docnm_kwd": "1.txt",
        "important_keywords": [],
        "questions": [],
        "tag_kwd": [],
        "image_id": "",
        "available": true,
        "positions": []
      }
    ],
    "doc": {
      "id": "b330ec2e91ec11efbc510242ac120004",
      "name": "1.txt",
      "dataset_id": "527fa74891e811ef9c650242ac120006",
      "chunk_count": 1,
      "chunk_method": "naive",
      "token_count": 8,
      "run": "DONE"
    }
  }
}
```

文档的 `run` 字段可能为 `UNSTART`、`RUNNING`、`CANCEL`、`DONE` 或 `FAIL`。

当 `id` 指定的分块不存在、不属于该文档或属于结构化编译结果时，接口返回非零业务状态码。

---

### 获取单个分块

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`

获取指定分块的原始索引字段。向量、分词等运行时字段会从响应中移除；返回字段名称仍采用索引存储格式，因此与分块列表接口略有不同。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dataset_id` | `string` | 是 | 知识库 ID |
| `document_id` | `string` | 是 | 文档 ID |
| `chunk_id` | `string` | 是 | 分块 ID |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "b48c170e90f70af998485c1065490726",
    "content_with_weight": "这是一个测试分块。",
    "doc_id": "b330ec2e91ec11efbc510242ac120004",
    "docnm_kwd": "1.txt",
    "kb_id": "527fa74891e811ef9c650242ac120006",
    "important_kwd": [],
    "question_kwd": [],
    "tag_kwd": [],
    "img_id": "",
    "available_int": 1
  }
}
```

#### 分块不存在

```json
{
  "code": 100,
  "data": false,
  "message": "Chunk not found!"
}
```

---

### 删除分块

**DELETE** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

按 ID 删除一个或多个分块，或者删除文档中的全部普通分块。结构化编译产生的索引不会被此接口删除。

#### 按 ID 删除

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "chunk_ids": ["chunk_id_1", "chunk_id_2"]
     }'
```

#### 删除全部普通分块

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "delete_all": true
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `chunk_ids` | `string[]` | 否 | 要删除的分块 ID；服务端会去重 |
| `delete_all` | `boolean` | 否 | 当 `chunk_ids` 缺失、为 `null` 或为空数组时，只有该值严格为 `true` 才删除全部普通分块 |

请求体为空，或既没有有效 `chunk_ids` 也没有设置 `delete_all: true` 时，接口成功返回但不会删除任何分块。

#### 成功响应

```json
{
  "code": 0,
  "message": "deleted 2 chunks"
}
```

如果实际删除数量与请求中的唯一分块 ID 数量不一致，接口返回错误，例如：

```json
{
  "code": 102,
  "message": "rm_chunk deleted chunks 1, expect 2"
}
```

---

### 更新分块

**PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`

更新分块正文或配置。更新后服务端会重新生成分词和嵌入向量。

:::caution 已弃用接口
`PUT /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` 仅用于兼容旧调用。新调用请使用本节的 `PATCH` 接口。
:::

#### 请求示例

```bash
curl --request PATCH \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "content": "更新后的分块正文",
       "important_keywords": ["更新"],
       "available": true
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `content` | `string` | 否 | 新正文；传入时不能为空。省略则保留原正文 |
| `important_keywords` | `string[]` | 否 | 替换重要关键词列表 |
| `questions` | `string[]` | 否 | 替换关联问题列表 |
| `positions` | `array` | 否 | 替换来源位置数据 |
| `tag_kwd` | `string[]` | 否 | 替换标签列表，所有元素必须为字符串 |
| `tag_feas` | `object` | 否 | 替换标签特征分数；键为非空字符串，值为大于 `0` 的有限数值 |
| `available` | `boolean` | 否 | 是否允许该分块参与检索 |
| `image_base64` | `string` | 否 | 新的关联图片，仅接受有效 Base64 字符串 |

对于使用问答分块方法的文档，正文必须包含由制表符或换行符分隔的问题和答案，否则更新会失败。

#### 成功响应

```json
{
  "code": 0
}
```

#### 分块不存在

```json
{
  "code": 102,
  "message": "Can't find this chunk 29a2d9987e16ba331fb4d7d30d99b71d2"
}
```

---

### 批量切换分块可用状态

**PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

批量设置分块是否参与检索。

#### 请求示例

```bash
curl --request PATCH \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "chunk_ids": ["chunk_id_1", "chunk_id_2"],
       "available": false
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `chunk_ids` | `string[]` | 是 | 要修改的分块 ID，不能为空 |
| `available` | `boolean` | 条件必填 | `true` 表示参与检索，`false` 表示不参与检索 |
| `available_int` | `integer` | 条件必填 | `1` 表示参与检索，`0` 表示不参与检索；与 `available` 至少提供一个 |

同时提供 `available_int` 和 `available` 时，以 `available_int` 为准。

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

常见错误包括缺少 `chunk_ids`、未提供可用状态、文档不存在或索引更新失败。

---

### 获取知识库元数据摘要

**GET** `/api/v1/datasets/{dataset_id}/metadata/summary`

汇总知识库中文档的元数据字段、值及其出现次数。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/metadata/summary?doc_ids={document_id_1},{document_id_2}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `dataset_id` | 路径 | `string` | 是 | 知识库 ID |
| `doc_ids` | 查询 | `string` | 否 | 以逗号分隔的文档 ID；省略时汇总知识库中的全部文档 |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "summary": {
      "tags": {
        "type": "string",
        "values": [["产品", 2], ["手册", 1]]
      },
      "author": {
        "type": "string",
        "values": [["张三", 2], ["李四", 1]]
      }
    }
  }
}
```

---

### 批量更新或删除文档元数据

**POST** `/api/v1/datasets/{dataset_id}/metadata/update`

批量更新或删除指定文档的元数据。该接口只修改文档级元数据，不修改分块正文。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/metadata/update' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "selector": {
         "document_ids": ["document_id_1", "document_id_2"],
         "metadata_condition": {
           "logic": "and",
           "conditions": [
             {
               "name": "author",
               "comparison_operator": "is",
               "value": "张三"
             }
           ]
         }
       },
       "updates": [
         {"key": "tags", "match": "旧标签", "value": "新标签"}
       ],
       "deletes": [
         {"key": "obsolete_key"}
       ]
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `selector` | `object` | 否 | 文档选择条件，默认 `{}` |
| `selector.document_ids` | `string[]` | 否 | 候选文档 ID；所有 ID 都必须属于当前知识库 |
| `selector.metadata_condition` | `object` | 否 | 元数据过滤条件；与 `document_ids` 同时提供时取交集 |
| `updates` | `object[]` | 否 | 更新操作列表，默认 `[]` |
| `deletes` | `object[]` | 否 | 删除操作列表，默认 `[]` |

:::caution 文档选择范围
按照当前接口行为，`document_ids` 为空或省略时不会自动选中知识库中的全部文档，而是返回匹配数 `0`。需要实际修改文档时，请明确提供 `selector.document_ids`；`metadata_condition` 用于进一步缩小这些文档的范围。
:::

`metadata_condition` 的结构如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `logic` | `string` | 多个条件之间的关系，可为 `and` 或 `or`，默认 `and` |
| `conditions` | `object[]` | 条件列表 |
| `conditions[].name` | `string` | 元数据字段名 |
| `conditions[].comparison_operator` | `string` | 比较运算符 |
| `conditions[].value` | 任意 JSON 类型 | 用于比较的值；`empty` 和 `not empty` 运算符不会使用该值 |

可用的 `comparison_operator` 包括：`is`、`not is`、`=`、`!=`、`≠`、`contains`、`not contains`、`in`、`not in`、`start with`、`end with`、`>`、`<`、`>=`、`<=`、`≥`、`≤`、`empty` 和 `not empty`。

更新操作结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | `string` | 是 | 要更新的元数据字段名 |
| `value` | 任意 JSON 类型 | 是 | 新值 |
| `match` | 任意 JSON 类型 | 否 | 仅替换当前值与其匹配的内容；省略时直接设置或追加新值 |

删除操作结构：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | `string` | 是 | 要删除的元数据字段名 |
| `value` | 任意 JSON 类型 | 否 | 指定时只删除匹配的值；省略时删除整个字段 |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "updated": 1,
    "matched_docs": 2
  }
}
```

`matched_docs` 是筛选出的文档数；`updated` 是实际发生元数据变更的文档数。

---

### 检索分块

**POST** `/api/v1/retrieval`

从一个或多个知识库中检索与问题相关的分块。所有知识库都必须对当前 Token 可见，并且必须使用同一个嵌入模型。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/retrieval' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "question": "RAGFlow 有哪些特点？",
       "dataset_ids": ["b2a62730759d11ef987d0242ac120004"],
       "document_ids": ["77df9ef4759a11ef8bdd0242ac120004"],
       "page": 1,
       "page_size": 30,
       "highlight": true,
       "reference_metadata": {
         "include": true,
         "fields": ["author", "tags"]
       }
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `question` | `string` | 是 | — | 检索问题；空字符串返回空结果 |
| `dataset_ids` | `string[]` | 是 | — | 要检索的知识库 ID，必须为数组且不能为空 |
| `document_ids` | `string[]` | 否 | `[]` | 限定文档范围；所有文档必须属于 `dataset_ids` 指定的知识库 |
| `page` | `integer` | 否 | `1` | 页码 |
| `page_size` | `integer` | 否 | `30` | 每页数量，最大为 `100` |
| `similarity_threshold` | `number` | 否 | `0.2` | 最低综合相似度 |
| `vector_similarity_weight` | `number` | 否 | `0.3` | 向量相似度权重；词项相似度权重为 `1 - vector_similarity_weight` |
| `top_k` | `integer` | 否 | `1024` | 参与向量相似度计算的候选分块数，必须大于 `0` |
| `rerank_id` | `string` | 否 | — | 重排序模型 ID |
| `keyword` | `boolean` | 否 | `false` | 是否使用默认聊天模型扩展检索关键词 |
| `highlight` | `boolean` | 否 | `false` | 是否在结果中返回命中词高亮 |
| `cross_languages` | `string[]` | 否 | `[]` | 先将问题翻译为指定语言，再进行跨语言检索 |
| `metadata_condition` | `object` | 否 | — | 按文档元数据过滤；未显式指定 `document_ids` 时生效 |
| `use_kg` | `boolean` | 否 | `false` | 是否补充知识图谱多跳检索结果 |
| `toc_enhance` | `boolean` | 否 | `false` | 是否使用目录增强检索 |
| `reference_metadata` | `object` | 否 | — | 控制是否在分块结果中附带文档元数据 |

`metadata_condition` 使用与“批量更新或删除文档元数据”相同的 `logic` 和 `conditions` 结构。

`reference_metadata` 支持以下字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `include` | `boolean` | `false` | 是否在分块中添加 `document_metadata` |
| `fields` | `string[]` | — | 仅返回指定元数据字段；省略时返回全部可用字段 |

服务端仍兼容顶层的 `include_metadata` 和 `metadata_fields` 参数，但新调用应使用 `reference_metadata`。

启用 `keyword`、`cross_languages`、`toc_enhance` 或 `use_kg` 时需要知识库工作空间中存在可用的默认聊天模型；设置 `rerank_id` 时需要存在对应的重排序模型。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "chunks": [
      {
        "id": "d78435d142bd5cf6704da62c778795c5",
        "content": "RAGFlow 相关内容",
        "document_id": "5c5999ec7be811ef9cab0242ac120005",
        "document_keyword": "1.txt",
        "dataset_id": "c7ee74067a2c11efb21c0242ac120006",
        "highlight": "<em>RAGFlow</em> 相关内容",
        "image_id": "",
        "important_keywords": [],
        "positions": [],
        "similarity": 0.9669,
        "term_similarity": 1.0,
        "vector_similarity": 0.8898,
        "document_metadata": {
          "author": "张三",
          "tags": ["产品"]
        }
      }
    ],
    "doc_aggs": [
      {
        "count": 1,
        "doc_id": "5c5999ec7be811ef9cab0242ac120005",
        "doc_name": "1.txt"
      }
    ]
  }
}
```

#### 常见失败响应

```json
{
  "code": 102,
  "message": "`dataset_ids` is required."
}
```

```json
{
  "code": 100,
  "message": "Datasets use different embedding models."
}
```

---
## 聊天助手管理

---

本章介绍聊天助手的创建、查询、更新和删除接口。聊天会话与消息接口见“会话管理”章节。

所有接口都需要：

```http
Authorization: Bearer <YOUR_API_KEY>
```

聊天助手属于个人或团队工作空间。读取操作要求调用者对所属工作空间可见；创建和写操作还会校验相应的工作空间写权限。聊天助手引用的知识库、模型和重排模型必须能在该工作空间中使用。

### 创建聊天助手

**POST** `/api/v1/chats`

#### 请求示例

```bash
curl --request POST \
  --url http://{address}/api/v1/chats \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "产品问答助手",
    "workspace_id": "<WORKSPACE_ID>",
    "dataset_ids": ["0b2cbc8c877f11ef89070242ac120005"]
  }'
```

#### 请求体参数

- `name`：`string`，必填。聊天助手名称；去除首尾空白后不能为空，UTF-8 编码长度不得超过 255 字节。同一工作空间内名称不可重复。
- `workspace_id`：`string`，可选。目标工作空间 ID；未提供时使用当前用户的个人工作空间。
- `icon`：`string`，可选。助手图标。
- `description`：`string`，可选，默认 `A helpful Assistant`。
- `dataset_ids`：`array<string>`，可选，默认空数组。关联的知识库 ID。知识库必须与聊天助手属于同一工作空间，且其嵌入模型配置必须有效。
- `llm_id`：`string`，可选。聊天模型标识或模型实例 ID。未提供时使用目标工作空间的默认聊天模型。
- `rerank_id`：`string`，可选。重排模型标识或模型实例 ID。
- `llm_setting`：`object`，可选。模型生成参数。
- `prompt_config`：`object`，可选。提示词和检索行为配置。
- `similarity_threshold`：`number`，可选，默认 `0.1`。相似度阈值。
- `vector_similarity_weight`：`number`，可选，默认 `0.3`。向量相似度权重。
- `top_n`：`integer`，可选，默认 `6`。传给模型的检索结果数量。
- `top_k`：`integer`，可选，默认 `1024`。参与候选检索的数量。

常用 `llm_setting` 字段：

- `model_type`：模型类型，通常为 `chat` 或 `image2text`。
- `temperature`：生成随机性。
- `top_p`：核采样阈值。
- `presence_penalty`：出现惩罚。
- `frequency_penalty`：频率惩罚。字段名包含下划线，不是 `frequency penalty`。
- `max_tokens`：最大输出 Token 数；具体支持情况取决于模型提供商。

常用 `prompt_config` 字段：

- `system`：系统提示词。
- `prologue`：开场白。
- `parameters`：提示词变量列表，每项包含 `key` 和 `optional`。`knowledge` 是表示检索内容的保留变量。
- `empty_response`：未检索到有效内容时的回答。
- `quote`：是否返回引用。
- `tts`：是否启用语音输出。
- `refine_multiturn`：是否结合多轮对话优化检索问题。
- `use_kg`：是否使用知识图谱。
- `reasoning`：是否启用推理相关行为。
- `cross_languages`：跨语言检索语言列表。
- `web_search_provider`：联网搜索服务，支持 `tavily`、`querit`、`serply`、`youcom`。
- `tavily_api_key`：Tavily API Key。
- `querit_api_key`：Querit API Key。
- `serply_api_key`：Serply API Key。
- `youcom_api_key`：You.com API Key。
- `toc_enhance`：是否启用目录增强。

未提供 `prompt_config` 时，服务端会补全默认系统提示词、开场白、引用等配置。如果设置了知识库，并且系统提示词包含 `{knowledge}`，服务端会补充对应参数定义。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "b1f2f15691f911ef81180242ac120003",
    "name": "产品问答助手",
    "tenant_id": "69736c5e723611efb51b0242ac120007",
    "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
    "kb_names": ["产品资料库"],
    "llm_id": "qwen-plus@Tongyi-Qianwen",
    "rerank_id": "",
    "top_n": 6,
    "top_k": 1024,
    "similarity_threshold": 0.1,
    "vector_similarity_weight": 0.3,
    "capabilities": {
      "read": true,
      "update": true,
      "delete": true
    }
  }
}
```

创建失败时会返回非零 `code`。常见原因包括名称重复、目标工作空间不可写、模型不可用，以及引用了其他工作空间的知识库。

---

### 更新聊天助手

**PUT** `/api/v1/chats/{chat_id}`

更新聊天助手配置。只处理请求中出现的顶层字段；`prompt_config` 和 `llm_setting` 等对象字段会以本次提交的对象替换对应配置。若只需合并对象中的少数字段，请使用 `PATCH` 接口。

#### 请求示例

```bash
curl --request PUT \
  --url http://{address}/api/v1/chats/{chat_id} \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "更新后的问答助手",
    "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
    "llm_setting": {
      "temperature": 0.2,
      "top_p": 0.8
    }
  }'
```

#### 参数

- `chat_id`：路径参数，必填。聊天助手 ID。
- 请求体支持创建接口中的可写配置字段。
- `workspace_id` 会被忽略；`tenant_id` 不允许提交。该接口不能移动聊天助手所属工作空间。
- `dataset_ids`、`llm_id` 和 `rerank_id` 会按聊天助手当前工作空间重新校验。

#### 成功响应

成功时返回更新后的完整聊天助手对象：

```json
{
  "code": 0,
  "data": {
    "id": "b1f2f15691f911ef81180242ac120003",
    "name": "更新后的问答助手",
    "dataset_ids": ["527fa74891e811ef9c650242ac120006"]
  }
}
```

---

### 获取聊天助手详情

**GET** `/api/v1/chats/{chat_id}`

#### 请求示例

```bash
curl --request GET \
  --url http://{address}/api/v1/chats/{chat_id} \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "b1f2f15691f911ef81180242ac120003",
    "name": "产品问答助手",
    "description": "A helpful Assistant",
    "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
    "kb_names": ["产品资料库"],
    "llm_id": "qwen-plus@Tongyi-Qianwen",
    "llm_setting": {
      "temperature": 0.1,
      "top_p": 0.3
    },
    "tenant_id": "69736c5e723611efb51b0242ac120007",
    "workspace_type": "team",
    "capabilities": {
      "read": true,
      "update": true,
      "delete": true
    }
  }
}
```

无读取权限或资源不存在时返回非零 `code`，不会泄露不可见资源的配置。

---

### 部分更新聊天助手

**PATCH** `/api/v1/chats/{chat_id}`

部分更新聊天助手。与 `PUT` 的主要区别是：`prompt_config` 和 `llm_setting` 会与现有对象进行浅合并，未提交的对象字段保持不变。

#### 请求示例

```bash
curl --request PATCH \
  --url http://{address}/api/v1/chats/{chat_id} \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "llm_setting": {
      "temperature": 0.4
    },
    "prompt_config": {
      "prologue": "您好，请问需要查询什么？"
    }
  }'
```

#### 成功响应

成功时返回更新后的完整聊天助手对象，结构与获取详情接口一致。

---

### 删除单个聊天助手

**DELETE** `/api/v1/chats/{chat_id}`

将聊天助手标记为已删除。该接口不会通过路径删除其会话数据；调用者需要对聊天助手具有删除权限。

#### 请求示例

```bash
curl --request DELETE \
  --url http://{address}/api/v1/chats/{chat_id} \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

---

### 批量删除聊天助手

**DELETE** `/api/v1/chats`

#### 按 ID 删除

```bash
curl --request DELETE \
  --url http://{address}/api/v1/chats \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "ids": [
      "b1f2f15691f911ef81180242ac120003",
      "c2f2f15691f911ef81180242ac120004"
    ]
  }'
```

#### 删除全部可管理聊天助手

```bash
curl --request DELETE \
  --url http://{address}/api/v1/chats \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{"delete_all": true}'
```

#### 请求体参数

- `ids`：`array<string>`，可选。待删除聊天助手 ID；重复 ID 会作为错误返回。
- `delete_all`：`boolean`，可选。当为 `true` 且未提供 `ids` 时，删除当前用户有权管理的全部聊天助手。
- `chat_id`：`string`，兼容字段。未提供 `ids` 和 `delete_all` 时，可用它删除单个聊天助手；新调用建议使用路径形式的单资源删除接口。

批量请求可能部分成功，此时 `data` 会包含成功数量和错误列表。

```json
{
  "code": 0,
  "data": {
    "success_count": 1,
    "errors": ["Chat(c2f2f15691f911ef81180242ac120004) not found."]
  },
  "message": "Partially deleted 1 chats with 1 errors"
}
```

---

### 获取聊天助手列表

**GET** `/api/v1/chats`

返回当前用户可见工作空间中的聊天助手。

#### 请求示例

```bash
curl --get http://{address}/api/v1/chats \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=30' \
  --data-urlencode 'keywords=产品' \
  --data-urlencode 'orderby=update_time' \
  --data-urlencode 'desc=true'
```

筛选指定工作空间时，可重复传递 `owner_ids`：

```bash
curl --get http://{address}/api/v1/chats \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'owner_ids=<WORKSPACE_ID_1>' \
  --data-urlencode 'owner_ids=<WORKSPACE_ID_2>'
```

#### 查询参数

- `id`：`string`，可选。按聊天助手 ID 精确筛选。
- `name`：`string`，可选。按名称精确筛选。
- `keywords`：`string`，可选。关键词搜索。提供 `id` 或 `name` 时会忽略该参数。
- `owner_ids`：`array<string>`，可选。工作空间 ID，可重复传递。所有 ID 都必须属于当前用户可见范围。
- `page`：`integer`，可选。页码；默认 `0` 表示不启用常规分页。
- `page_size`：`integer`，可选。每页数量；默认 `0`。
- `orderby`：`string`，默认 `create_time`。排序字段。
- `desc`：`boolean`，默认 `true`。是否降序排列。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "chats": [
      {
        "id": "b1f2f15691f911ef81180242ac120003",
        "name": "产品问答助手",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
        "kb_names": ["产品资料库"],
        "capabilities": {
          "read": true,
          "update": true,
          "delete": true
        }
      }
    ],
    "total": 1
  }
}
```

:::caution 废弃的删除方式
旧调用可以向 `DELETE /api/v1/chats` 提交 `{"chat_id":"..."}` 删除单个助手。新调用请使用 `DELETE /api/v1/chats/{chat_id}`。
:::
## 会话管理

本章介绍聊天应用和智能体的会话管理、对话调用，以及语音、思维导图和相关问题接口。

所有接口都需要在请求头中携带有效凭证：

```http
Authorization: Bearer <YOUR_API_KEY_OR_LOGIN_TOKEN>
```

:::note 工作空间权限
调用方必须能够访问目标聊天应用、智能体、搜索应用及其引用的知识库。团队工作空间中的会话按照当前团队权限共享；个人工作空间中的会话默认只对创建者可见。超级管理员可以按其全局管理权限读取和管理会话。
:::

---

## 聊天会话

### 创建聊天会话

**POST** `/api/v1/chats/{chat_id}/sessions`

为指定聊天应用创建会话。

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `name`：请求体参数，可选，会话名称，默认为 `New session`；去除首尾空白后不能为空，最长保留 255 个字符。

会话的所有者固定为当前认证用户，不能通过请求体指定其他用户。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"产品咨询"}'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "4606b4ec87ad11efbc4f0242ac120006",
    "chat_id": "2ca4b22e878011ef88fe0242ac120005",
    "name": "产品咨询",
    "user_id": "69736c5e723611efb51b0242ac120007",
    "messages": [
      {
        "role": "assistant",
        "content": "您好，请问有什么可以帮助您？"
      }
    ],
    "reference": [],
    "capabilities": {
      "read": true,
      "update": true,
      "delete": true
    }
  }
}
```

---

### 查询聊天会话列表

**GET** `/api/v1/chats/{chat_id}/sessions`

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `page`：查询参数，页码，默认为 `1`。
- `page_size`：查询参数，每页数量，默认为 `30`；设为 `0` 时返回空数组。
- `orderby`：查询参数，排序字段，默认为 `create_time`。
- `desc`：查询参数，是否降序，默认为 `true`；传入 `false` 时升序。
- `id`：查询参数，可选，按会话 ID 过滤。
- `name`：查询参数，可选，按会话名称过滤。

:::note 会话范围
团队聊天应用和超级管理员查询时可返回该聊天应用下所有可读会话；个人聊天应用只返回当前用户自己的会话。
:::

```bash
curl --get \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=20' \
  --data-urlencode 'orderby=update_time' \
  --data-urlencode 'desc=true'
```

#### 响应

```json
{
  "code": 0,
  "data": [
    {
      "id": "4606b4ec87ad11efbc4f0242ac120006",
      "chat_id": "2ca4b22e878011ef88fe0242ac120005",
      "name": "产品咨询",
      "messages": [],
      "reference": [],
      "capabilities": {
        "read": true,
        "update": true,
        "delete": true
      }
    }
  ]
}
```

---

### 获取聊天会话详情

**GET** `/api/v1/chats/{chat_id}/sessions/{session_id}`

返回会话消息、引用、聊天应用头像和权限能力。

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `session_id`：路径参数，会话 ID，且必须属于指定聊天应用。

```bash
curl --request GET \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "4606b4ec87ad11efbc4f0242ac120006",
    "chat_id": "2ca4b22e878011ef88fe0242ac120005",
    "name": "产品咨询",
    "avatar": "data:image/png;base64,...",
    "messages": [],
    "reference": []
  }
}
```

会话不存在、不属于指定聊天应用或调用方无权读取时，接口返回错误响应。

---

### 更新聊天会话

**PATCH** `/api/v1/chats/{chat_id}/sessions/{session_id}`

更新会话属性。通常仅需提交 `name`。

:::caution 已弃用的别名
`PUT /api/v1/chats/{chat_id}/sessions/{session_id}` 已弃用，仅作为兼容别名保留。新调用应使用 `PATCH`。
:::

请求体不能修改 `messages`、`message`、`reference`、`id`、`chat_id`、`dialog_id` 或 `user_id`。`name` 去除首尾空白后不能为空，最长保留 255 个字符。

```bash
curl --request PATCH \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"售后咨询"}'
```

成功时返回更新后的会话对象。

---

### 删除聊天消息

**DELETE** `/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}`

删除指定用户消息以及紧随其后的配对助手回复，同时移除对应的引用记录。

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `session_id`：路径参数，会话 ID。
- `msg_id`：路径参数，需要删除的用户消息 ID。

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

成功时返回删除消息后的完整会话对象。调用方需要具有该会话的修改权限。

---

### 更新消息反馈

**PUT** `/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback`

为助手消息设置赞同或反对反馈。反馈变化还会尝试应用到该消息引用的分块。

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `session_id`：路径参数，会话 ID。
- `msg_id`：路径参数，助手消息 ID。
- `thumbup`：请求体必填布尔值；`true` 表示赞同，`false` 表示反对。
- `feedback`：请求体可选字符串，通常在反对时填写。赞同时已有的反馈文本会被移除。

```bash
curl --request PUT \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "thumbup": false,
    "feedback": "回答遗漏了引用文档中的限制条件。"
  }'
```

成功时返回更新后的完整会话对象。如果 `thumbup` 不是布尔值，接口返回参数错误。

---

### 删除聊天会话

**DELETE** `/api/v1/chats/{chat_id}/sessions`

删除指定会话，或者删除当前调用方在该聊天应用下有权管理的全部会话。删除时也会尝试清理会话消息上传的附件。

#### 请求参数

- `chat_id`：路径参数，聊天应用 ID。
- `ids`：请求体可选数组，需要删除的会话 ID。
- `delete_all`：请求体可选布尔值；未提供有效 `ids` 且设为 `true` 时，删除全部可管理会话。

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"ids":["session_id_1","session_id_2"]}'
```

删除全部可管理会话：

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/chats/{chat_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"delete_all":true}'
```

成功时通常返回 `data: true`；部分删除成功时，`data` 包含 `success_count` 和 `errors`。

---

### 与聊天应用对话

**POST** `/api/v1/chat/completions`

该接口支持三种调用方式：

- 不提供 `chat_id`：直接使用当前账户的默认聊天模型，不保存聊天应用会话。
- 提供 `chat_id`，不提供 `session_id`：使用聊天应用配置并自动创建新会话。
- 同时提供 `chat_id` 和 `session_id`：继续已有会话。

:::caution 已弃用的别名
`POST /api/v1/chats/{chat_id}/completions` 已弃用。新调用应使用本接口，并在请求体中传入 `chat_id`。
:::

#### 请求参数

- `messages`：请求体参数，非空消息数组。每项必须包含 `role` 和 `content`。
- `question`：请求体参数，可代替 `messages` 传递最新问题；若同时缺少 `messages` 和 `question`，请求失败。
- `files`：使用 `question` 时可选，附加到生成的用户消息。
- `stream`：可选布尔值，是否使用 SSE 流式返回，默认为 `true`。
- `chat_id`：可选，聊天应用 ID。
- `session_id`：可选，会话 ID；提供时必须同时提供 `chat_id`。
- `conversation_id`：`session_id` 的兼容字段。
- `llm_id`：可选，为本次请求覆盖聊天模型；模型必须在聊天应用所属工作空间中可用。
- `pass_all_history_messages`：可选，默认为 `false`。设为 `false` 时服务端使用已保存历史并只追加请求中的最后一条用户消息；设为 `true` 时使用请求提交的完整消息历史。
- `pass_all_history`：`pass_all_history_messages` 的兼容字段。
- `legacy`：可选，默认为 `false`。设为 `true` 时流式 `answer` 使用累计文本，并将思考过程恢复为 `<think>...</think>` 文本。
- 其他模型生成参数会按照聊天模型支持情况传递，例如 `temperature`、`top_p` 和 `max_tokens`。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chat/completions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "chat_id": "{chat_id}",
    "session_id": "{session_id}",
    "stream": false,
    "messages": [
      {
        "id": "message_id",
        "role": "user",
        "content": "这份产品说明的适用范围是什么？"
      }
    ]
  }'
```

#### 非流式响应

```json
{
  "code": 0,
  "data": {
    "id": "message_id",
    "session_id": "session_id",
    "chat_id": "chat_id",
    "answer": "该产品适用于……",
    "reference": {
      "chunks": [],
      "doc_aggs": []
    },
    "final": true
  }
}
```

#### 流式响应

流式模式返回 `text/event-stream`。每条事件以 `data:` 开头，`data` 中包含本次生成的增量内容、会话 ID 和引用信息。思考模型还可能返回 `start_to_think` 或 `end_to_think` 标记。流的最后一条消息为：

```text
data:{"code":0,"message":"","data":true}
```

并非每个增量事件都包含引用信息，客户端应以最终收到的引用数据为准。

---

## 智能体会话

### 创建智能体会话

**POST** `/api/v1/agents/{agent_id}/sessions`

根据智能体当前草稿或发布版本创建空会话。多数调用方也可以直接调用智能体对话接口，由服务端自动创建会话。

#### 请求参数

- `agent_id`：路径参数，智能体 ID。
- `name`：请求体可选字符串，会话名称。
- `release`：请求体或查询参数，可选布尔值；为真时使用已发布版本，否则使用可编辑版本。

会话所有者固定为当前认证用户。Begin 组件变量不在此接口中提交，应在调用智能体对话接口时通过 `inputs` 传递。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/agents/{agent_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"审批流程演示","release":false}'
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "id": "0b02fe80780e11f084adcfdc3ed1d902",
    "agent_id": "dbb4ed366e8611f09690a55a6daec4ef",
    "name": "审批流程演示",
    "source": "agent",
    "message": [
      {
        "role": "assistant",
        "content": "您好，请问有什么可以帮助您？"
      }
    ],
    "dsl": {},
    "capabilities": {
      "read": true,
      "update": true,
      "delete": true
    }
  }
}
```

---

### 查询智能体会话列表

**GET** `/api/v1/agents/{agent_id}/sessions`

#### 请求参数

- `agent_id`：路径参数，智能体 ID。
- `page`：查询参数，页码，默认为 `1`。
- `page_size`：查询参数，每页数量，默认为 `30`。
- `orderby`：查询参数，排序字段，默认为 `update_time`。
- `desc`：查询参数，是否降序，默认为 `true`。
- `id`：查询参数，可选，按会话 ID 过滤。
- `keywords`：查询参数，可选，按关键词筛选。
- `from_date`：查询参数，可选，起始日期筛选值。
- `to_date`：查询参数，可选，结束日期筛选值。
- `dsl`：查询参数，是否返回会话 DSL，默认为 `true`；传入 `false` 时不返回 DSL。
- `exp_user_id`：查询参数。只要提供该参数，接口就切换为仅返回会话名称的轻量模式；其值本身不用于按用户筛选。

团队智能体和超级管理员可查询智能体下所有可读会话；个人智能体只返回当前用户自己的会话。

```bash
curl --get \
  --url 'http://{address}/api/v1/agents/{agent_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=20' \
  --data-urlencode 'orderby=update_time' \
  --data-urlencode 'desc=true' \
  --data-urlencode 'dsl=false'
```

#### 响应

智能体会话列表的 `total` 位于响应顶层，而不是 `data` 内。

```json
{
  "code": 0,
  "message": "success",
  "total": 1,
  "data": [
    {
      "id": "792dde22b2fa11ef97550242ac120006",
      "agent_id": "e9e2b9c2b2f911ef801d0242ac120006",
      "name": "审批流程演示",
      "source": "agent",
      "message": [],
      "capabilities": {
        "read": true,
        "update": true,
        "delete": true
      }
    }
  ]
}
```

---

### 获取智能体会话详情

**GET** `/api/v1/agents/{agent_id}/sessions/{session_id}`

返回单个智能体会话的消息、引用、DSL、附件工作空间信息和权限能力。

```bash
curl --request GET \
  --url 'http://{address}/api/v1/agents/{agent_id}/sessions/{session_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

会话必须属于指定智能体，且调用方必须具有读取权限；否则返回 `Session not found!`。

---

### 删除单个智能体会话

**DELETE** `/api/v1/agents/{agent_id}/sessions/{session_id}`

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/agents/{agent_id}/sessions/{session_id}' \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

成功响应的 `data` 为删除操作结果。调用方必须具有该会话的管理权限。

---

### 批量删除智能体会话

**DELETE** `/api/v1/agents/{agent_id}/sessions`

#### 请求参数

- `agent_id`：路径参数，智能体 ID。
- `ids`：请求体可选数组，需要删除的会话 ID。
- `delete_all`：请求体可选布尔值；未提供有效 `ids` 且设为 `true` 时，删除该智能体下当前调用方有权管理的全部会话。

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/agents/{agent_id}/sessions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"ids":["session_id_1","session_id_2"]}'
```

全部成功时返回成功响应；部分成功时 `data` 包含 `success_count` 和 `errors`。

---

### 与智能体对话

**POST** `/api/v1/agents/chat/completions`

该接口同时支持原生事件格式和 OpenAI 兼容格式。调用方必须能够访问目标智能体；继续已有会话时，会话还必须属于该智能体并允许当前用户管理。

:::caution 已弃用的别名
以下接口已弃用：

- `POST /api/v1/agents/{agent_id}/completions`
- `POST /api/v1/agents_openai/{agent_id}/chat/completions`

新调用应使用 `/api/v1/agents/chat/completions`，并在请求体中传入 `agent_id`。需要 OpenAI 兼容格式时，同时传入 `"openai-compatible": true`。
:::

#### 原生模式请求参数

- `agent_id`：必填，智能体 ID。
- `query`：用户输入；也接受兼容字段 `question`。
- `stream`：可选布尔值，是否返回 SSE 流。
- `session_id`：可选，继续已有会话；未提供时自动创建会话。
- `name`：创建新会话时的可选名称。
- `inputs`：可选对象，Begin 组件声明的输入变量。
- `files`：可选数组，供智能体或 DataFlow 使用的附件信息。
- `return_trace`：可选布尔值，默认为 `false`；为真时返回节点跟踪数据。
- `chat_template_kwargs`：可选对象，透传给底层模型聊天模板，例如 `{"enable_thinking":false}`。
- `custom_header`：可选字符串，传递给智能体画布运行时。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/agents/chat/completions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_id": "{agent_id}",
    "query": "请检查这份申请。",
    "stream": false,
    "inputs": {
      "applicant": {
        "type": "line",
        "value": "张三"
      }
    },
    "return_trace": true
  }'
```

非流式响应示例：

```json
{
  "code": 0,
  "data": {
    "message_id": "c4692a2683d911f0858253708ecb6573",
    "session_id": "c39f6f9c83d911f0858253708ecb6573",
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
      "content": "申请符合要求。",
      "reference": {},
      "trace": []
    }
  }
}
```

流式模式返回 SSE。常见事件包括：

- `message`：Message 组件产生的增量内容。
- `message_end`：Message 组件结束，可能包含 `reference` 或 `attachment`。
- `node_finished`：节点执行完成；`data` 中可包含输入、输出、错误和耗时。启用 `return_trace` 时还会包含跟踪数据。

流以 `data:[DONE]` 结束。

#### OpenAI 兼容模式

在同一接口的请求体中加入 `"openai-compatible": true`，并用 `messages` 传递非空的 OpenAI 风格消息数组。服务端取最后一条 `role=user` 消息作为问题。

- `agent_id`：必填，智能体 ID。
- `messages`：必填，非空消息数组。
- `openai-compatible`：必须为 `true`。
- `stream`：可选布尔值。
- `session_id`：可选，继续已有会话。
- `model`：可选兼容字段；实际路由仍由 `agent_id` 决定。
- `chat_template_kwargs`：可选模型聊天模板参数。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/agents/chat/completions' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "agent_id": "{agent_id}",
    "openai-compatible": true,
    "stream": false,
    "messages": [
      {
        "role": "user",
        "content": "请检查这份申请。"
      }
    ]
  }'
```

非流式响应使用 OpenAI `chat.completion` 结构；流式响应使用 `chat.completion.chunk` 结构，并以 `data: [DONE]` 结束。

---

## 语音与辅助生成

### 文本转语音

**POST** `/api/v1/chat/audio/speech`

使用当前账户的默认 TTS 模型将文本转换为 MP3 音频流。

#### 请求参数

- `text`：JSON 请求体必填字符串，需要合成的文本。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chat/audio/speech' \
  --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"text":"您好，请问有什么可以帮助您？"}' \
  --output speech.mp3
```

成功时返回 `audio/mpeg` 流，并设置禁止缓存和代理缓冲的响应头。未配置默认 TTS 模型或模型调用失败时返回错误信息；流生成期间发生的错误可能以编码后的错误数据写入响应流。

---

### 语音转文本

**POST** `/api/v1/chat/audio/transcription`

使用当前账户的默认 ASR 模型识别音频。

#### 请求参数

请求体使用 `multipart/form-data`：

- `file`：必填音频文件。支持 `.wav`、`.mp3`、`.m4a`、`.aac`、`.flac`、`.ogg`、`.webm`、`.opus` 和 `.wma`。
- `stream`：可选字符串；`true` 表示返回 SSE 流，其他值按非流式处理，默认为 `false`。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chat/audio/transcription' \
  --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
  --form 'file=@./recording.wav' \
  --form 'stream=false'
```

非流式成功响应：

```json
{
  "code": 0,
  "data": {
    "text": "您好，请问有什么可以帮助您？"
  }
}
```

流式模式返回 `text/event-stream`，事件内容由 ASR 模型提供；错误事件的结构为 `{"event":"error","text":"..."}`。

---

### 生成思维导图

**POST** `/api/v1/chat/mindmap`

根据问题和知识库检索结果生成树形思维导图。

#### 请求参数

- `question`：JSON 请求体必填字符串，中心问题或主题。
- `kb_ids`：JSON 请求体必填数组，参与检索的知识库 ID。
- `search_id`：JSON 请求体可选字符串，搜索应用 ID。提供后会合并该搜索应用配置的知识库和检索设置。

提供 `search_id` 时，调用方必须能读取该搜索应用；所有最终参与检索的知识库必须与搜索应用属于同一工作空间并允许当前用户引用。未提供 `search_id` 时，知识库必须可由当前用户的个人工作空间引用。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chat/mindmap' \
  --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "question": "检索增强生成的核心流程是什么？",
    "kb_ids": ["{dataset_id}"],
    "search_id": "{search_id}"
  }'
```

成功响应：

```json
{
  "code": 0,
  "data": {
    "name": "检索增强生成",
    "children": []
  }
}
```

---

### 生成相关问题

**POST** `/api/v1/chat/recommendation`

根据原始问题生成一组相关检索问题。问题数量由模型输出决定，并不保证固定数量。

:::caution 已弃用的别名
`POST /api/v1/sessions/related_questions` 已弃用，仅作为兼容别名保留。新调用应使用 `/api/v1/chat/recommendation`。
:::

:::caution 路径拼写
`/api/v1/chat/recommandation` 不是有效接口。请使用拼写正确的 `/api/v1/chat/recommendation`。
:::

#### 请求参数

- `question`：JSON 请求体必填字符串，原始问题。
- `search_id`：JSON 请求体可选字符串，搜索应用 ID。提供后使用该搜索应用所属工作空间的模型和生成设置；调用方必须能读取该搜索应用。

如果搜索应用配置了聊天应用，调用方还必须能读取该聊天应用。未配置聊天应用时，使用相应工作空间的默认聊天模型。

```bash
curl --request POST \
  --url 'http://{address}/api/v1/chat/recommendation' \
  --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "question": "向量检索有哪些常见优化方式？",
    "search_id": "{search_id}"
  }'
```

成功响应：

```json
{
  "code": 0,
  "data": [
    "如何选择适合向量检索的嵌入模型？",
    "向量索引参数如何影响召回率？",
    "混合检索如何改善搜索结果？"
  ]
}
```

---
## 智能体管理

本章介绍智能体的创建、查询、更新和删除接口。所有请求都需要 API Token。读取操作要求当前 Token 对智能体所属工作空间具有访问权限；创建、更新和删除操作要求具有相应的资源管理权限。

智能体中的知识库、记忆、MCP、文件及其他资源引用必须与智能体属于同一工作空间，服务端会在创建和更新 DSL 时校验引用范围。

---

### 获取智能体列表

**GET** `/api/v1/agents`

获取当前 Token 可见工作空间中的智能体或 DataFlow 列表。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/agents?page=1&page_size=30&keywords=客服&canvas_category=agent&desc=true' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `keywords` | `string` | 否 | `""` | 按名称等字段搜索 |
| `page` | `integer` | 否 | `0` | 页码；`0` 通常表示不分页 |
| `page_size` | `integer` | 否 | `0` | 每页数量，最大为 `100`；`0` 通常表示不分页 |
| `orderby` | `string` | 否 | `create_time` | 排序字段，例如 `create_time` 或 `update_time` |
| `desc` | `boolean` | 否 | `true` | 是否降序；仅字符串 `false` 表示升序 |
| `owner_ids` | `string` | 否 | — | 逗号分隔的工作空间 ID，仅允许指定当前调用方可见的工作空间 |
| `canvas_category` | `string` | 否 | — | 画布类别，例如 `Agent` 或 `DataFlow` |
| `canvas_type` | `string` | 否 | — | 画布类型过滤条件 |
| `tags` | `string` | 否 | — | 逗号分隔的标签列表 |

旧文档中的 `id`、`name` 和 `title` 不是当前列表接口的筛选参数。如需读取指定智能体，请使用 `GET /api/v1/agents/{agent_id}`。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "canvas": [
      {
        "id": "8d9ca0e2b2f911ef9ca20242ac120006",
        "title": "客服智能体",
        "description": "回答产品问题",
        "canvas_category": "Agent",
        "user_id": "69736c5e723611efb51b0242ac120007",
        "dsl": {
          "components": {},
          "graph": {"nodes": [], "edges": []}
        },
        "capabilities": {
          "read": true,
          "update": true,
          "delete": true
        },
        "create_time": 1733397036424,
        "update_time": 1733397056801
      }
    ],
    "total": 1
  }
}
```

响应中的工作空间元数据和 `capabilities` 用于说明资源归属以及当前调用方可执行的操作，实际字段以资源配置为准。

---

### 获取智能体详情

**GET** `/api/v1/agents/{agent_id}`

获取智能体完整配置。DataFlow 详情还会包含使用该 DataFlow 的知识库列表。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/agents/{agent_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `agent_id` | 路径 | `string` | 是 | 智能体 ID |

成功时 `data` 为智能体对象，包含 `dsl`、`last_publish_time`、资源归属和能力信息。无权访问或资源不存在时返回非零业务状态码及 `canvas not found.`。

---

### 创建智能体

**POST** `/api/v1/agents`

在指定工作空间创建智能体。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/agents' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "workspace_id": "69736c5e723611efb51b0242ac120007",
       "title": "客服智能体",
       "description": "回答产品问题",
       "canvas_category": "Agent",
       "dsl": {
         "components": {},
         "graph": {"nodes": [], "edges": []}
       }
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | 是 | 智能体名称；会去除首尾空白，同一工作空间和画布类别下不允许同名 |
| `dsl` | `object` | 是 | 画布 DSL；服务端会规范化并检查跨工作空间引用 |
| `workspace_id` | `string` | 否 | 目标工作空间 ID，默认使用 Token 所属工作空间；旧字段 `user_id` 仍可作为同义输入 |
| `description` | `string` | 否 | 智能体说明 |
| `canvas_category` | `string` | 否 | 画布类别，默认 `Agent`；创建 DataFlow 时使用对应类别 |
| `canvas_type` | `string` | 否 | 画布类型，默认空字符串 |
| `release` | `boolean` | 否 | 是否将当前版本标记为已发布 |
| `avatar` | `string` | 否 | 头像数据 |

资源权限由目标工作空间类型自动确定，客户端传入的权限值不能覆盖服务端规则。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "58af890a2a8911f0a71a11b922ed82d6",
    "title": "客服智能体",
    "user_id": "69736c5e723611efb51b0242ac120007",
    "canvas_category": "Agent",
    "dsl": {
      "components": {},
      "graph": {"nodes": [], "edges": []}
    }
  }
}
```

#### 常见失败响应

```json
{
  "code": 101,
  "data": false,
  "message": "No DSL data in request."
}
```

```json
{
  "code": 102,
  "message": "客服智能体 already exists."
}
```

---

### 更新智能体

**PUT** `/api/v1/agents/{agent_id}`

更新智能体配置。请求体中值为 `null` 的字段会被忽略；未提供的字段保持不变。

#### 请求示例

```bash
curl --request PUT \
     --url 'http://{address}/api/v1/agents/{agent_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "title": "新版客服智能体",
       "description": "更新后的说明",
       "dsl": {
         "components": {},
         "graph": {"nodes": [], "edges": []}
       }
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `agent_id` | 路径 | `string` | 是 | 智能体 ID |
| `title` | 请求体 | `string` | 否 | 新名称；同工作空间和画布类别下不能与其他资源重名 |
| `description` | 请求体 | `string` | 否 | 新说明 |
| `dsl` | 请求体 | `object` | 否 | 新画布 DSL；服务端会检查所有资源引用的工作空间 |
| `canvas_category` | 请求体 | `string` | 否 | 画布类别 |
| `canvas_type` | 请求体 | `string` | 否 | 画布类型；省略时当前实现会写入空字符串 |
| `release` | 请求体 | `boolean` | 否 | 是否标记为已发布；省略时当前实现会写入 `false` |

`user_id`、`workspace_id` 和 `permission` 会被服务端忽略，不能通过此接口移动智能体或修改其工作空间归属。更新 DSL 时会同步版本记录和运行副本。

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

无管理权限、DSL 无效、引用跨工作空间或名称重复时，接口返回非零业务状态码。

---

### 删除智能体

**DELETE** `/api/v1/agents/{agent_id}`

删除智能体及其关联数据。

#### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/agents/{agent_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `agent_id` | 路径 | `string` | 是 | 要删除的智能体 ID |

如果目标是 DataFlow 且仍被知识库引用，服务端会拒绝删除，并返回引用该资源的具体信息。

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

---
## 记忆管理

---

记忆用于保存对话原文以及从对话中提取的语义、事件和操作习惯。本章包含记忆配置与记忆消息接口。

所有接口都需要：

```http
Authorization: Bearer <YOUR_API_KEY>
```

记忆属于个人或团队工作空间。读取配置和消息需要对记忆具有读取权限；修改配置、写入消息、遗忘消息和修改消息状态需要写权限。团队记忆遵循当前团队协作资源权限规则。

### 创建记忆

**POST** `/api/v1/memories`

#### 请求示例

```bash
curl --request POST \
  --url http://{address}/api/v1/memories \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "客户偏好",
    "workspace_id": "<WORKSPACE_ID>",
    "memory_type": ["raw", "semantic"],
    "embd_id": "BAAI/bge-large-zh-v1.5@BAAI",
    "llm_id": "glm-4-flash@ZHIPU-AI"
  }'
```

#### 请求体参数

- `name`：`string`，必填。记忆名称，去除首尾空白后不能为空，最大 128 个字符。名称冲突时服务端会生成不重复的名称。
- `memory_type`：`array<string>`，必填。需要保存或提取的记忆类型，可组合使用：
  - `raw`：原始用户输入和助手回复。
  - `semantic`：用户或外部世界的事实性信息。
  - `episodic`：带时间信息的事件和经历。
  - `procedural`：技能、习惯和操作步骤。
- `embd_id`：`string`，必填。嵌入模型标识或模型实例 ID。
- `llm_id`：`string`，必填。用于提取记忆的聊天模型标识或模型实例 ID。
- `workspace_id`：`string`，可选。目标工作空间 ID；未提供时使用当前用户的个人工作空间。
- `tenant_id`：`string`，兼容字段。在未提供 `workspace_id` 时可指定目标工作空间，新调用建议使用 `workspace_id`。

模型会按目标工作空间解析和校验。个人空间记忆的 `permissions` 固定为 `me`，团队空间记忆固定为 `team`。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "d6775d4eeada11f08ca284ba59bc53c7",
    "name": "客户偏好",
    "tenant_id": "69736c5e723611efb51b0242ac120007",
    "memory_type": ["raw", "semantic"],
    "storage_type": "table",
    "embd_id": "BAAI/bge-large-zh-v1.5@BAAI",
    "llm_id": "glm-4-flash@ZHIPU-AI",
    "permissions": "team"
  },
  "message": true
}
```

---

### 更新记忆

**PUT** `/api/v1/memories/{memory_id}`

只更新请求中提供的字段，不能移动记忆所属工作空间。

#### 请求示例

```bash
curl --request PUT \
  --url http://{address}/api/v1/memories/{memory_id} \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "name": "更新后的客户偏好",
    "memory_size": 8388608,
    "temperature": 0.4
  }'
```

#### 参数

- `memory_id`：路径参数，必填。记忆 ID。
- `name`：`string`，可选。规则与创建接口一致。
- `avatar`：`string | null`，可选。记忆图标。
- `description`：`string | null`，可选。记忆描述。
- `memory_type`：`array<string>`，可选。记忆非空时不可修改。
- `embd_id`：`string`，可选。嵌入模型；记忆非空时不可修改。
- `llm_id`：`string`，可选。聊天模型。
- `memory_size`：`integer`，可选。容量上限，单位为字节，范围为 1～10485760（10 MiB），默认 5242880（5 MiB）。
- `forgetting_policy`：`string`，可选。目前支持 `FIFO`。
- `temperature`：`number`，可选，范围为 0～1。
- `system_prompt`：`string | null`，可选。记忆提取系统提示词。使用默认提示词时，修改 `memory_type` 会同步生成与新类型匹配的默认提示词。
- `user_prompt`：`string | null`，可选。附加用户提示词。
- `permissions`：`"me" | "team"`，可选。只能提交与当前工作空间类型一致的值，不能用它改变共享范围。

:::caution 字段名称
接口接受的权限字段是 `permissions`，不是 `permission`；系统提示词字段是 `system_prompt`，不是 `system_promot`。
:::

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "d6775d4eeada11f08ca284ba59bc53c7",
    "name": "更新后的客户偏好",
    "memory_size": 8388608,
    "temperature": 0.4
  },
  "message": true
}
```

---

### 获取记忆列表

**GET** `/api/v1/memories`

返回当前用户可见工作空间中的记忆。超级管理员可按可见范围查看全部资源。

#### 请求示例

```bash
curl --get http://{address}/api/v1/memories \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'memory_type=semantic,episodic' \
  --data-urlencode 'keywords=客户' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=50'
```

#### 查询参数

- `tenant_id`：`string`，可选。按工作空间筛选，多个 ID 可使用逗号分隔。
- `owner_ids`：`string`，可选。`tenant_id` 的同类筛选字段；多个 ID 可使用逗号分隔。
- `memory_type`：`string`，可选。按类型筛选，多个值使用逗号分隔。匹配包含任一指定类型的记忆。
- `storage_type`：`string`，可选。存储类型，目前常用值为 `table`。
- `keywords`：`string`，可选。按名称模糊搜索。
- `page`：`integer`，默认 `1`。
- `page_size`：`integer`，默认 `50`。

请求的工作空间不在当前用户可见范围时，不返回对应数据。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "memory_list": [
      {
        "id": "d6775d4eeada11f08ca284ba59bc53c7",
        "name": "客户偏好",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "owner_name": "产品团队",
        "memory_type": ["raw", "semantic"],
        "storage_type": "table",
        "permissions": "team",
        "capabilities": {
          "read": true,
          "update": true,
          "delete": true
        }
      }
    ],
    "total_count": 1
  },
  "message": true
}
```

---

### 获取记忆配置

**GET** `/api/v1/memories/{memory_id}/config`

返回记忆的完整配置，不返回消息列表。

#### 请求示例

```bash
curl --request GET \
  --url http://{address}/api/v1/memories/{memory_id}/config \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "d6775d4eeada11f08ca284ba59bc53c7",
    "name": "客户偏好",
    "memory_type": ["raw", "semantic"],
    "storage_type": "table",
    "memory_size": 5242880,
    "forgetting_policy": "FIFO",
    "temperature": 0.5,
    "system_prompt": "...",
    "user_prompt": null,
    "tenant_id": "69736c5e723611efb51b0242ac120007"
  },
  "message": true
}
```

---

### 删除记忆

**DELETE** `/api/v1/memories/{memory_id}`

删除记忆配置及其索引消息。删除前会检查资源引用；仍被智能体等资源引用时会拒绝删除，并返回引用信息。

#### 请求示例

```bash
curl --request DELETE \
  --url http://{address}/api/v1/memories/{memory_id} \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "message": true
}
```

---

### 获取记忆消息列表

**GET** `/api/v1/memories/{memory_id}`

分页读取指定记忆的消息和提取结果。

#### 请求示例

```bash
curl --get http://{address}/api/v1/memories/{memory_id} \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'agent_id=<AGENT_ID>' \
  --data-urlencode 'keywords=退款' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=50'
```

#### 查询参数

- `agent_id`：`string`，可选。按智能体 ID 筛选；可重复传递，也可用逗号分隔多个 ID。
- `keywords`：`string`，可选。消息关键词。
- `page`：`integer`，默认 `1`。
- `page_size`：`integer`，默认 `50`。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "messages": {
      "message_list": [
        {
          "message_id": 12,
          "memory_id": "d6775d4eeada11f08ca284ba59bc53c7",
          "agent_id": "<AGENT_ID>",
          "agent_name": "客服智能体",
          "session_id": "session-001",
          "user_input": "我偏好邮件联系",
          "agent_response": "已记录",
          "extract": []
        }
      ],
      "total_count": 1
    },
    "storage_type": "table"
  },
  "message": true
}
```

---

### 添加记忆消息

**POST** `/api/v1/messages`

将一轮对话提交到一个或多个记忆。服务端会异步执行记忆提取和保存；调用者必须对请求中的每个记忆都具有写权限。

#### 请求示例

```bash
curl --request POST \
  --url http://{address}/api/v1/messages \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
    "memory_id": ["d6775d4eeada11f08ca284ba59bc53c7"],
    "agent_id": "<AGENT_ID>",
    "session_id": "session-001",
    "user_input": "我偏好邮件联系",
    "agent_response": "已记录您的偏好",
    "user_id": "external-user-001"
  }'
```

#### 请求体参数

- `memory_id`：`string | array<string>`，必填。目标记忆 ID。
- `agent_id`：`string`，必填。产生该消息的智能体 ID。
- `session_id`：`string`，必填。会话 ID。
- `user_input`：`string`，必填。用户输入。
- `agent_response`：`string`，必填。智能体回复。
- `user_id`：`string`，可选。通过 API Token 调用时可记录外部用户标识；网页登录态调用时服务端始终使用当前登录用户 ID，忽略客户端伪造的归属。

#### 成功响应

```json
{
  "code": 0,
  "message": "Task queued"
}
```

如果任一目标记忆不存在或不可写，本次请求不会绕过权限写入该记忆。

---

### 遗忘消息

**DELETE** `/api/v1/messages/{memory_id}:{message_id}`

将消息的 `forget_at` 设置为当前时间，使其进入遗忘流程。该操作不是直接按主键删除消息。

#### 请求示例

```bash
curl --request DELETE \
  --url http://{address}/api/v1/messages/{memory_id}:{message_id} \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "message": true
}
```

---

### 更新消息状态

**PUT** `/api/v1/messages/{memory_id}:{message_id}`

启用或停用指定记忆消息。

#### 请求示例

```bash
curl --request PUT \
  --url http://{address}/api/v1/messages/{memory_id}:{message_id} \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{"status": false}'
```

#### 请求体参数

- `status`：`boolean`，必填。必须是 JSON 布尔值，不能使用字符串 `"true"` 或 `"false"`。

#### 成功响应

```json
{
  "code": 0,
  "message": true
}
```

---

### 搜索记忆消息

**GET** `/api/v1/messages/search`

使用向量与关键词混合检索搜索一个或多个记忆。只会搜索当前用户可读的记忆；不可见 ID 会被过滤。

#### 请求示例

```bash
curl --get http://{address}/api/v1/messages/search \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'memory_id=d6775d4eeada11f08ca284ba59bc53c7' \
  --data-urlencode 'query=用户喜欢什么联系方式' \
  --data-urlencode 'similarity_threshold=0.2' \
  --data-urlencode 'keywords_similarity_weight=0.7' \
  --data-urlencode 'top_n=5'
```

#### 查询参数

- `memory_id`：`string`，可选。可重复传递，也可用逗号分隔多个 ID。
- `query`：`string`，可选。检索文本。
- `similarity_threshold`：`number`，默认 `0.2`。
- `keywords_similarity_weight`：`number`，默认 `0.7`。关键词相似度在混合评分中的权重。
- `top_n`：`integer`，默认 `5`。最大返回数量。
- `agent_id`：`string`，可选。
- `session_id`：`string`，可选。
- `user_id`：`string`，可选。

#### 成功响应

```json
{
  "code": 0,
  "data": [
    {
      "memory_id": "d6775d4eeada11f08ca284ba59bc53c7",
      "message_id": 12,
      "content": "用户偏好邮件联系",
      "similarity": 0.86
    }
  ],
  "message": true
}
```

---

### 获取最近消息

**GET** `/api/v1/messages`

按时间获取一个或多个记忆中的最近消息。

#### 请求示例

```bash
curl --get http://{address}/api/v1/messages \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'memory_id=d6775d4eeada11f08ca284ba59bc53c7' \
  --data-urlencode 'limit=10'
```

#### 查询参数

- `memory_id`：`string`，必填。可重复传递，也可用逗号分隔多个 ID。
- `agent_id`：`string`，可选。
- `session_id`：`string`，可选。
- `limit`：`integer`，默认 `10`。

不可见的记忆会被过滤；没有任何可读记忆时返回空数组。

#### 成功响应

```json
{
  "code": 0,
  "data": [
    {
      "memory_id": "d6775d4eeada11f08ca284ba59bc53c7",
      "message_id": 12,
      "agent_id": "<AGENT_ID>",
      "session_id": "session-001"
    }
  ],
  "message": true
}
```

---

### 获取消息内容

**GET** `/api/v1/messages/{memory_id}:{message_id}/content`

返回指定消息的完整内容。调用者需要对所属记忆具有读取权限。

#### 请求示例

```bash
curl --request GET \
  --url http://{address}/api/v1/messages/{memory_id}:{message_id}/content \
  --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "memory_id": "d6775d4eeada11f08ca284ba59bc53c7",
    "message_id": 12,
    "user_input": "我偏好邮件联系",
    "agent_response": "已记录您的偏好",
    "extract": [
      {
        "content": "用户偏好邮件联系",
        "memory_type": "semantic"
      }
    ]
  },
  "message": true
}
```

不存在或无权读取时返回 `NOT_FOUND` 类型的错误响应。

---

## Langfuse 追踪配置

Langfuse 配置与当前登录账号的个人工作空间绑定。配置成功后，聊天、检索和模型调用链会自动向对应的 Langfuse 项目发送追踪数据。

网页端可以在个人中心的 **API** 页面顶部，点击 API Key 同一行最右侧的 **Langfuse** 按钮进行配置。以下接口可用于程序化管理相同的配置。

### 查询 Langfuse 配置

**GET** `/api/v1/langfuse/api-key`

#### 请求示例

```bash
curl --request GET \
  --url 'http://{address}/api/v1/langfuse/api-key' \
  --header 'Authorization: Bearer <API_TOKEN>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "host": "https://cloud.langfuse.com",
    "public_key": "<PUBLIC_KEY>",
    "secret_key": "<SECRET_KEY>",
    "project_id": "<PROJECT_ID>",
    "project_name": "<PROJECT_NAME>"
  },
  "message": ""
}
```

尚未配置时，`data` 为空，并通过 `message` 说明当前没有 Langfuse 配置。

### 保存 Langfuse 配置

**PUT** `/api/v1/langfuse/api-key`

`POST` 方法具有相同行为。服务端会先验证 Host 和密钥；验证通过后创建或覆盖当前账号的配置。

#### 请求体

| 字段         | 类型     | 必填 | 说明                                  |
| ------------ | -------- | ---- | ------------------------------------- |
| `host`       | `string` | 是   | Langfuse 服务地址，不包含项目页面路径 |
| `public_key` | `string` | 是   | Langfuse 项目的 Public Key            |
| `secret_key` | `string` | 是   | Langfuse 项目的 Secret Key            |

#### 请求示例

```bash
curl --request PUT \
  --url 'http://{address}/api/v1/langfuse/api-key' \
  --header 'Authorization: Bearer <API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "host": "https://cloud.langfuse.com",
    "public_key": "<PUBLIC_KEY>",
    "secret_key": "<SECRET_KEY>"
  }'
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "host": "https://cloud.langfuse.com",
    "public_key": "<PUBLIC_KEY>",
    "secret_key": "<SECRET_KEY>"
  },
  "message": ""
}
```

密钥验证失败时返回非零业务状态码，并在 `message` 中说明配置无效。

### 删除 Langfuse 配置

**DELETE** `/api/v1/langfuse/api-key`

#### 请求示例

```bash
curl --request DELETE \
  --url 'http://{address}/api/v1/langfuse/api-key' \
  --header 'Authorization: Bearer <API_TOKEN>'
```

#### 成功响应

```json
{
  "code": 0,
  "data": true,
  "message": ""
}
```

删除后，后续调用不再向 Langfuse 发送追踪数据。

---

## 系统接口

---

### 检查系统健康状态

**GET** `/api/v1/system/healthz`

检查数据库、Redis、文档检索引擎和对象存储是否可用。该接口不需要身份认证，适合作为容器、负载均衡器或监控系统的健康检查地址。

:::caution 已弃用接口
`GET /v1/system/healthz` 仍可通过兼容层调用，但已经弃用。新调用请使用 `GET /api/v1/system/healthz`。
:::

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/system/healthz'
```

该接口没有路径参数、查询参数或请求体。

#### 全部组件健康

HTTP 状态码为 `200`：

```json
{
  "db": "ok",
  "redis": "ok",
  "doc_engine": "ok",
  "storage": "ok",
  "status": "ok"
}
```

#### 存在异常组件

任一依赖检查失败时，HTTP 状态码为 `500`，顶层 `status` 为 `nok`：

```json
{
  "db": "ok",
  "redis": "nok",
  "doc_engine": "ok",
  "storage": "ok",
  "status": "nok",
  "_meta": {
    "redis": {
      "elapsed": "5.2",
      "error": "Lost connection!"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `db` | `string` | 数据库状态，值为 `ok` 或 `nok` |
| `redis` | `string` | Redis 状态，值为 `ok` 或 `nok` |
| `doc_engine` | `string` | 文档检索引擎状态，值为 `ok` 或 `nok` |
| `storage` | `string` | 对象存储状态，值为 `ok` 或 `nok` |
| `status` | `string` | 汇总状态；只有四项依赖全部为 `ok` 时才是 `ok` |
| `_meta` | `object` | 仅为检查失败的组件提供耗时和错误详情；成功组件不会写入该对象 |

调用方应同时检查 HTTP 状态码和响应中的 `status`。该接口直接返回健康状态对象，不使用其他业务接口常见的 `{code, data, message}` 包装结构。

---
## 文件管理

本章介绍工作空间文件、智能体运行附件以及文件版本提交接口。除特别说明外，所有接口都需要 API Token；Token 只能访问其所属工作空间内的文件。读取操作需要文件读取权限，创建、移动、重命名、删除和提交操作需要对应工作空间的写入权限。

### 已弃用的文件接口

以下兼容别名仍可调用，但新接入应使用右侧正式接口：

| 已弃用接口 | 正式接口 |
| --- | --- |
| **POST** `/api/v1/file/upload` | **POST** `/api/v1/files`，使用 `multipart/form-data` |
| **POST** `/api/v1/file/create` | **POST** `/api/v1/files`，使用 JSON |
| **GET** `/api/v1/file/list` | **GET** `/api/v1/files` |
| **GET** `/api/v1/file/root_folder` | **GET** `/api/v1/files`，省略 `parent_id` |
| **GET** `/api/v1/file/parent_folder?file_id=...` | **GET** `/api/v1/files/{file_id}/parent` |
| **GET** `/api/v1/file/all_parent_folder?file_id=...` | **GET** `/api/v1/files/{file_id}/ancestors` |
| **GET** `/api/v1/file/get/{file_id}` | **GET** `/api/v1/files/{file_id}` |
| **POST** `/api/v1/file/mv` | **POST** `/api/v1/files/move` |
| **POST** `/api/v1/file/rename` | **POST** `/api/v1/files/move`，使用 `new_name` |
| **POST** `/api/v1/file/rm` | **DELETE** `/api/v1/files` |
| **POST** `/api/v1/file/convert` | **POST** `/api/v1/files/link-to-datasets` |
| **POST** `/api/v1/file/upload_info` | **POST** `/api/v1/documents/upload` |
| **POST** `/v1/document/upload_info` | **POST** `/api/v1/documents/upload` |
| **GET** `/api/v1/document/download/{id}` | **GET** `/api/v1/agents/attachments/{id}/download` |
| **GET** `/v1/document/download/{id}` | **GET** `/api/v1/agents/attachments/{id}/download` |

---

### 上传工作空间文件

**POST** `/api/v1/files`

使用 `multipart/form-data` 上传一个或多个文件。同一接口在使用 JSON 请求体时用于创建文件夹或虚拟文件。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/files' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --form 'workspace_id={workspace_id}' \
     --form 'parent_id={folder_id}' \
     --form 'file=@./report.pdf' \
     --form 'file=@./notes.txt'
```

#### 表单参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | `file`，可重复 | 是 | 要上传的文件，至少一个；文件名不能为空 |
| `workspace_id` | `string` | 否 | 目标工作空间，默认 Token 所属工作空间 |
| `parent_id` | `string` | 否 | 父文件夹 ID，默认目标工作空间根目录；必须属于同一工作空间 |

服务端会执行工作空间及配额校验，保留上传文件携带的相对目录层级，并自动处理同目录重名。

#### 成功响应

```json
{
  "code": 0,
  "data": [
    {
      "id": "b330ec2e91ec11efbc510242ac120004",
      "name": "report.pdf",
      "size": 17966,
      "type": "pdf",
      "parent_id": "527fa74891e811ef9c650242ac120006",
      "location": "report.pdf",
      "tenant_id": "7c8983badede11f083f184ba59bc53c7"
    }
  ]
}
```

---

### 创建文件夹或虚拟文件

**POST** `/api/v1/files`

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/files' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "workspace_id": "7c8983badede11f083f184ba59bc53c7",
       "name": "项目资料",
       "parent_id": "527fa74891e811ef9c650242ac120006",
       "type": "folder"
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 名称，去除首尾空白后长度为 1 至 255 个字符 |
| `parent_id` | `string` | 否 | 父文件夹 ID，默认工作空间根目录 |
| `type` | `string` | 否 | 值为 `folder` 时创建文件夹；其他值或省略时创建 `virtual` 类型文件 |
| `workspace_id` | `string` | 否 | 目标工作空间 ID，必须是 32 个字符；默认 Token 所属工作空间 |

同一父目录下不允许创建同名文件夹或虚拟文件。

---

### 获取文件列表

**GET** `/api/v1/files`

分页获取指定文件夹的直接子项。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files?workspace_id={workspace_id}&parent_id={folder_id}&page=1&page_size=15&orderby=create_time&desc=true' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `workspace_id` | `string` | 否 | Token 所属工作空间 | 要浏览的可见工作空间 |
| `parent_id` | `string` | 否 | 工作空间根目录 | 父文件夹 ID |
| `keywords` | `string` | 否 | `""` | 名称搜索关键词 |
| `page` | `integer` | 否 | `1` | 页码，最小为 `1` |
| `page_size` | `integer` | 否 | `15` | 每页数量，范围为 `1` 至 `100` |
| `orderby` | `string` | 否 | `create_time` | 排序字段 |
| `desc` | `boolean` | 否 | `true` | 是否降序 |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "files": [
      {
        "id": "b330ec2e91ec11efbc510242ac120004",
        "name": "report.pdf",
        "type": "pdf",
        "size": 17966,
        "parent_id": "527fa74891e811ef9c650242ac120006"
      }
    ],
    "parent_folder": {
      "id": "527fa74891e811ef9c650242ac120006",
      "name": "项目资料",
      "type": "folder"
    }
  }
}
```

---

### 获取父文件夹

**GET** `/api/v1/files/{file_id}/parent`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}/parent?workspace_id={workspace_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功响应的 `data.parent_folder` 为直接父文件夹对象。文件不存在、跨工作空间或无读取权限时返回非零业务状态码。

---

### 获取所有上级文件夹

**GET** `/api/v1/files/{file_id}/ancestors`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}/ancestors?workspace_id={workspace_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功响应的 `data.parent_folders` 是上级文件夹对象数组。

---

### 下载文件

**GET** `/api/v1/files/{file_id}`

下载工作空间中的普通文件。

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}?workspace_id={workspace_id}' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --output './downloaded-file'
```

成功时直接返回文件流，并根据文件扩展名设置安全的响应头，不使用 `{code, data, message}` JSON 包装。目标是文件夹、文件为空或无读取权限时返回 JSON 错误。

---

### 移动或重命名文件

**POST** `/api/v1/files/move`

遵循类似 `mv` 的语义：仅提供 `dest_file_id` 表示移动；仅提供 `new_name` 表示原地重命名；两者同时提供表示移动并重命名。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/files/move' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "workspace_id": "7c8983badede11f083f184ba59bc53c7",
       "src_file_ids": ["b330ec2e91ec11efbc510242ac120004"],
       "dest_file_id": "527fa74891e811ef9c650242ac120006",
       "new_name": "new-report.pdf"
     }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `src_file_ids` | `string[]` | 是 | 源文件或文件夹 ID，至少一个 |
| `dest_file_id` | `string` | 条件必填 | 目标文件夹 ID |
| `new_name` | `string` | 条件必填 | 新名称，长度为 1 至 255；仅能与单个源文件一起使用 |
| `workspace_id` | `string` | 否 | 明确限定工作空间，必须是 32 个字符 |

`dest_file_id` 和 `new_name` 至少提供一个。

---

### 删除文件或文件夹

**DELETE** `/api/v1/files`

文件夹会递归删除。已关联知识库的文件会连同对应文档及索引数据一起处理；被其他资源引用的文件会被拒绝删除并返回引用信息。

#### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/files' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "workspace_id": "7c8983badede11f083f184ba59bc53c7",
       "ids": ["b330ec2e91ec11efbc510242ac120004"]
     }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ids` | `string[]` | 是 | 文件或文件夹 ID，至少一个 |
| `workspace_id` | `string` | 否 | 限定目标工作空间，必须是 32 个字符 |

成功时 `data.success_count` 为实际删除数量。批量操作部分失败时接口返回非零业务状态码，并在 `data.errors` 中列出错误。

---

### 将文件关联到知识库

**POST** `/api/v1/files/link-to-datasets`

把工作空间文件转换为知识库文档。文件夹输入会展开为其中的全部最内层文件，处理任务在后台执行。

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/files/link-to-datasets?mode=add' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "file_ids": ["b330ec2e91ec11efbc510242ac120004"],
       "kb_ids": ["527fa74891e811ef9c650242ac120006"]
     }'
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `file_ids` | 请求体 | `string[]` | 是 | — | 文件或文件夹 ID |
| `kb_ids` | 请求体 | `string[]` | 是 | — | 目标知识库 ID |
| `mode` | 查询 | `string` | 否 | `replace` | `add` 仅补充缺失关联；`replace` 先移除这些文件已有的知识库文档关联，再建立新关联 |

文件和目标知识库必须属于同一工作空间，调用方必须同时具有文件写权限和知识库修改权限。服务端会在调度后台任务前检查知识库文件数及存储配额。

成功响应：

```json
{
  "code": 0,
  "data": true
}
```

---

## 智能体运行附件

### 上传运行附件

**POST** `/api/v1/documents/upload`

上传供智能体运行时使用的附件，或抓取一个 URL 并保存为附件。该接口不会直接把附件加入知识库。

#### 上传本地文件

```bash
curl --request POST \
     --url 'http://{address}/api/v1/documents/upload' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --form 'file=@./report.pdf'
```

#### 从 URL 创建附件

```bash
curl --request POST \
     --url 'http://{address}/api/v1/documents/upload?url=https%3A%2F%2Fexample.com%2Fpage' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

`file` 和查询参数 `url` 必须且只能提供一种。可以一次上传多个 `file`；单文件返回对象，多文件返回对象数组。URL 会经过安全检查，不能用于访问受限网络地址。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "2143a03d162c11f1b80f00155d334d02",
    "name": "report.pdf",
    "extension": "pdf",
    "mime_type": "application/pdf",
    "size": 49705,
    "created_by": "be951084066611f18f5f00155d2f98f4",
    "created_at": 1772451421.7924063,
    "preview_url": null
  }
}
```

---

### 预览运行附件

**GET** `/api/v1/agents/attachments/{attachment_id}/preview`

以内联方式返回附件内容。

```bash
curl --request GET \
     --url 'http://{address}/api/v1/agents/attachments/{attachment_id}/preview?workspace_id={workspace_id}&agent_id={agent_id}&ext=pdf&filename=report.pdf' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

### 下载运行附件

**GET** `/api/v1/agents/attachments/{attachment_id}/download`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/agents/attachments/{attachment_id}/download?workspace_id={workspace_id}&agent_id={agent_id}&ext=pdf&filename=report.pdf' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --output './report.pdf'
```

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `workspace_id` | `string` | 否 | 附件所属工作空间；指定时必须同时提供可访问的 `agent_id` |
| `agent_id` | `string` | 条件必填 | 用于校验团队智能体及附件的工作空间访问权限 |
| `ext` | `string` | 否 | 文件扩展名提示，用于解析响应类型 |
| `mime_type` | `string` | 否 | MIME 类型提示 |
| `filename` | `string` | 否 | 下载文件名提示 |
| `disposition` | `string` | 否 | 仅下载接口支持；设置为 `inline` 时以内联方式返回 |

成功时直接返回文件流。附件不存在时返回 JSON 错误。

---

## 文件版本提交

文件版本接口支持三组作用域路径：

- `/api/v1/folders/{folder_id}/...`：文件夹及其子树的文件快照。
- `/api/v1/workspace/{folder_id}/...`：文件夹作用域的同义路径，其中路径参数实际是根文件夹 ID。
- `/api/v1/datasets/{dataset_id}/...`：知识库页面或产物的提交历史；该作用域使用知识库 ID，与普通工作空间文件快照不是同一历史集合。

以下各节以 `/folders/{folder_id}` 为例。将路径前缀替换为 `/workspace/{folder_id}` 或 `/datasets/{dataset_id}` 可调用对应作用域。读取接口要求作用域可读，创建提交要求作用域可写。

### 创建提交

**POST** `/api/v1/folders/{folder_id}/commits`

```bash
curl --request POST \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "message": "更新配置文件",
       "files": [
         {
           "file_id": "file_uuid",
           "file_name": "config.json",
           "operation": "modify",
           "content": "{\"key\":\"value\"}"
         }
       ]
     }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `message` | `string` | 是 | 提交说明 |
| `files` | `object[]` | 是 | 文件变更列表 |
| `files[].file_id` | `string` | 是 | 文件标识 |
| `files[].operation` | `string` | 是 | `add`、`modify`、`delete` 或 `rename` |
| `files[].file_name` | `string` | 条件必填 | 新增或命名相关操作使用的文件名 |
| `files[].content` | `string` | 条件必填 | `add` 或 `modify` 的文件内容 |
| `files[].content_hash` | `string` | 否 | 已计算的内容哈希 |
| `files[].old_name` | `string` | 条件必填 | 重命名前名称 |
| `files[].new_name` | `string` | 条件必填 | 重命名后名称 |

成功时返回提交对象，包括 `id`、`folder_id`、`parent_id`、`message`、`author_id`、`file_count`、`tree_state` 和 `create_time`。`tree_state` 是保存完整文件快照的 JSON 字符串。

---

### 获取提交列表

**GET** `/api/v1/folders/{folder_id}/commits`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits?page=1&page_size=15&order_by=create_time&desc=true' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | `integer` | 否 | `1` | 页码 |
| `page_size` | `integer` | 否 | `15` | 每页数量 |
| `order_by` | `string` | 否 | `create_time` | 排序字段；注意这里使用下划线形式 `order_by` |
| `desc` | `boolean` | 否 | `true` | 是否降序 |
| `slug` | `string` | 否 | — | 仅列出指定页面标识的提交，主要用于知识库页面提交历史 |

成功响应的 `data` 包含 `total`、`page`、`page_size` 和 `commits`。

---

### 获取提交详情

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

普通文件提交返回提交基本信息及 `files` 变更数组。知识库页面提交会返回页面标题、说明、内容和差异等扩展字段。提交必须属于 URL 指定的作用域，否则返回 `Commit not found in workspace`。

---

### 获取提交文件列表

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/files`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/files' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功时 `data` 是文件变更数组，每项包含 `id`、`file_id`、`operation`、新旧哈希、新旧存储位置和新旧名称。

---

### 比较两个提交

**GET** `/api/v1/folders/{folder_id}/commits/diff`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/diff?from={from_commit_id}&to={to_commit_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

查询参数 `from` 和 `to` 均为必填提交 ID，且两个提交都必须属于当前作用域。成功时返回变更数组，操作类型可能为 `add`、`modify`、`delete` 或 `rename`。

---

### 获取未提交变更

**GET** `/api/v1/folders/{folder_id}/changes`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/changes' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

接口递归比较当前文件树与最新提交，返回包含 `file_id`、`file_name` 和 `operation` 的变更数组。

---

### 获取提交时的文件树

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/tree`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/tree' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功时 `data` 为提交时的递归文件树，文件节点包含名称、哈希、大小、状态和存储位置。

---

### 获取提交中的文件内容

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content`

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "data": {
    "content": "提交时的文件文本内容"
  }
}
```

二进制内容会以 UTF-8 解码并使用替换字符处理无法解码的字节，因此该接口更适合读取文本文件。

---

### 获取文件版本历史

**GET** `/api/v1/files/{file_id}/versions`

获取指定文件出现在各次提交中的版本记录。

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}/versions' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

成功时 `data` 为版本数组，通常包含 `commit_id`、`operation`、`hash`、`create_time` 和提交说明。文件不存在或当前用户无读取权限时返回 `File not found`。

---
## 搜索应用管理

本章介绍搜索应用的创建、查询、更新、删除和问答接口。所有接口都需要身份认证；搜索应用及其引用的知识库必须位于同一工作空间。

---

### 创建搜索应用

**POST** `/api/v1/searches`

#### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/searches' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "workspace_id": "7c8983badede11f083f184ba59bc53c7",
       "name": "产品资料搜索",
       "description": "搜索产品知识库",
       "search_config": {
         "kb_ids": ["527fa74891e811ef9c650242ac120006"],
         "similarity_threshold": 0.2,
         "vector_similarity_weight": 0.3,
         "top_k": 1024
       }
     }'
```

#### 请求体参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 搜索应用名称；去除首尾空白后不能为空，UTF-8 编码长度不能超过 255 字节；重名时服务端会生成不重复名称 |
| `description` | `string` | 否 | 应用说明，默认空字符串 |
| `workspace_id` | `string` | 否 | 目标工作空间 ID，默认当前用户的个人工作空间；旧字段 `tenant_id` 也可作为创建时的同义输入 |
| `search_config` | `object` | 否 | 检索配置，默认 `{}` |

常用 `search_config` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kb_ids` | `string[]` | 知识库 ID；必须与搜索应用属于同一工作空间 |
| `similarity_threshold` | `number` | 最低综合相似度，常用默认值为 `0.2` |
| `vector_similarity_weight` | `number` | 向量相似度权重，常用默认值为 `0.3` |
| `top_k` | `integer` | 参与向量计算的候选分块数，常用默认值为 `1024` |
| `rerank_id` | `string` | 重排序模型 ID |
| `use_rerank` | `boolean` | 前端配置中用于表示是否启用重排序 |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "search_id": "b330ec2e91ec11efbc510242ac120006"
  }
}
```

如果目标工作空间不可写、名称无效或 `search_config.kb_ids` 跨工作空间，接口返回非零业务状态码。

---

### 获取搜索应用列表

**GET** `/api/v1/searches`

获取当前用户可见工作空间中的搜索应用。

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/searches?page=1&page_size=20&keywords=产品&owner_ids=7c8983badede11f083f184ba59bc53c7' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `keywords` | `string` | 否 | `""` | 按名称等字段搜索 |
| `page` | `integer` | 否 | `0` | 页码；`0` 表示不分页 |
| `page_size` | `integer` | 否 | `0` | 每页数量，最大为 `100`；`0` 表示不分页 |
| `orderby` | `string` | 否 | `create_time` | 排序字段 |
| `desc` | `boolean` | 否 | `true` | 是否降序；仅字符串 `false` 表示升序 |
| `owner_ids` | 重复的 `string` | 否 | — | 按工作空间过滤，可多次传入；所有值都必须是当前用户可见的工作空间 ID |

`owner_ids` 应使用重复查询参数，例如 `?owner_ids=id1&owner_ids=id2`，而不是逗号分隔字符串。

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "search_apps": [
      {
        "id": "b330ec2e91ec11efbc510242ac120006",
        "name": "产品资料搜索",
        "description": "搜索产品知识库",
        "tenant_id": "7c8983badede11f083f184ba59bc53c7",
        "search_config": {
          "kb_ids": ["527fa74891e811ef9c650242ac120006"]
        },
        "capabilities": {
          "read": true,
          "update": true,
          "delete": true
        },
        "create_time": 1729763127646
      }
    ],
    "total": 1
  }
}
```

---

### 获取搜索应用详情

**GET** `/api/v1/searches/{search_id}`

#### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/searches/{search_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `search_id` | 路径 | `string` | 是 | 搜索应用 ID |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "b330ec2e91ec11efbc510242ac120006",
    "name": "产品资料搜索",
    "description": "搜索产品知识库",
    "tenant_id": "7c8983badede11f083f184ba59bc53c7",
    "search_config": {
      "kb_ids": ["527fa74891e811ef9c650242ac120006"],
      "similarity_threshold": 0.2,
      "vector_similarity_weight": 0.3,
      "top_k": 1024
    },
    "capabilities": {
      "read": true,
      "update": true,
      "delete": true
    }
  }
}
```

资源不存在或无权读取时，接口返回非零业务状态码。

---

### 更新搜索应用

**PUT** `/api/v1/searches/{search_id}`

更新名称和检索配置。传入的 `search_config` 会与现有配置做浅合并，未传入的现有配置项会保留。

#### 请求示例

```bash
curl --request PUT \
     --url 'http://{address}/api/v1/searches/{search_id}' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "name": "产品资料高级搜索",
       "description": "使用重排序优化结果",
       "search_config": {
         "kb_ids": ["527fa74891e811ef9c650242ac120006"],
         "rerank_id": "BAAI/bge-reranker-v2-m3@BAAI",
         "top_k": 512
       }
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `search_id` | 路径 | `string` | 是 | 搜索应用 ID |
| `name` | 请求体 | `string` | 是 | 新名称，不能为空且不能与同工作空间中的其他搜索应用重名 |
| `search_config` | 请求体 | `object` | 是 | 要合并的检索配置；`kb_ids` 必须是数组且只能引用同工作空间知识库 |
| `description` | 请求体 | `string` | 否 | 新说明 |

`workspace_id` 会被服务端忽略，不能通过更新接口移动搜索应用。`search_id`、`tenant_id`、`created_by`、`id` 和时间字段也不能被客户端覆盖。

#### 成功响应

成功时 `data` 返回更新后的完整搜索应用对象，并包含资源归属和 `capabilities` 信息。

---

### 删除搜索应用

**DELETE** `/api/v1/searches/{search_id}`

#### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/searches/{search_id}' \
     --header 'Authorization: Bearer <API_TOKEN>'
```

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `search_id` | 路径 | `string` | 是 | 搜索应用 ID |

#### 成功响应

```json
{
  "code": 0,
  "data": true
}
```

---

### 使用搜索应用问答

**POST** `/api/v1/searches/{search_id}/completions`

使用搜索应用保存的配置生成答案，并以 Server-Sent Events（SSE）流返回结果。

`POST /api/v1/searches/{search_id}/completion` 是当前同时提供的单数形式别名，两者行为相同；新调用建议统一使用复数形式 `/completions`。

#### 请求示例

```bash
curl --no-buffer --request POST \
     --url 'http://{address}/api/v1/searches/{search_id}/completions' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <API_TOKEN>' \
     --data '{
       "question": "RAGFlow 的主要功能是什么？"
     }'
```

#### 参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `search_id` | 路径 | `string` | 是 | 搜索应用 ID |
| `question` | 请求体 | `string` | 是 | 用户问题 |
| `kb_ids` | 请求体 | `string[]` | 否 | 仅当搜索应用的 `search_config.kb_ids` 为空时作为后备知识库列表 |

如果搜索应用配置和请求体都没有提供 `kb_ids`，接口会提示该字段为必填。引用的知识库失去同工作空间访问权限后，服务端也会拒绝执行。

#### 流式响应

响应类型为 `text/event-stream; charset=utf-8`。每个事件以 `data:` 开头，最后一个事件的 `data` 为 `true`：

```text
data:{"code":0,"message":"","data":{"answer":"……","reference":[]}}

data:{"code":0,"message":"","data":true}
```

执行期间发生异常时，SSE 流中会返回 `code: 500` 的错误事件，随后仍发送结束事件。

---
