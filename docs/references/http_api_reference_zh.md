# RAGFlow HTTP API 中文参考

本文档是当前内部部署版本的完整 RESTful API 参考。在继续之前，请先在主站的 API 页面创建 API Token。

> **内部部署说明**
>
> - API Token 与创建时选择的个人或团队工作空间绑定，只能访问该工作空间中的资源。
> - 个人 Token 只能访问签发用户的个人资源；团队 Token 只访问其绑定团队，不随签发成员退出或团队所有者转移而改变归属。
> - 普通团队成员可以读取和使用有权访问的团队共享资源，但不能创建、修改或删除团队共享资源；团队所有者和管理员可以管理团队内的全部共享资源。
> - 超级管理员在主站拥有全部个人和团队空间的最高管理权限，但其 API Token 仍受创建时所选工作空间约束。
> - 数据源、MCP 和知识编译模板目前仅支持个人工作空间，相关接口为后续团队权限改造预留扩展空间。

---

## 错误码

---

| 错误码 | 消息 | 说明 |
|------|-----------------------|----------------------------|
| 400 | 请求错误 | 请求参数无效 |
| 401 | 未认证 | 身份认证失败或 API Token 无效 |
| 403 | 禁止访问 | 无权访问目标工作空间或资源 |
| 404 | 未找到 | 找不到指定资源 |
| 500 | 服务器内部错误 | 服务内部发生错误 |
| 1001 | 分块 ID 无效 | 指定的分块 ID 无效 |
| 1002 | 分块更新失败 | 无法更新指定分块 |

---

## 已弃用的 API 别名

以下 v0.24.0 REST API 路径已弃用。它们通过向后兼容层仍然可用，但新的集成应使用替换端点。

|已弃用的端点 |替换端点 |
|---------------------|----------------------|
| **POST** `/api/v1/chats_openai/{chat_id}/chat/completions`| **POST** `/api/v1/openai/{chat_id}/chat/completions`|
| **PUT** `/api/v1/chats/{chat_id}/sessions/{session_id}`| **PATCH** `/api/v1/chats/{chat_id}/sessions/{session_id}`|
| **POST** `/api/v1/chats/{chat_id}/completions`| **POST** `/api/v1/chat/completions`|
| **POST** `/api/v1/sessions/related_questions`| **POST** `/api/v1/chat/recommandation`|
| **PUT** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`| **PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`|
| **GET** `/v1/system/healthz`| **GET** `/api/v1/system/healthz`|
| **POST** `/v1/document/upload_info`| **POST** `/api/v1/documents/upload`|
| **POST** `/api/v1/file/upload`| **POST** `/api/v1/files`|
| **POST** `/api/v1/file/create`| **POST** `/api/v1/files`|
| **GET** `/api/v1/file/list`| **GET** `/api/v1/files`|
| **GET** `/api/v1/file/root_folder`| **GET** `/api/v1/files`|
| **GET** `/api/v1/file/parent_folder`| **GET** `/api/v1/files/{file_id}/parent`|
| **GET** `/api/v1/file/all_parent_folder`| **GET** `/api/v1/files/{file_id}/ancestors`|
| **POST** `/api/v1/file/rm`| **DELETE** `/api/v1/files`|
| **POST** `/api/v1/file/rename`| **POST** `/api/v1/files/move`|
| **GET** `/api/v1/file/get/{file_id}`| **GET** `/api/v1/files/{file_id}`|
| **POST** `/api/v1/file/mv`| **POST** `/api/v1/files/move`|
| **POST** `/api/v1/file/convert`| **POST** `/api/v1/files/link-to-datasets`|

---

## OpenAI 兼容 API

---

### 创建对话补全

**POST** `/api/v1/openai/{chat_id}/chat/completions`

为给定的聊天对话创建模型响应。

> **注意**：已废弃
`POST /api/v1/chats_openai/{chat_id}/chat/completions` 已弃用。请改用此端点。

该 API 遵循与 OpenAI 的 API 相同的请求和响应格式。它允许您以类似于使用 [OpenAI 的 API](https://platform.openai.com/docs/api-reference/chat/create) 的方式与模型交互。

#### 请求

- 方法：POST
- URL：`/api/v1/openai/{chat_id}/chat/completions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"model"`：`string`
  - `"messages"`：`object list`
  - `"stream"`：`boolean`
  - `"extra_body"`：`object`（可选）

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/openai/{chat_id}/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
        "model": "glm-4-flash@ZHIPU-AI",
        "messages": [{"role": "user", "content": "Say this is a test!"}],
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
                "value": "bob"
              }
            ]
          }
        }
      }'
```

##### 请求参数

- `chat_id`（*路径参数*）`string`，*必填*
  现有聊天助手ID。该请求将使用该聊天助手的知识和设置。

- `model`（*请求体参数*）`string`，*必填*
  用于生成响应的模型。当提供 `chat_id` 时，您还可以使用旧占位符值 `"model"` 来继续使用聊天助手的配置模型。

- `messages`（*请求体参数*）`list[object]`，*必填*
  用于生成响应的历史聊天消息列表。该消息必须至少包含一条具有 `user` 角色的消息。

- `stream` (*请求体参数*) `boolean`
  是否以流形式接收响应。如果您希望一次性接收整个响应而不是作为流，请将其明确设置为 `false`。

- `extra_body` (*请求体参数*) `object`
  额外请求参数：
  - `reference`：`boolean` - 在最后一个流式数据块或非流式消息中包含引用。
  - `reference_metadata`：`object` - 在每个引用分块中包含文档元数据。
    - `include`：`boolean` - 启用引用分块中的文档元数据。
    - `fields`：`list[string]` - 可选的元数据密钥白名单。省略包括全部。使用空列表不包含任何内容。
  - `metadata_condition`：`object` - 应用于检索结果的元数据过滤条件。

#### 响应

流：

```json
data:{
    "id": "chatcmpl-3b0397f277f511f0b47f729e3aa55728",
    "choices": [
        {
            "delta": {
                "content": "Hello! It seems like you're just greeting me. If you have a specific",
                "role": "assistant",
                "function_call": null,
                "tool_calls": null,
                "reasoning_content": null
            },
            "finish_reason": null,
            "index": 0,
            "logprobs": null
        }
    ],
    "created": 1755084508,
    "model": "model",
    "object": "chat.completion.chunk",
    "system_fingerprint": "",
    "usage": null
}

data:{"id": "chatcmpl-3b0397f277f511f0b47f729e3aa55728", "choices": [{"delta": {"content": " question or need information, feel free to ask, and I'll do my best", "role": "assistant", "function_call": null, "tool_calls": null, "reasoning_content": null}, "finish_reason": null, "index": 0, "logprobs": null}], "created": 1755084508, "model": "model", "object": "chat.completion.chunk", "system_fingerprint": "", "usage": null}

data:{"id": "chatcmpl-3b0397f277f511f0b47f729e3aa55728", "choices": [{"delta": {"content": " to assist you based on the knowledge base provided.", "role": "assistant", "function_call": null, "tool_calls": null, "reasoning_content": null}, "finish_reason": null, "index": 0, "logprobs": null}], "created": 1755084508, "model": "model", "object": "chat.completion.chunk", "system_fingerprint": "", "usage": null}

data:{"id": "chatcmpl-3b0397f277f511f0b47f729e3aa55728", "choices": [{"delta": {"content": null, "role": "assistant", "function_call": null, "tool_calls": null, "reasoning_content": null}, "finish_reason": "stop", "index": 0, "logprobs": null}], "created": 1755084508, "model": "model", "object": "chat.completion.chunk", "system_fingerprint": "", "usage": {"prompt_tokens": 5, "completion_tokens": 188, "total_tokens": 193}}

data:[DONE]
```

非流媒体：

```json
{
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "logprobs": null,
            "message": {
                "content": "Hello! I'm your smart assistant. What can I do for you?",
                "role": "assistant"
            }
        }
    ],
    "created": 1755084403,
    "id": "chatcmpl-3b0397f277f511f0b47f729e3aa55728",
    "model": "model",
    "object": "chat.completion",
    "usage": {
        "completion_tokens": 55,
        "completion_tokens_details": {
            "accepted_prediction_tokens": 55,
            "reasoning_tokens": 5,
            "rejected_prediction_tokens": 0
        },
        "prompt_tokens": 5,
        "total_tokens": 60
    }
}
```

失败：

```json
{
  "code": 102,
  "message": "The last content of this conversation is not from user."
}
```

---

### 创建智能体补全

**POST** `/api/v1/agents_openai/{agent_id}/chat/completions`

为给定的聊天对话创建模型响应。

该 API 遵循与 OpenAI 的 API 相同的请求和响应格式。它允许您以类似于使用 [OpenAI 的 API](https://platform.openai.com/docs/api-reference/chat/create) 的方式与模型交互。

#### 请求

- 方法：POST
- URL：`/api/v1/agents_openai/{agent_id}/chat/completions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"model"`：`string`
  - `"messages"`：`object list`
  - `"stream"`：`boolean`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/agents_openai/{agent_id}/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
        "model": "model",
        "messages": [{"role": "user", "content": "Say this is a test!"}],
        "stream": true
      }'
```

##### 请求参数

- `model`（*请求体参数*）`string`，*必填*
  用于生成响应的模型。服务器将自动解析它，因此您现在可以将其设置为任何值。

- `messages`（*请求体参数*）`list[object]`，*必填*
  用于生成响应的历史聊天消息列表。该消息必须至少包含一条具有 `user` 角色的消息。

- `stream` (*请求体参数*) `boolean`
  是否以流形式接收响应。如果您希望一次性接收整个响应而不是作为流，请将其明确设置为 `false`。

- `session_id` (*请求体参数*) `string`
  智能体会话 ID。

#### 响应

流：

```json
...

data: {
    "id": "c39f6f9c83d911f0858253708ecb6573",
    "object": "chat.completion.chunk",
    "model": "d1f79142831f11f09cc51795b9eb07c0",
    "choices": [
        {
            "delta": {
                "content": " terminal"
            },
            "finish_reason": null,
            "index": 0
        }
    ]
}

data: {
    "id": "c39f6f9c83d911f0858253708ecb6573",
    "object": "chat.completion.chunk",
    "model": "d1f79142831f11f09cc51795b9eb07c0",
    "choices": [
        {
            "delta": {
                "content": "."
            },
            "finish_reason": null,
            "index": 0
        }
    ]
}

data: {
    "id": "c39f6f9c83d911f0858253708ecb6573",
    "object": "chat.completion.chunk",
    "model": "d1f79142831f11f09cc51795b9eb07c0",
    "choices": [
        {
            "delta": {
                "content": "",
                "reference": {
                    "chunks": {
                        "20": {
                            "id": "4b8935ac0a22deb1",
                            "content": "```cd /usr/ports/editors/neovim/ && make install```## Android[Termux](https://github.com/termux/termux-app) offers a Neovim package.",
                            "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                            "document_name": "INSTALL22.md",
                            "document_metadata": {
                                "author": "bob",
                                "year": "2023",
                                "source": "internal"
                            },
                            "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                            "image_id": "",
                            "positions": [
                                [
                                    12,
                                    11,
                                    11,
                                    11,
                                    11
                                ]
                            ],
                            "url": null,
                            "similarity": 0.5697155305154673,
                            "vector_similarity": 0.7323851005515574,
                            "term_similarity": 0.5000000005,
                            "doc_type": ""
                        }
                    },
                    "doc_aggs": {
                        "INSTALL22.md": {
                            "doc_name": "INSTALL22.md",
                            "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                            "count": 3
                        },
                        "INSTALL.md": {
                            "doc_name": "INSTALL.md",
                            "doc_id": "4bd7fdd85e1511f0907f09f583941b45",
                            "count": 2
                        },
                        "INSTALL(1).md": {
                            "doc_name": "INSTALL(1).md",
                            "doc_id": "4bdfb42e5e1511f0907f09f583941b45",
                            "count": 2
                        },
                        "INSTALL3.md": {
                            "doc_name": "INSTALL3.md",
                            "doc_id": "4bdab5825e1511f0907f09f583941b45",
                            "count": 1
                        }
                    }
                }
            },
            "finish_reason": null,
            "index": 0
        }
    ]
}

data: [DONE]
```

非流媒体：

```json
{
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "logprobs": null,
            "message": {
                "content": "\nTo install Neovim, the process varies depending on your operating system:\n\n### For Windows:\n1. **Download from GitHub**: \n   - Visit the [Neovim releases page](https://github.com/neovim/neovim/releases)\n   - Download the latest Windows installer (nvim-win64.msi)\n   - Run the installer and follow the prompts\n\n2. **Using winget** (Windows Package Manager):\n...",
                "reference": {
                    "chunks": {
                        "20": {
                            "content": "```cd /usr/ports/editors/neovim/ && make install```## Android[Termux](https://github.com/termux/termux-app) offers a Neovim package.",
                            "dataset_id": "456ce60c5e1511f0907f09f583941b45",
                            "doc_type": "",
                            "document_id": "4bdd2ff65e1511f0907f09f583941b45",
                            "document_name": "INSTALL22.md",
                            "document_metadata": {
                                "author": "bob",
                                "year": "2023",
                                "source": "internal"
                            },
                            "id": "4b8935ac0a22deb1",
                            "image_id": "",
                            "positions": [
                                [
                                    12,
                                    11,
                                    11,
                                    11,
                                    11
                                ]
                            ],
                            "similarity": 0.5697155305154673,
                            "term_similarity": 0.5000000005,
                            "url": null,
                            "vector_similarity": 0.7323851005515574
                        }
                    },
                    "doc_aggs": {
                        "INSTALL(1).md": {
                            "count": 2,
                            "doc_id": "4bdfb42e5e1511f0907f09f583941b45",
                            "doc_name": "INSTALL(1).md"
                        },
                        "INSTALL.md": {
                            "count": 2,
                            "doc_id": "4bd7fdd85e1511f0907f09f583941b45",
                            "doc_name": "INSTALL.md"
                        },
                        "INSTALL22.md": {
                            "count": 3,
                            "doc_id": "4bdd2ff65e1511f0907f09f583941b45",
                            "doc_name": "INSTALL22.md"
                        },
                        "INSTALL3.md": {
                            "count": 1,
                            "doc_id": "4bdab5825e1511f0907f09f583941b45",
                            "doc_name": "INSTALL3.md"
                        }
                    }
                },
                "role": "assistant"
            }
        }
    ],
    "created": null,
    "id": "c39f6f9c83d911f0858253708ecb6573",
    "model": "d1f79142831f11f09cc51795b9eb07c0",
    "object": "chat.completion",
    "param": null,
    "usage": {
        "completion_tokens": 415,
        "completion_tokens_details": {
            "accepted_prediction_tokens": 0,
            "reasoning_tokens": 0,
            "rejected_prediction_tokens": 0
        },
        "prompt_tokens": 6,
        "total_tokens": 421
    }
}
```

失败：

```json
{
  "code": 102,
  "message": "The last content of this conversation is not from user."
}
```

## 知识库管理

---

### 创建知识库

**POST** `/api/v1/datasets`

创建知识库。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"avatar"`：`string`
  - `"description"`：`string`
  - `"embedding_model"`：`string`
  - `"permission"`：`string`
  - `"chunk_method"`：`string`
  - `"parser_config"`：`object`
  - `"parse_type"`：`int`
  - `"pipeline_id"`：`string`

##### 基本请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
      "name": "test_1"
      }'
```

##### 指定数据摄取流水线的请求示例

> **注意**：警告
在指定数据摄取流水线时，您必须*不*包括`"chunk_method"`或`"parser_config"`。

```bash
curl --request POST \
  --url http://{address}/api/v1/datasets \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data '{
   "name": "test-sdk",
   "parse_type": <NUMBER_OF_PARSERS_IN_YOUR_PARSER_COMPONENT>,
   "pipeline_id": "<PIPELINE_ID_32_HEX>"
  }'
```

##### 请求参数

- `"name"`：（*请求体参数*），`string`，*必填*
  要创建的知识库的唯一名称。它必须遵守以下要求：
  - 仅基本多语言平面 (BMP)
  - 最多 128 个字符
  - 不区分大小写

- `"avatar"`：（*请求体参数*），`string`
  头像的 Base64 编码。
  - 最多 65535 个字符

- `"description"`：（*请求体参数*），`string`
  要创建的知识库的简要描述。
  - 最多 65535 个字符

- `"embedding_model"`：（*请求体参数*），`string`
  要使用的嵌入模型的名称。例如：`"BAAI/bge-large-zh-v1.5@BAAI"`
  - 最多 255 个字符
  - 必须遵循 `model_name@model_factory` 格式

- `"permission"`：（*请求体参数*），`string`
  指定谁可以访问要创建的知识库。可用选项：
  - `"me"`：（默认）只有您可以管理知识库。
  - `"team"`：团队成员可以读取和使用该知识库；只有团队所有者、团队管理员和超级管理员可以创建或管理团队共享资源。

- `"chunk_method"`：（*请求体参数*），`enum<string>`
  要创建的知识库的默认分块方法。与 `"parse_type"` 和 `"pipeline_id"` 互斥。如果您设置 `"chunk_method"`，请勿包含 `"parse_type"` 或 `"pipeline_id"`。
  可用选项：
  - `"naive"`：常规（默认）
  - `"book"`：书籍
  - `"email"`：电子邮件
  - `"laws"`：法律
  - `"manual"`：手册
  - `"one"`：一
  - `"paper"`：纸
  - `"picture"`：图片
  - `"presentation"`：演示
  - `"qa"`：问答
  - `"table"`：表
  - `"tag"`：标签

- `"parser_config"`：（*请求体参数*），`object`
  知识库解析器的配置设置。此 JSON 对象中的属性随所选的 `"chunk_method"` 的不同而变化：
  - 如果 `"chunk_method"` 为 `"naive"`，则 `"parser_config"` 对象包含以下属性：
    - `"auto_keywords"`：`int`
      - 默认为`0`
      - 最小值：`0`
      - 最大值：`32`
    - `"auto_questions"`：`int`
      - 默认为`0`
      - 最小值：`0`
      - 最大值：`10`
    - `"chunk_token_num"`：`int`
      - 默认为`512`
      - 最小值：`1`
      - 最大值：`2048`
    - `"delimiter"`：`string`
      - 默认为`"\n"`。
    - `"html4excel"`：`bool`
      - 是否将 Excel 文档转换为 HTML 格式。
      - 默认为`false`
    - `"layout_recognize"`：`string`
      - 默认为`DeepDOC`
    - `"tag_kb_ids"`：`array<string>`
      - 使用Tag chunk方法解析的知识库ID。
      - 在设置此选项之前，请确保已创建并正确配置标签集。详情请参见[使用标签集](https://ragflow.io/docs/dev/use_tag_sets)。
    - `"task_page_size"`：`int`
      - 仅适用于 PDF。
      - 默认为`12`
      - 最小值：`1`
    - `"raptor"`：`object` RAPTOR 特定设置。
      - 默认为：`{"use_raptor": false}`
    - `"graphrag"`：`object` GRAPHRAG 特定设置。
      - 默认为：`{"use_graphrag": false}`
    - `"parent_child"`：`object`父子分块设置。启用后，每个分块将使用`children_delimiter`进一步分割成更小的子分块。在检索时，匹配的子分块在传递给 LLM 之前会被其父分块的全文替换，从而提供与更广泛上下文的精确向量匹配。
      - `"use_parent_child"`：`bool`是否启用父子分块。默认为`false`。
      - `"children_delimiter"`：`string` 用于将父分块分割为子分块的分隔符。仅当`"use_parent_child"`为`true`时生效。默认为`"\n"`。
  - 如果`"chunk_method"`是`"qa"`、`"manual"`、`"paper"`、`"book"`、`"laws"`，或`"presentation"`，`"parser_config"`对象包含以下属性：
    - `"raptor"`：`object` RAPTOR 特定设置。
      - 默认为：`{"use_raptor": false}`。
  - 如果 `"chunk_method"` 为 `"table"`、`"picture"`、`"one"` 或 `"email"`，则 `"parser_config"` 是空 JSON 对象。

- `"parse_type"`：（*请求体参数*），`int`
  数据摄取流水线解析类型标识符，即 **解析器**组件中的解析器数量。
  - 如果指定数据摄取流水线，则为必需（与 `"pipeline_id"` 一起）。
  - 当指定 `"chunk_method"` 时不得包含在内。

- `"pipeline_id"`：（*请求体参数*），`string`
  数据摄取流水线 ID。可以在 RAGFlow UI 中的相应 URL 中找到。
  - 如果指定数据摄取流水线，则为必需（与 `"parse_type"` 一起）。
  - 必须是 32 个字符的小写十六进制字符串，例如 `"d0bebe30ae2211f0970942010a8e0005"`。
  - 当指定 `"chunk_method"` 时不得包含在内。

> **注意**：警告
创建知识库时，您可以选择以下任一提取选项，但*不*两者都适用：

- 使用内置分块方法 - 指定`"chunk_method"`（可选地`"parser_config"`）。
- 使用数据摄取流水线 - 指定 `"parse_type"` 和 `"pipeline_id"`。

如果未提供 `"chunk_method"`、`"parse_type"` 或 `"pipeline_id"`，则系统默认为 `chunk_method = "naive"`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "avatar": null,
        "chunk_count": 0,
        "chunk_method": "naive",
        "create_date": "Mon, 28 Apr 2025 18:40:41 GMT",
        "create_time": 1745836841611,
        "created_by": "3af81804241d11f0a6a79f24fc270c7f",
        "description": null,
        "document_count": 0,
        "embedding_model": "BAAI/bge-large-zh-v1.5@BAAI",
        "id": "3b4de7d4241d11f0a6a79f24fc270c7f",
        "language": "English",
        "name": "RAGFlow example",
        "pagerank": 0,
        "parser_config": {
            "chunk_token_num": 128,
            "delimiter": "\\n!?;。；！？",
            "html4excel": false,
            "layout_recognize": "DeepDOC",
            "raptor": {
                "use_raptor": false
                }
            },
        "permission": "me",
        "similarity_threshold": 0.2,
        "status": "1",
        "tenant_id": "3af81804241d11f0a6a79f24fc270c7f",
        "token_num": 0,
        "update_date": "Mon, 28 Apr 2025 18:40:41 GMT",
        "update_time": 1745836841611,
        "vector_similarity_weight": 0.3,
    },
}
```

失败：

```json
{
    "code": 101,
    "message": "Field: <name> - Message: <String should have at least 1 character> - Value: <>"
}
```

---

### 删除知识库

**DELETE** `/api/v1/datasets`

按 ID 删除知识库。

#### 请求

- 方法：DELETE
- URL：`/api/v1/datasets`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`或`null`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
     "ids": ["d94a8dc02c9711f0930f7fbc369eab6d", "e94a8dc02c9711f0930f7fbc369eab6e"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
     "delete_all": true
     }'
```

##### 请求参数

- `"ids"`：（*请求体参数*），`list[string]`或`null`
  指定要删除的知识库：
  - 如果省略或设置为 `null` 或空数组，则不会删除任何知识库。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的知识库。
- `"delete_all"`：（*请求体参数*），`boolean`
  当`"ids"`被省略，或设置为`null`或空数组时，是否删除当前用户拥有的所有知识库。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code":108,
    "message":"User '<tenant_id>' lacks permission for datasets: '<dataset_ids>'"
}

```

---

### 更新知识库

**PUT** `/api/v1/datasets/{dataset_id}`

更新指定知识库的配置。

#### 请求

- 方法：PUT
- URL：`/api/v1/datasets/{dataset_id}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"avatar"`：`string`
  - `"description"`：`string`
  - `"embedding_model"`：`string`
  - `"permission"`：`string`
  - `"chunk_method"`：`string`
  - `"pagerank"`：`int`
  - `"parser_config"`：`object`

##### 请求示例

```bash
curl --request PUT \
     --url http://{address}/api/v1/datasets/{dataset_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name": "updated_dataset"
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  要更新的知识库的 ID。
- `"name"`：（*请求体参数*），`string`
  知识库的修订名称。
  - 仅基本多语言平面 (BMP)
  - 最多 128 个字符
  - 不区分大小写
- `"avatar"`：（*请求体参数*），`string`
  更新后的头像的base64编码。
  - 最多 65535 个字符
- `"embedding_model"`：（*请求体参数*），`string`
  更新后的嵌入模型名称。
  - 在更新 `"embedding_model"` 之前，确保 `"chunk_count"` 为 `0`。
  - 最多 255 个字符
  - 必须遵循 `model_name@model_factory` 格式
- `"permission"`：（*请求体参数*），`string`
  更新的知识库权限。可用选项：
  - `"me"`：（默认）只有您可以管理知识库。
  - `"team"`：团队成员可以读取和使用该知识库；只有团队所有者、团队管理员和超级管理员可以创建或管理团队共享资源。
- `"pagerank"`：（*请求体参数*），`int`
  参考[设置页面排名](https://ragflow.io/docs/dev/set_page_rank)。
  - 默认值：`0`
  - 最小值：`0`
  - 最大值：`100`
- `"chunk_method"`：（*请求体参数*），`enum<string>`
  知识库的分块方法。可用选项：
  - `"naive"`：常规（默认）
  - `"book"`：书籍
  - `"email"`：电子邮件
  - `"laws"`：法律
  - `"manual"`：手册
  - `"one"`：一
  - `"paper"`：纸
  - `"picture"`：图片
  - `"presentation"`：演示
  - `"qa"`：问答
  - `"table"`：表
  - `"tag"`：标签
- `"parser_config"`：（*请求体参数*），`object`
  知识库解析器的配置设置。此 JSON 对象中的属性随所选的 `"chunk_method"` 的不同而变化：
  - 如果 `"chunk_method"` 为 `"naive"`，则 `"parser_config"` 对象包含以下属性：
    - `"auto_keywords"`：`int`
      - 默认为`0`
      - 最小值：`0`
      - 最大值：`32`
    - `"auto_questions"`：`int`
      - 默认为`0`
      - 最小值：`0`
      - 最大值：`10`
    - `"chunk_token_num"`：`int`
      - 默认为`512`
      - 最小值：`1`
      - 最大值：`2048`
    - `"delimiter"`：`string`
      - 默认为`"\n"`。
    - `"html4excel"`: `bool` 指示是否将 Excel 文档转换为 HTML 格式。
      - 默认为`false`
    - `"layout_recognize"`：`string`
      - 默认为 `DeepDOC`
    - `"tag_kb_ids"`：`array<string>`参考[使用标签集](https://ragflow.io/docs/dev/use_tag_sets)
      - 必须包含知识库 ID 列表，其中每个知识库均使用标签分块方法进行解析
    - `"task_page_size"`：`int` 仅适用于 PDF。
      - 默认为`12`
      - 最小值：`1`
    - `"raptor"`：`object` RAPTOR 特定设置。
      - 默认为：`{"use_raptor": false}`
    - `"graphrag"`：`object` GRAPHRAG 特定设置。
      - 默认为：`{"use_graphrag": false}`
    - `"parent_child"`：`object`父子分块设置。启用后，每个分块将使用`children_delimiter`进一步分割成更小的子分块。在检索时，匹配的子分块在传递给 LLM 之前会被其父分块的全文替换，从而提供与更广泛上下文的精确向量匹配。
      - `"use_parent_child"`：`bool`是否启用父子分块。默认为`false`。
      - `"children_delimiter"`: `string` 用于将父分块分割为子分块的分隔符。仅当`"use_parent_child"`为`true`时生效。默认为`"\n"`。
  - 如果`"chunk_method"`是`"qa"`、`"manual"`、`"paper"`、`"book"`、`"laws"`，或`"presentation"`，`"parser_config"`对象包含以下属性：
    - `"raptor"`：`object` RAPTOR 特定设置。
      - 默认为：`{"use_raptor": false}`。
  - 如果 `"chunk_method"` 为 `"table"`、`"picture"`、`"one"` 或 `"email"`，则 `"parser_config"` 是空 JSON 对象。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "Can't change tenant_id."
}
```

---

### 列出知识库

**GET** `/api/v1/datasets?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={dataset_name}&id={dataset_id}&include_parsing_status={include_parsing_status}`

列出知识库。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={dataset_name}&id={dataset_id}&include_parsing_status={include_parsing_status}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={dataset_name}&id={dataset_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

```bash
# List datasets with parsing status
curl --request GET \
     --url 'http://{address}/api/v1/datasets?include_parsing_status=true' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `page`：（*过滤器参数*）
  指定将显示知识库的页面。默认为 `1`。
- `page_size`：（*过滤器参数*）
  每页上的知识库数量。默认为`30`。
- `orderby`：（*过滤器参数*）
  知识库排序所依据的字段。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*）
  指示检索的知识库是否应按降序排序。默认为`true`。
- `name`：（*过滤器参数*）
  要检索的知识库的名称。
- `id`：（*过滤器参数*）
  要检索的知识库的 ID。
- `include_parsing_status`：（*过滤器参数*）
  是否在响应中包含文档解析状态计数。默认为`false`。当设置为 `true` 时，响应中的每个知识库对象将包含以下附加字段：
  - `unstart_count`：尚未开始解析的文档数量。
  - `running_count`：当前正在解析的文档数量。
  - `cancel_count`：解析被取消的文档数量。
  - `done_count`：已成功解析的文档数。
  - `fail_count`：解析失败的文档数。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "avatar": "",
            "chunk_count": 59,
            "create_date": "Sat, 14 Sep 2024 01:12:37 GMT",
            "create_time": 1726276357324,
            "created_by": "69736c5e723611efb51b0242ac120007",
            "description": null,
            "document_count": 1,
            "embedding_model": "BAAI/bge-large-zh-v1.5",
            "id": "6e211ee0723611efa10a0242ac120007",
            "language": "English",
            "name": "mysql",
            "chunk_method": "naive",
            "parser_config": {
                "chunk_token_num": 8192,
                "delimiter": "\\n",
                "entity_types": [
                    "organization",
                    "person",
                    "location",
                    "event",
                    "time"
                ]
            },
            "permission": "me",
            "similarity_threshold": 0.2,
            "status": "1",
            "tenant_id": "69736c5e723611efb51b0242ac120007",
            "token_num": 12744,
            "update_date": "Thu, 10 Oct 2024 04:07:23 GMT",
            "update_time": 1728533243536,
            "vector_similarity_weight": 0.3
        }
    ],
    "total_datasets": 1
}
```

成功（`include_parsing_status=true`）：

```json
{
    "code": 0,
    "data": [
        {
            "avatar": null,
            "cancel_count": 0,
            "chunk_count": 30,
            "chunk_method": "qa",
            "create_date": "2026-03-09T18:57:13",
            "create_time": 1773053833094,
            "created_by": "928f92a210b911f1ac4cc39e0b8fa3ad",
            "description": null,
            "document_count": 1,
            "done_count": 1,
            "embedding_model": "text-embedding-v2@Tongyi-Qianwen",
            "fail_count": 0,
            "id": "ba6586c21ba611f1a3dc476f0709e75e",
            "language": "English",
            "name": "Test Dataset",
            "parser_config": {
                "graphrag": { "use_graphrag": false },
                "llm_id": "deepseek-chat@DeepSeek",
                "raptor": { "use_raptor": false }
            },
            "permission": "me",
            "running_count": 0,
            "similarity_threshold": 0.2,
            "status": "1",
            "tenant_id": "928f92a210b911f1ac4cc39e0b8fa3ad",
            "token_num": 1746,
            "unstart_count": 0,
            "update_date": "2026-03-09T18:59:32",
            "update_time": 1773053972723,
            "vector_similarity_weight": 0.3
        }
    ],
    "total_datasets": 1
}
```

失败：

```json
{
    "code": 102,
    "message": "The dataset doesn't exist"
}
```

 ---

### 获取知识图谱

**GET** `/api/v1/datasets/{dataset_id}/knowledge_graph`

检索指定知识库的知识图谱。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/knowledge_graph`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/knowledge_graph \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "graph": {
            "directed": false,
            "edges": [
                {
                    "description": "The notice is a document issued to convey risk warnings and operational alerts.<SEP>The notice is a specific instance of a notification document issued under the risk warning framework.",
                    "keywords": ["9", "8"],
                    "source": "notice",
                    "source_id": ["8a46cdfe4b5c11f0a5281a58e595aa1c"],
                    "src_id": "xxx",
                    "target": "xxx",
                    "tgt_id": "xxx",
                    "weight": 17.0
                }
            ],
            "graph": {
                "source_id": ["8a46cdfe4b5c11f0a5281a58e595aa1c", "8a7eb6424b5c11f0a5281a58e595aa1c"]
            },
            "multigraph": false,
            "nodes": [
                {
                    "description": "xxx",
                    "entity_name": "xxx",
                    "entity_type": "ORGANIZATION",
                    "id": "xxx",
                    "pagerank": 0.10804906590624092,
                    "rank": 3,
                    "source_id": ["8a7eb6424b5c11f0a5281a58e595aa1c"]
                }
            ]
        },
        "mind_map": {}
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "The dataset doesn't exist"
}
```

---

### 删除知识图谱

**DELETE** `/api/v1/datasets/{dataset_id}/knowledge_graph`

删除指定知识库的知识图谱。

#### 请求

- 方法：DELETE
- URL：`/api/v1/datasets/{dataset_id}/knowledge_graph`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/knowledge_graph \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 102,
    "message": "The dataset doesn't exist"
}
```

---

### 构建知识图谱

**POST** `/api/v1/datasets/{dataset_id}/run_graphrag`

从指定的知识库构建知识图。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/run_graphrag`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/run_graphrag \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code":0,
    "data":{
      "graphrag_task_id":"e498de54bfbb11f0ba028f704583b57b"
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Invalid Dataset ID"
}
```

---

### 获取知识图谱构建状态

**GET** `/api/v1/datasets/{dataset_id}/trace_graphrag`

检索指定知识库的知识图构建状态。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/trace_graphrag`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/trace_graphrag \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code":0,
    "data":{
        "begin_at":"Wed, 12 Nov 2025 19:36:56 GMT",
        "chunk_ids":"",
        "create_date":"Wed, 12 Nov 2025 19:36:56 GMT",
        "create_time":1762947416350,
        "digest":"39e43572e3dcd84f",
        "doc_id":"44661c10bde211f0bc93c164a47ffc40",
        "from_page":100000000,
        "id":"e498de54bfbb11f0ba028f704583b57b",
        "priority":0,
        "process_duration":2.45419,
        "progress":1.0,
        "progress_msg":"19:36:56 created task graphrag\n19:36:57 Task has been received.\n19:36:58 [GraphRAG] doc:083661febe2411f0bc79456921e5745f has no available chunks, skip generation.\n19:36:58 [GraphRAG] build_subgraph doc:44661c10bde211f0bc93c164a47ffc40 start (chunks=1, timeout=10000000000s)\n19:36:58 Graph already contains 44661c10bde211f0bc93c164a47ffc40\n19:36:58 [GraphRAG] build_subgraph doc:44661c10bde211f0bc93c164a47ffc40 empty\n19:36:58 [GraphRAG] kb:33137ed0bde211f0bc93c164a47ffc40 no subgraphs generated successfully, end.\n19:36:58 Knowledge Graph done (0.72s)","retry_count":1,
        "task_type":"graphrag",
        "to_page":100000000,
        "update_date":"Wed, 12 Nov 2025 19:36:58 GMT",
        "update_time":1762947418454
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Invalid Dataset ID"
}
```

---

### 构建 RAPTOR

**POST** `/api/v1/datasets/{dataset_id}/run_raptor`

从指定的知识库构造 RAPTOR。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/run_raptor`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/run_raptor \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code":0,
    "data":{
        "raptor_task_id":"50d3c31cbfbd11f0ba028f704583b57b"
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Invalid Dataset ID"
}
```

---

### 获取 RAPTOR 构建状态

**GET** `/api/v1/datasets/{dataset_id}/trace_raptor`

检索指定知识库的 RAPTOR 构建状态。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/trace_raptor`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/trace_raptor \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  目标知识库的ID。

#### 响应

成功：

```json
{
    "code":0,
    "data":{
        "begin_at":"Wed, 12 Nov 2025 19:47:07 GMT",
        "chunk_ids":"",
        "create_date":"Wed, 12 Nov 2025 19:47:07 GMT",
        "create_time":1762948027427,
        "digest":"8b279a6248cb8fc6",
        "doc_id":"44661c10bde211f0bc93c164a47ffc40",
        "from_page":100000000,
        "id":"50d3c31cbfbd11f0ba028f704583b57b",
        "priority":0,
        "process_duration":0.948244,
        "progress":1.0,
        "progress_msg":"19:47:07 created task raptor\n19:47:07 Task has been received.\n19:47:07 Processing...\n19:47:07 Processing...\n19:47:07 Indexing done (0.01s).\n19:47:07 Task done (0.29s)",
        "retry_count":1,
        "task_type":"raptor",
        "to_page":100000000,
        "update_date":"Wed, 12 Nov 2025 19:47:07 GMT",
        "update_time":1762948027948
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Invalid Dataset ID"
}
```

---

## 知识库中的文件管理

---

### 上传文件

**POST** `/api/v1/datasets/{dataset_id}/documents`

将文档上传到指定的知识库。

该端点通过可选的`type`查询参数支持三种创建模式：

- `type=local`或省略：使用`multipart/form-data`上传一个或多个本地文件。
- `type=web`：抓取网页并将其另存为文档。
- `type=empty`：按名称创建一个空的虚拟文档。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/documents`
- 查询：
  - `type`：可选。 `local`、`web` 或 `empty` 之一。默认为`local`。
- 请求头：
  - `'Content-Type: multipart/form-data'` 对于 `type=local` 和 `type=web`
  - `'Content-Type: application/json'` 为 `type=empty`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - 对于`type=local`：表单字段`'file=@{FILE_PATH}'`
  - 对于 `type=web`：表单字段 `'name'` 和 `'url'`
  - 对于 `type=empty`：带有 `'name'` 的 JSON 正文

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents \
     --header 'Content-Type: multipart/form-data' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --form 'file=@./test1.txt' \
     --form 'file=@./test2.pdf'
```

```bash
curl --request POST \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents?type=web' \
     --header 'Content-Type: multipart/form-data' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --form 'name=example-page' \
     --form 'url=https://example.com'
```

```bash
curl --request POST \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents?type=empty' \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{"name":"blank.txt"}'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  文档将上传到的知识库的 ID。
- `type`: (*查询参数*)
  控制文档的创建方式：
  - `local`：上传文件。
  - `web`：将 URL 抓取到文档中。
  - `empty`：创建一个空文档，不上传文件。
- `'file'`：（*请求体参数*）
  要上传的文档。当`type=local`时需要。
- `'name'`：（*请求体参数*）
  文档名称。当 `type=web` 或 `type=empty` 时需要。
- `'url'`：（*请求体参数*）
  要抓取的源 URL。当`type=web`时需要。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "chunk_method": "naive",
            "created_by": "69736c5e723611efb51b0242ac120007",
            "dataset_id": "527fa74891e811ef9c650242ac120006",
            "id": "b330ec2e91ec11efbc510242ac120004",
            "location": "1.txt",
            "name": "1.txt",
            "parser_config": {
                "chunk_token_num": 128,
                "delimiter": "\\n",
                "html4excel": false,
                "layout_recognize": true,
                "raptor": {
                    "use_raptor": false
                }
            },
            "run": "UNSTART",
            "size": 17966,
            "thumbnail": "",
            "type": "doc"
        }
    ]
}
```

失败：

```json
{
    "code": 101,
    "message": "No file part!"
}
```

---

### 更新文档

**PUT** `/api/v1/datasets/{dataset_id}/documents/{document_id}`

更新指定文档的配置。

#### 请求

- 方法：PUT
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`:`string`
  - `"meta_fields"`:`object`
  - `"chunk_method"`:`string`
  - `"parser_config"`:`object`

##### 请求示例

```bash
curl --request PUT \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --header 'Content-Type: application/json' \
     --data '
     {
          "name": "manual.txt",
          "chunk_method": "manual",
          "parser_config": {"chunk_token_num": 128}
     }'

```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联知识库的 ID。
- `document_id`: (*路径参数*)
  要更新的文档的 ID。
- `"name"`：（*请求体参数*），`string`
- `"meta_fields"`：（*请求体参数*），`dict[str, Any]`文档的元字段。
- `"chunk_method"`：（*请求体参数*），`string`
  应用于文档的解析方法：
  - `"naive"`：一般
  - `"manual`：手册
  - `"qa"`：问答
  - `"table"`：表
  - `"paper"`：纸
  - `"book"`：书籍
  - `"laws"`：法律
  - `"presentation"`：演示
  - `"picture"`：图片
  - `"one"`：一
  - `"email"`：电子邮件
- `"parser_config"`：（*请求体参数*），`object`
  知识库解析器的配置设置。此 JSON 对象中的属性随所选的 `"chunk_method"` 的不同而变化：
  - 如果 `"chunk_method"` 为 `"naive"`，则 `"parser_config"` 对象包含以下属性：
    - `"chunk_token_num"`：默认为`256`。
    - `"layout_recognize"`：默认为`true`。
    - `"html4excel"`：是否将Excel文档转换为HTML格式。默认为`false`。
    - `"delimiter"`：默认为`"\n"`。
    - `"task_page_size"`：默认为`12`。仅适用于 PDF。
    - `"raptor"`：RAPTOR 特定设置。默认为：`{"use_raptor": false}`。
  - 如果`"chunk_method"`是`"qa"`、`"manual"`、`"paper"`、`"book"`、`"laws"`，或`"presentation"`，`"parser_config"`对象包含以下属性：
    - `"raptor"`：RAPTOR 特定设置。默认为：`{"use_raptor": false}`。
  - 如果 `"chunk_method"` 为 `"table"`、`"picture"`、`"one"` 或 `"email"`，则 `"parser_config"` 是空 JSON 对象。
- `"enabled"`：（*请求体参数*），`integer`
  该文档是否应在知识库中**可用**。
  - `1` → （可用）
  - `0` → （不可用）

#### 响应

成功：

```json
{
  "code": 0,
  "data": {
    "id": "cd38dd72d4a611f0af9c71de94a988ef",
    "name": "large.md",
    "type": "doc",
    "suffix": "md",
    "size": 2306906,
    "location": "large.md",
    "source_type": "local",
    "status": "1",
    "run": "DONE",
    "dataset_id": "5f546a1ad4a611f0af9c71de94a988ef",

    "chunk_method": "naive",
    "chunk_count": 2,
    "token_count": 8126,

    "created_by": "eab7f446cb5a11f0ab334fbc3aa38f35",
    "create_date": "Tue, 09 Dec 2025 10:28:52 GMT",
    "create_time": 1765247332122,
    "update_date": "Wed, 17 Dec 2025 10:51:16 GMT",
    "update_time": 1765939876819,

    "process_begin_at": "Wed, 17 Dec 2025 10:33:55 GMT",
    "process_duration": 14.8615,
    "progress": 1.0,

    "progress_msg": [
      "10:33:58 Task has been received.",
      "10:33:59 Page(1~100000001): Start to parse.",
      "10:33:59 Page(1~100000001): Finish parsing.",
      "10:34:07 Page(1~100000001): Generate 2 chunks",
      "10:34:09 Page(1~100000001): Embedding chunks (2.13s)",
      "10:34:09 Page(1~100000001): Indexing done (0.31s).",
      "10:34:09 Page(1~100000001): Task done (11.68s)"
    ],

    "parser_config": {
      "chunk_token_num": 512,
      "delimiter": "\n",
      "auto_keywords": 0,
      "auto_questions": 0,
      "topn_tags": 3,

      "layout_recognize": "DeepDOC",
      "html4excel": false,
      "image_context_size": 0,
      "table_context_size": 0,

      "graphrag": {
        "use_graphrag": true,
        "method": "light",
        "entity_types": [
          "organization",
          "person",
          "geo",
          "event",
          "category"
        ]
      },

      "raptor": {
        "use_raptor": true,
        "max_cluster": 64,
        "max_token": 256,
        "threshold": 0.1,
        "random_seed": 0,
        "prompt": "Please summarize the following paragraphs. Be careful with the numbers, do not make things up. Paragraphs as following:\n      {cluster_content}\nThe above is the content you need to summarize."
      }
    },

    "meta_fields": {},
    "pipeline_id": "",
    "thumbnail": ""
  }
}

```

失败：

```json
{
    "code": 102,
    "message": "The dataset does not have the document."
}
```

---

### 下载文件

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}`

从指定知识库中下载文档。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 输出：
  - `'{PATH_TO_THE_FILE}'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --output ./ragflow.txt
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `documents_id`: (*路径参数*)
  要下载的文档的 ID。

#### 响应

成功：

```json
This is a test to verify the file download feature.
```

失败：

```json
{
    "code": 102,
    "message": "You do not own the dataset 7898da028a0511efbf750242ac1220005."
}
```

---

### 列出文件

**GET** `/api/v1/datasets/{dataset_id}/documents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&id={document_id}&name={document_name}&create_time_from={timestamp}&create_time_to={timestamp}&suffix={file_suffix}&run={run_status}&metadata_condition={json}`

列出指定知识库中的文档。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/documents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&id={document_id}&name={document_name}&create_time_from={timestamp}&create_time_to={timestamp}&suffix={file_suffix}&run={run_status}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

**带分页的基本请求：**

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents?page=1&page_size=10 \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `keywords`：（*过滤器参数*），`string`
  用于匹配文档标题的关键字。
- `page`：（*过滤器参数*），`integer`
  指定将显示文档的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每页上的最大文档数。默认为`30`。
- `orderby`：（*过滤器参数*），`string`
  文档排序依据的字段。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*），`boolean`
  指示检索到的文档是否应按降序排序。默认为`true`。
- `id`：（*过滤器参数*），`string`
  要检索的文档的 ID。
- `create_time_from`：（*过滤参数*），`integer`
  用于过滤在此时间之后创建的文档的 Unix 时间戳。 0表示没有过滤器。默认为`0`。
- `create_time_to`：（*过滤器参数*），`integer`
  用于过滤在此时间之前创建的文档的 Unix 时间戳。 0表示没有过滤器。默认为`0`。
- `suffix`：（*过滤器参数*），`array[string]`
  按文件后缀过滤。支持多个值，例如 `pdf`、`txt` 和 `docx`。默认为所有后缀。
- `run`：（*过滤器参数*），`array[string]`
  按文档处理状态过滤。支持数字、文本和混合格式：
  - 数字格式：`["0", "1", "2", "3", "4"]`
  - 文本格式：`[UNSTART, RUNNING, CANCEL, DONE, FAIL]`
  - 混合格式：`[UNSTART, 1, DONE]`（混合数字和文本格式）
  - 状态映射：
    - `0` / `UNSTART`：文档尚未处理
    - `1` / `RUNNING`：文档当前正在处理
    - `2` / `CANCEL`：文档处理已取消
    - `3` / `DONE`：文档处理成功完成
    - `4` / `FAIL`：文档处理失败
  默认为所有状态。
- `metadata_condition`：（*过滤器参数*），`object`（查询中的JSON）
  当未提供 `document_ids` 时，可选元数据过滤器应用于文档。使用与检索相同的结构：
  - `logic`：`"and"`（默认）或`"or"`
  - `conditions`：`{ "name": string, "comparison_operator": string, "value": string }`的数组
    - `comparison_operator`支持：`is`、`not is`、`contains`、`not contains`、`in`、 `not in`、`start with`、`end with`、`>`、`<`、`≥`、 `≤`、`empty`、`not empty`

##### 使用示例

**具有多个过滤参数的请求**

```bash
curl --request GET \
     --url 'http://{address}/api/v1/datasets/{dataset_id}/documents?suffix=pdf&run=DONE&page=1&page_size=10' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

**按元数据过滤（查询 JSON）：**

```bash
curl -G \
  --url "http://localhost:9222/api/v1/datasets/{{KB_ID}}/documents" \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --data-urlencode 'metadata_condition={"logic":"and","conditions":[{"name":"tags","comparison_operator":"is","value":"bar"},{"name":"author","comparison_operator":"is","value":"alice"}]}'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "docs": [
            {
                "chunk_count": 0,
                "create_date": "Mon, 14 Oct 2024 09:11:01 GMT",
                "create_time": 1728897061948,
                "created_by": "69736c5e723611efb51b0242ac120007",
                "id": "3bcfbf8a8a0c11ef8aba0242ac120006",
                "knowledgebase_id": "7898da028a0511efbf750242ac120005",
                "location": "Test_2.txt",
                "name": "Test_2.txt",
                "parser_config": {
                    "chunk_token_count": 128,
                    "delimiter": "\n",
                    "layout_recognize": true,
                    "task_page_size": 12
                },
                "chunk_method": "naive",
                "process_begin_at": null,
                "process_duration": 0.0,
                "progress": 0.0,
                "progress_msg": "",
                "run": "UNSTART",
                "size": 7,
                "source_type": "local",
                "status": "1",
                "thumbnail": null,
                "token_count": 0,
                "type": "doc",
                "update_date": "Mon, 14 Oct 2024 09:11:01 GMT",
                "update_time": 1728897061948
            }
        ],
        "total_datasets": 1
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "You don't own the dataset 7898da028a0511efbf750242ac1220005. "
}
```

---

### 删除文档

**DELETE** `/api/v1/datasets/{dataset_id}/documents`

按 ID 删除文档。

#### 请求

- 方法：DELETE
- URL：`/api/v1/datasets/{dataset_id}/documents`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["id_1","id_2"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "delete_all": true
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `"ids"`：（*请求体参数*），`list[string]`
  要删除的文档的 ID。
  - 如果省略或设置为 `null` 或空数组，则不会删除任何文档。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的文档。
- `"delete_all"`：（*请求体参数*），`boolean`
  当省略`"ids"`，或设置为`null`或空数组时，是否删除指定知识库中的所有文档。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0
}.
```

失败：

```json
{
    "code": 102,
    "message": "You do not own the dataset 7898da028a0511efbf750242ac1220005."
}
```

---

### 解析文档

**POST** `/api/v1/datasets/{dataset_id}/chunks`

使用内置分块流水线解析指定知识库中的文档。

> **说明**
此端点仅支持使用内置分块流水线的知识库。对于配置了数据摄取流水线的知识库，请改用 `POST /api/v1/documents/ingest`。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/chunks`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"document_ids"`：`list[string]`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "document_ids": ["97a5f1c2759811efaa500242ac120004","97ad64b6759811ef9fc30242ac120004"]
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  知识库 ID。
- `"document_ids"`：（*请求体参数*），`list[string]`，*必填*
  要解析的文档的 ID。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "`document_ids` is required"
}
```

---

### 运行文档数据摄取

**POST** `/api/v1/documents/ingest`

开始、取消或重新运行文档的摄取。将此端点用于配置了数据摄取流水线的知识库中的文档。

#### 请求

- 方法：POST
- URL：`/api/v1/documents/ingest`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"doc_ids"`：`list[string]`
  - `"run"`：`string`
  - `"delete"`：`boolean`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/documents/ingest \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "doc_ids": ["97a5f1c2759811efaa500242ac120004"],
          "run": "1",
          "delete": true
     }'
```

##### 请求参数

- `"doc_ids"`：（*请求体参数*），`list[string]`，*必填*
  要摄取的文档的 ID。
- `"run"`：（*请求体参数*），`string`，*必填*
  摄取动作。使用 `"1"` 开始摄取，使用 `"2"` 取消摄取。
- `"delete"`：（*请求体参数*），`boolean`
  重新运行之前是否删除现有任务和分块。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 102,
    "message": "Document not found!"
}
```

---

### 停止解析文档

**DELETE** `/api/v1/datasets/{dataset_id}/chunks`

停止解析指定的文档。

#### 请求

- 方法：DELETE
- URL：`/api/v1/datasets/{dataset_id}/chunks`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"document_ids"`：`list[string]`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "document_ids": ["97a5f1c2759811efaa500242ac120004","97ad64b6759811ef9fc30242ac120004"]
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `"document_ids"`：（*请求体参数*），`list[string]`，*必填*
  应停止解析的文档的 ID。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "`document_ids` is required"
}
```

---

## 知识库中的分块管理

---

### 添加分块

**POST** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

将分块添加到指定知识库中的指定文档。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"content"`：`string`
  - `"important_keywords"`：`list[string]`
  - `"tag_kwd"`：`list[string]`
  - `"questions"`：`list[string]`
  - `"image_base64"`：`string`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "content": "<CHUNK_CONTENT_HERE>",
          "image_base64": "<BASE64_ENCODED_IMAGE>"
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `document_id`: (*路径参数*)
  关联的文档 ID。
- `"content"`：（*请求体参数*），`string`，*必填*
  分块的文本内容。
- `"important_keywords"`：（*请求体参数*），`list[string]`
  用分块标记的关键术语或短语。
- `"tag_kwd"`：（*请求体参数*），`list[string]`
  标记与分块关联的关键字。
- `"questions"`：（*请求体参数*），`list[string]`
  嵌入分块时使用的可选问题。
- `"image_base64"`：（*请求体参数*），`string`
  与分块关联的 Base64 编码图像。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chunk": {
            "content": "who are you",
            "create_time": "2024-12-30 16:59:55",
            "create_timestamp": 1735549195.969164,
            "dataset_id": "72f36e1ebdf411efb7250242ac120006",
            "document_id": "61d68474be0111ef98dd0242ac120006",
            "id": "12ccdc56e59837e5",
            "image_id": "",
            "important_keywords": [],
            "tag_kwd": [],
            "questions": []
        }
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "`content` is required"
}
```

---

### 列出分块

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks?keywords={keywords}&page={page}&page_size={page_size}&id={id}`

列出指定文档中的分块。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks?keywords={keywords}&page={page}&page_size={page_size}&id={chunk_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks?keywords={keywords}&page={page}&page_size={page_size}&id={chunk_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `document_id`: (*路径参数*)
  关联的文档 ID。
- `keywords`(*过滤器参数*)，`string`
  用于匹配分块内容的关键字。
- `page`(*过滤器参数*)，`integer`
  指定将显示分块的页面。默认为`1`。
- `page_size`(*过滤器参数*)，`integer`
  每页上的最大分块数。默认为`30`。
- `id`(*过滤器参数*)，`string`
  要检索的分块的 ID。您还可以使用 `GET /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` 来检索一个分块。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chunks": [
            {
                "available": true,
                "content": "This is a test content.",
                "docnm_kwd": "1.txt",
                "document_id": "b330ec2e91ec11efbc510242ac120004",
                "id": "b48c170e90f70af998485c1065490726",
                "image_id": "",
                "important_keywords": [],
                "tag_kwd": [],
                "positions": []
            }
        ],
        "doc": {
            "chunk_count": 1,
            "chunk_method": "naive",
            "create_date": "Thu, 24 Oct 2024 09:45:27 GMT",
            "create_time": 1729763127646,
            "created_by": "69736c5e723611efb51b0242ac120007",
            "dataset_id": "527fa74891e811ef9c650242ac120006",
            "id": "b330ec2e91ec11efbc510242ac120004",
            "location": "1.txt",
            "name": "1.txt",
            "parser_config": {
                "chunk_token_num": 128,
                "delimiter": "\\n",
                "html4excel": false,
                "layout_recognize": true,
                "raptor": {
                    "use_raptor": false
                }
            },
            "process_begin_at": "Thu, 24 Oct 2024 09:56:44 GMT",
            "process_duration": 0.54213,
            "progress": 0.0,
            "progress_msg": "Task dispatched...",
            "run": "2",
            "size": 17966,
            "source_type": "local",
            "status": "1",
            "thumbnail": "",
            "token_count": 8,
            "type": "doc",
            "update_date": "Thu, 24 Oct 2024 11:03:15 GMT",
            "update_time": 1729767795721
        },
        "total": 1
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "You don't own the document 5c5999ec7be811ef9cab0242ac12000e5."
}
```

---

### 获取分块

**GET** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`

检索指定文档中的指定分块。不返回运行时字段（例如向量和标记字段）。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `document_id`: (*路径参数*)
  关联的文档 ID。
- `chunk_id`: (*路径参数*)
  要检索的分块的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "available_int": 1,
        "content_with_weight": "This is a test content.",
        "doc_id": "b330ec2e91ec11efbc510242ac120004",
        "docnm_kwd": "1.txt",
        "id": "b48c170e90f70af998485c1065490726",
        "img_id": "",
        "important_kwd": [],
        "question_kwd": [],
        "tag_kwd": []
    }
}
```

失败：

```json
{
    "code": 100,
    "message": "Chunk not found"
}
```

---

### 删除分块

**DELETE** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

按 ID 删除分块。

#### 请求

- 方法：DELETE
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"chunk_ids"`：`list[string]`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "chunk_ids": ["test_1", "test_2"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "delete_all": true
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `document_id`: (*路径参数*)
  关联的文档 ID。
- `"chunk_ids"`：（*请求体参数*），`list[string]`
  要删除的分块的 ID。
  - 如果省略，或设置为 `null` 或空数组，则不会删除任何分块。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的分块。
- `"delete_all"`：（*请求体参数*），`boolean`
  当省略 `"chunk_ids"` 或设置为 `null` 或空数组时是否删除指定文档的所有分块。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "rm_chunk deleted chunks 0, expect 1"
}
```

---

### 更新分块

**PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`

更新指定分块的内容或配置。

> **注意**：已废弃
`PUT /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}` 已弃用。请改用此端点。

#### 请求

- 方法：PATCH
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"content"`：`string`
  - `"important_keywords"`：`list[string]`
  - `"questions"`：`list[string]`
  - `"positions"`：`list`
  - `"tag_kwd"`：`list[string]`
  - `"available"`：`boolean`
  - `"image_base64"`：`string`

##### 请求示例

```bash
curl --request PATCH \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks/{chunk_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "content": "ragflow123",
          "important_keywords": []
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `document_id`: (*路径参数*)
  关联的文档 ID。
- `chunk_id`: (*路径参数*)
  要更新的分块的 ID。
- `"content"`：（*请求体参数*），`string`
  分块的文本内容。
- `"important_keywords"`：（*请求体参数*），`list[string]`
  用分块标记的关键术语或短语的列表。
- `"questions"`：（*请求体参数*），`list[string]`
  嵌入分块时使用的可选问题。
- `"positions"`：（*请求体参数*），`list`
  更新了分块的源位置。
- `"tag_kwd"`：（*请求体参数*），`list[string]`
  更新了标签关键字。
- `"available"`：（*请求体参数*）`boolean`
  知识库中分块的可用性状态。值选项：
  - `true`：可用（默认）
  - `false`：不可用
- `"image_base64"`：（*请求体参数*），`string`
  与分块关联的 Base64 编码图像内容。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "Can't find this chunk 29a2d9987e16ba331fb4d7d30d99b71d2"
}
```

---

### 更新分块可用性

**PATCH** `/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`

更新或切换指定分块的可用性状态，控制它们是否可用于检索。

#### 请求

- 方法：PATCH
- URL：`/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"chunk_ids"`：`list[string]`（*必填*）
  - `"available_int"`：`integer`（*可选*）
  - `"available"`：`boolean`（*可选*）

##### 请求示例

```bash
curl --request PATCH \
     --url http://{address}/api/v1/datasets/{dataset_id}/documents/{document_id}/chunks \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "chunk_ids": ["chunk_id_1", "chunk_id_2"],
          "available_int": 1
     }'
```

##### 请求参数

- `dataset_id`: (*路径参数*)
  知识库的 ID。
- `document_id`: (*路径参数*)
  文档的 ID。
- `"chunk_ids"`：（*请求体参数*），`list[string]`（*必填*）
  需要更新可用性状态的Chunk的ID。
- `"available_int"`：（*请求体参数*），`integer`（*可选*）
  指定分块的可用性状态。您必须提供 `"available_int"` 或 `"available"`。如果两者都提供，则使用 `"available_int"`。
  - `1`：可用，
  - `0`：不可用。
- `"available"`：（*请求体参数*），`boolean`（*可选*）
  指定分块的可用性状态。当未提供 `"available_int"` 时使用。
  - `true`：可用，
  - `false`：不可用。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 102,
    "message": "You don't own the dataset {dataset_id}."
}
```

```json
{
    "code": 102,
    "message": "`chunk_ids` is required."
}
```

```json
{
    "code": 102,
    "message": "`available_int` or `available` is required."
}
```

```json
{
    "code": 102,
    "message": "Document not found!"
}
```

```json
{
    "code": 102,
    "message": "Index updating failure"
}
```

---

### 从知识库中检索元数据摘要

**GET** `/api/v1/datasets/{dataset_id}/metadata/summary`

聚合知识库中所有文档的元数据值。

#### 请求

- 方法：GET
- URL：`/api/v1/datasets/{dataset_id}/metadata/summary`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 响应

成功：

```json
{
  "code": 0,
  "data": {
    "summary": {
      "tags": {
        "type": "string",
        "values": [["bar", 2], ["foo", 1], ["baz", 1]]
      },
      "author": {
        "type": "string",
        "values": [["alice", 2], ["bob", 1]]
      }
    }
  }
}
```

---

### 更新或删除元数据

**POST** `/api/v1/datasets/{dataset_id}/metadata/update`

批量更新或删除指定知识库中的文档级元数据。如果 `document_ids` 和 `metadata_condition` 都被省略，则选择该知识库中的所有文档。当两者都提供时，使用交集。

#### 请求

- 方法：POST
- URL：`/api/v1/datasets/{dataset_id}/metadata/update`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `selector`：`object`
  - `updates`：`list[object]`
  - `deletes`：`list[object]`

#### 请求参数

- `dataset_id`: (*路径参数*)
  关联的知识库 ID。
- `"selector"`：（*请求体参数*），`object`，*可选*
  文档选择器：
  - `"document_ids"`：`list[string]`*可选*
    关联的文档 ID。
  - `"metadata_condition"`：`object`，*可选*
    - `"logic"`：如果提供多个条件，则定义条件之间的逻辑关系。选项：
      - `"and"`（默认）
      - `"or"`
    - `"conditions"`：`list[object]`*可选*
      每个对象：`{ "name": string, "comparison_operator": string, "value": string }`
      - `"name"`：`string` 用于搜索的键名称。
      - `"comparison_operator"`： `string` 可用选项：
        - `"is"`
        - `"not is"`
        - `"contains"`
        - `"not contains"`
        - `"in"`
        - `"not in"`
        - `"start with"`
        - `"end with"`
        - `">"`
        - `"<"`
        - `"≥"`
        - `"≤"`
        - `"empty"`
        - `"not empty"`
      - `"value"`：`string` 用于搜索的键值。
- `"updates"`：（*请求体参数*），`list[object]`，*可选*
  替换检索到的文档的元数据。每个对象：`{ "key": string, "match": string, "value": string }`。
  - `"key"`：`string`要更新的密钥的名称。
  - `"match"`：`string`*可选*要更新的密钥的当前值。如果省略，相应的键将更新为 `"value"`，无论其当前值如何。
  - `"value"`：`string`为指定键设置的新值。
- `"deletes"`：（*请求体参数*），`list[object]`，*可选*
  删除检索到的文档的元数据。每个对象：`{ "key": string, "value": string }`。
  - `"key"`: `string` 要删除的键的名称。
  - `"value"`：`string`*可选*要删除的键的值。
    - 如果提供，则仅删除具有匹配值的键。
    - 省略时，所有指定的键都将被删除。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/datasets/{dataset_id}/metadata/update \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
       "selector": {
         "metadata_condition": {
           "logic": "and",
           "conditions": [
             {"name": "author", "comparison_operator": "is", "value": "alice"}
           ]
         }
       },
       "updates": [
         {"key": "tags", "match": "foo", "value": "foo_new"}
       ],
       "deletes": [
         {"key": "obsolete_key"},
         {"key": "author", "value": "alice"}
       ]
     }'
```

##### 响应

成功：

```json
{
  "code": 0,
  "data": {
    "updated": 1,
    "matched_docs": 2
  }
}
```

---

### 检索分块

**POST** `/api/v1/retrieval`

从指定知识库中检索分块。

#### 请求

- 方法：POST
- URL：`/api/v1/retrieval`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"question"`：`string`
  - `"dataset_ids"`：`list[string]`
  - `"document_ids"`：`list[string]`
  - `"page"`：`integer`
  - `"page_size"`：`integer`
  - `"similarity_threshold"`：`float`
  - `"vector_similarity_weight"`：`float`
  - `"top_k"`：`integer`
  - `"rerank_id"`：`string`
  - `"keyword"`：`boolean`
  - `"highlight"`：`boolean`
  - `"cross_languages"`：`list[string]`
  - `"metadata_condition"`：`object`
  - `"use_kg"`：`boolean`
  - `"toc_enhance"`：`boolean`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/retrieval \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "question": "What is advantage of ragflow?",
          "dataset_ids": ["b2a62730759d11ef987d0242ac120004"],
          "document_ids": ["77df9ef4759a11ef8bdd0242ac120004"],
          "metadata_condition": {
            "logic": "and",
            "conditions": [
              {
                "name": "author",
                "comparison_operator": "=",
                "value": "Toby"
              },
              {
                "name": "url",
                "comparison_operator": "not contains",
                "value": "amd"
              }
            ]
          }
     }'
```

##### 请求参数

- `"question"`：（*请求体参数*），`string`，*必填*
  用户查询或查询关键字。
- `"dataset_ids"`：（*请求体参数*）`list[string]`
  要搜索的知识库的 ID。如果您未设置此参数，请确保设置 `"document_ids"`。
- `"document_ids"`：（*请求体参数*），`list[string]`
  要搜索的文档的 ID。确保所有选定的文档使用相同的嵌入模型。否则会出现错误。如果您未设置此参数，请确保设置 `"dataset_ids"`。
- `"page"`：（*请求体参数*），`integer`
  指定将显示分块的页面。默认为`1`。
- `"page_size"`：（*请求体参数*）
  每页上的最大分块数。默认为`30`。
- `"similarity_threshold"`：（*请求体参数*）
  最小相似度得分。默认为`0.2`。
- `"vector_similarity_weight"`：（*请求体参数*），`float`
  向量余弦相似度的权重。默认为 `0.3`。如果x表示向量余弦相似度的权重，那么(1-x)就是术语相似度权重。
- `"top_k"`：（*请求体参数*），`integer`
  参与向量余弦计算的分块的数量。默认为`1024`。
- `"use_kg"`：（*请求体参数*），`boolean`
  是否搜索与生成的知识图谱相关的分块以进行多跳查询。默认为 `False`。在启用此功能之前，请确保您已成功构建指定知识库的知识图谱。有关详细信息，请参阅[构建知识图谱](https://ragflow.io/docs/dev/construct_knowledge_graph)。
- `"toc_enhance"`：（*请求体参数*），`boolean`
  是否使用提取的内容表搜索分块。默认为`False`。在启用此功能之前，请确保您已启用`TOC_Enhance`并成功提取指定知识库的目录。有关详细信息，请参阅[此处](https://ragflow.io/docs/dev/enable_table_of_contents)。
- `"rerank_id"`：（*请求体参数*），`string`
  重新排序模型的 ID。
- `"keyword"`：（*请求体参数*），`boolean`
  是否启用基于关键字的匹配：
  - `true`：启用基于关键字的匹配。
  - `false`：禁用基于关键字的匹配（默认）。
- `"highlight"`：（*请求体参数*），`boolean`
  指定是否在结果中启用匹配术语的突出显示：
  - `true`：启用匹配术语的突出显示。
  - `false`：禁用匹配术语的突出显示（默认）。
- `"cross_languages"`：（*请求体参数*）`list[string]`
  需要翻译的语言，以实现不同语言的关键词检索。
- `"metadata_condition"`：（*请求体参数*），`object`
  用于过滤分块的元数据条件：
  - `"logic"`：（*请求体参数*），`string`
    - `"and"`：仅返回满足*每*条件的结果（默认）。
    - `"or"`：返回满足*任何*条件的结果。
  - `"conditions"`：（*请求体参数*），`array`
    元数据过滤条件列表。
    - `"name"`：`string` - 用于过滤的元数据字段名称，例如`"author"`、`"company"`、`"url"`。使用前请确认该参数。有关详细信息，请参阅[设置元数据](https://ragflow.io/docs/dev/set_metadata)。
    - `comparison_operator`：`string` - 比较运算符。可以是以下之一：
      - `"contains"`
      - `"not contains"`
      - `"start with"`
      - `"empty"`
      - `"not empty"`
      - `"="`
      - `"≠"`
      - `">"`
      - `"<"`
      - `"≥"`
      - `"≤"`
    - `"value"`：`string` - 要比较的值。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chunks": [
            {
                "content": "ragflow content",
                "content_ltks": "ragflow content",
                "document_id": "5c5999ec7be811ef9cab0242ac120005",
                "document_keyword": "1.txt",
                "highlight": "<em>ragflow</em> content",
                "id": "d78435d142bd5cf6704da62c778795c5",
                "image_id": "",
                "important_keywords": [
                    ""
                ],
                "tag_kwd": [],
                "kb_id": "c7ee74067a2c11efb21c0242ac120006",
                "positions": [
                    ""
                ],
                "similarity": 0.9669436601210759,
                "term_similarity": 1.0,
                "vector_similarity": 0.8898122004035864
            }
        ],
        "doc_aggs": [
            {
                "count": 1,
                "doc_id": "5c5999ec7be811ef9cab0242ac120005",
                "doc_name": "1.txt"
            }
        ],
        "total": 1
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "`datasets` is required."
}
```

---

## 聊天助手管理

---

### 创建聊天助手

**POST** `/api/v1/chats`

创建聊天助手。

#### 请求

- 方法：POST
- URL：`/api/v1/chats`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"icon"`：`string`
  - `"dataset_ids"`：`list[string]`
  - `"llm_id"`：`string`
  - `"llm_setting"`：`object`
  - `"prompt_config"`：`object`

##### 请求示例

```shell
curl --request POST \
     --url http://{address}/api/v1/chats \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
    "dataset_ids": ["0b2cbc8c877f11ef89070242ac120005"],
    "name":"new_chat_1"
}'
```

##### 请求参数

- `"name"`：（*请求体参数*），`string`，*必填*
  聊天助手的名称。
- `"icon"`：（*请求体参数*），`string`
  头像的 Base64 编码。
- `"dataset_ids"`：（*请求体参数*），`list[string]`
  关联知识库的唯一标识符。如果省略或设置为 `[]`，则会创建一个空的聊天助手；知识库可以稍后附加。
- `"llm_id"`：（*请求体参数*），`string`
  聊天模型的标识符。如果不指定，系统默认使用用户预先配置的聊天模式。
- `"llm_setting"`：（*请求体参数*），`object`
  定义助手的 LLM 参数的配置对象。 `llm_setting`对象可能包含以下属性：
  - `"model_type"`：`string`
    模型类型说明符。仅识别 `"chat"` 和 `"image2text"`；任何其他输入或省略时均被视为`"chat"`。
  - `"temperature"`：`float`
    控制模型预测的随机性。较低的温度会产生更保守的反应，而较高的温度会产生更具创造性和多样化的反应。默认为`0.1`。
  - `"top_p"`：`float`
    也称为“核心采样”，此参数设置阈值以选择较小的单词集进行采样。它专注于最可能的单词，剔除不太可能的单词。默认为`0.3`
  - `"presence_penalty"`：`float`
    这会通过惩罚对话中已经出现的单词来阻止模型重复相同的信息。默认为`0.4`。
  - `"frequency penalty"`：`float`
    与存在惩罚类似，这减少了模型频繁重复相同单词的倾向。默认为`0.7`。
- `"prompt_config"`：（*请求体参数*），`object`
  法学硕士需遵循的说明。 `prompt_config`对象可能包含以下属性：
  - `"system"`：`string`提示内容。
  - `"prologue"`: `string` 用户的开头问候语。
  - `"parameters"`: `object[]` 此参数列出了系统提示符中使用的变量。请注意：
    - `"knowledge"`是一个保留变量，代表检索到的分块。
    - `"system"` 中的所有变量都应该用大括号括起来。
  - `"empty_response"`：`string` 如果在知识库中未检索到用户问题的任何内容，则这将用作响应。为了让法学硕士在没有发现任何情况时可以即兴发挥，请将此项留空。
  - `"quote"`：`boolean`是否应显示文本源。默认为`true`。
  - `"tts"`：`boolean`
  - `"refine_multiturn"`：`boolean`
  - `"use_kg"`：`boolean`
  - `"reasoning"`：`boolean`
  - `"cross_languages"`：`list[string]`
  - `"tavily_api_key"`：`string`
  - `"toc_enhance"`：`boolean`
- `"similarity_threshold"`：（*请求体参数*），`float`
- `"vector_similarity_weight"`：（*请求体参数*），`float`
- `"top_n"`：（*请求体参数*），`int`
- `"top_k"`：（*请求体参数*），`int`
- `"rerank_id"`：（*请求体参数*），`string`

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "icon": "",
        "create_date": "Thu, 24 Oct 2024 11:18:29 GMT",
        "create_time": 1729768709023,
        "dataset_ids": [
            "527fa74891e811ef9c650242ac120006"
        ],
        "kb_names": [
            "dataset_1"
        ],
        "description": "A helpful Assistant",
        "id": "b1f2f15691f911ef81180242ac120003",
        "language": "English",
        "llm_id": "qwen-plus@Tongyi-Qianwen",
        "llm_setting": {
            "frequency_penalty": 0.7,
            "presence_penalty": 0.4,
            "temperature": 0.1,
            "top_p": 0.3
        },
        "name": "12234",
        "prompt_config": {
            "empty_response": "Sorry! No relevant content was found in the knowledge base!",
            "prologue": "Hi! I'm your assistant. What can I do for you?",
            "quote": true,
            "system": "You are an intelligent assistant...",
            "parameters": [
                {
                    "key": "knowledge",
                    "optional": false
                }
            ]
        },
        "rerank_id": "",
        "similarity_threshold": 0.2,
        "vector_similarity_weight": 0.3,
        "top_n": 6,
        "prompt_type": "simple",
        "status": "1",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "top_k": 1024,
        "update_date": "Thu, 24 Oct 2024 11:18:29 GMT",
        "update_time": 1729768709023
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Duplicated chat name."
}
```

---

### 更新聊天助手

**PUT** `/api/v1/chats/{chat_id}`

覆盖指定聊天助手的现有配置。

仅在提供完整配置时才使用此端点。请求中省略的任何字段都将重置为其服务器端默认值。对于部分更新，请使用 `PATCH /api/v1/chats/{chat_id}` 代替。

#### 请求

- 方法：PUT
- URL：`/api/v1/chats/{chat_id}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"icon"`：`string`
  - `"dataset_ids"`：`list[string]`
  - `"llm_id"`：`string`
  - `"llm_setting"`：`object`
  - `"prompt_config"`：`object`

##### 请求示例

```bash
curl --request PUT \
     --url http://{address}/api/v1/chats/{chat_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name":"Test",
          "icon":"",
          "dataset_ids":["0b2cbc8c877f11ef89070242ac120005"],
          "llm_id":"qwen-plus@Tongyi-Qianwen",
          "llm_setting":{"temperature":0.1,"top_p":0.3,"presence_penalty":0.4,"frequency_penalty":0.7},
          "prompt_config":{
               "system":"You are an intelligent assistant...",
               "prologue":"Hi! I'\''m your assistant. What can I do for you?",
               "parameters":[{"key":"knowledge","optional":false}],
               "empty_response":"Sorry! No relevant content was found in the knowledge base!",
               "quote":true
          },
          "similarity_threshold":0.2,
          "vector_similarity_weight":0.3,
          "top_n":6,
          "top_k":1024,
          "rerank_id":""
     }'
```

#### 参数

- `chat_id`: (*路径参数*)
  要更新的聊天助手的 ID。
- `"name"`：（*请求体参数*），`string`，*必填*
  修改后的聊天助手名称。
- `"icon"`：（*请求体参数*），`string`
  头像的 Base64 编码。
- `"dataset_ids"`：（*请求体参数*），`list[string]`
  关联知识库的 ID。
- `"llm_id"`：（*请求体参数*），`string`
  聊天模型名称。如果未设置，则使用用户的默认聊天模型。
- `"llm_setting"`：（*请求体参数*），`object`
  聊天助手的 LLM 设置。 `llm_setting`对象包含以下属性：
  - `"model_type"`：`string`
    模型类型说明符。支持的值为 `"chat"` 和 `"image2text"`。如果省略该字段或提供了无法识别的值，则默认为 `"chat"`。
  - `"temperature"`：`float`
    控制模型预测的随机性。较低的温度会产生更保守的反应，而较高的温度会产生更具创造性和多样化的反应。默认为`0.1`。
  - `"top_p"`：`float`
    也称为“核心采样”，此参数设置阈值以选择较小的单词集进行采样。它专注于最可能的单词，剔除不太可能的单词。默认为`0.3`
  - `"presence_penalty"`：`float`
    这会通过惩罚对话中已经出现的单词来阻止模型重复相同的信息。默认为`0.4`。
  - `"frequency penalty"`：`float`
    与存在惩罚类似，这减少了模型频繁重复相同单词的倾向。默认为`0.7`。
- `"prompt_config"`：（*请求体参数*），`object`
- `"similarity_threshold"`：（*请求体参数*），`float`
- `"vector_similarity_weight"`：（*请求体参数*），`float`
- `"top_n"`：（*请求体参数*），`int`
- `"top_k"`：（*请求体参数*），`int`
- `"rerank_id"`：（*请求体参数*），`string`

对于 `PUT` 请求，请求正文中省略的任何字段都将重置为其服务器端默认值。

#### 响应

成功：返回完整更新的聊天助手对象。

```json
{
    "code": 0,
    "data": {
        "id": "04d0d8e28d1911efa3630242ac120006",
        "name": "Test",
        "description": "A helpful Assistant",
        "icon": "",
        "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
        "kb_names": ["dataset_1"],
        "llm_id": "qwen-plus@Tongyi-Qianwen",
        "llm_setting": {
            "frequency_penalty": 0.7,
            "presence_penalty": 0.4,
            "temperature": 0.1,
            "top_p": 0.3
        },
        "prompt_config": {
            "empty_response": "Sorry! No relevant content was found in the knowledge base!",
            "prologue": "Hi! I'm your assistant. What can I do for you?",
            "quote": true,
            "system": "You are an intelligent assistant...",
            "parameters": [{"key": "knowledge", "optional": false}]
        },
        "similarity_threshold": 0.2,
        "vector_similarity_weight": 0.3,
        "top_n": 6,
        "top_k": 1024,
        "rerank_id": "",
        "status": "1",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "create_time": 1729232406637,
        "update_time": 1729232406638
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Duplicated chat name."
}
```

---

### 获取聊天助手

**GET** `/api/v1/chats/{chat_id}`

检索指定的聊天助手。

#### 请求

- 方法：GET
- URL：`/api/v1/chats/{chat_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/chats/{chat_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  要检索的聊天助手的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "icon": "",
        "create_date": "Fri, 18 Oct 2024 06:20:06 GMT",
        "create_time": 1729232406637,
        "description": "A helpful Assistant",
        "id": "04d0d8e28d1911efa3630242ac120006",
        "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
        "kb_names": ["dataset_1"],
        "language": "English",
        "llm_id": "qwen-plus@Tongyi-Qianwen",
        "llm_setting": {
            "temperature": 0.1,
            "top_p": 0.3
        },
        "name": "my_chat",
        "prompt_config": {
            "empty_response": "Sorry! No relevant content was found in the knowledge base!",
            "prologue": "Hi! I'm your assistant. What can I do for you?",
            "quote": true,
            "system": "You are an intelligent assistant...",
            "parameters": [{"key": "knowledge", "optional": false}]
        },
        "rerank_id": "",
        "similarity_threshold": 0.2,
        "vector_similarity_weight": 0.3,
        "top_n": 6,
        "status": "1",
        "tenant_id": "69736c5e723611efb51b0242ac120007",
        "update_date": "Fri, 18 Oct 2024 06:20:06 GMT",
        "update_time": 1729232406638
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "No authorization."
}
```

---

### 部分更新聊天助手

**PATCH** `/api/v1/chats/{chat_id}`

对指定聊天助手执行部分更新。

未指定的字段将被保留，而嵌套对象（例如 `llm_setting` 和 `prompt_config`）将与现有配置深度合并。这是用于重命名助手或修改特定设置子集的推荐端点。

#### 请求

- 方法：PATCH
- URL：`/api/v1/chats/{chat_id}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 正文：`PUT /api/v1/chats/{chat_id}` 接受的字段的任何子集

##### 请求示例

```bash
curl --request PATCH \
     --url http://{address}/api/v1/chats/{chat_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
    "llm_id": "gpt-4o",
    "llm_setting": {"temperature": 0.5}
}'
```

#### 响应

成功：返回完整更新的聊天助手对象（与`PUT /api/v1/chats/{chat_id}`结构相同）。

```json
{
    "code": 0,
    "data": {
        "id": "04d0d8e28d1911efa3630242ac120006",
        "name": "Renamed assistant",
        "llm_id": "qwen-plus@Tongyi-Qianwen",
        "..."  : "..."
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "No authorization."
}
```

---

### 删除聊天助手

**DELETE** `/api/v1/chats/{chat_id}`

通过ID删除聊天助手。

#### 请求

- 方法：DELETE
- URL：`/api/v1/chats/{chat_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats/{chat_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  要删除的聊天助手的ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 102,
    "message": "No authorization."
}
```

---

### 删除聊天助手

**DELETE** `/api/v1/chats`

通过ID删除聊天助手。

> **注意**：已废弃
请求正文中的 `chat_id` 已弃用，请使用 `ids` 列表。

#### 请求

- 方法：DELETE
- URL：`/api/v1/chats`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "delete_all": true
     }'
```

##### 请求参数

- `"ids"`：（*请求体参数*），`list[string]`
  要删除的聊天助手的 ID。
  - 如果省略或设置为 `null` 或空数组，则不会删除任何聊天助手。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的聊天助手。
- `"delete_all"`：（*请求体参数*），`boolean`
  当省略`"ids"`，或设置为`null`或空数组时，是否删除当前用户拥有的所有聊天助手。默认为 `false`。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "ids are required"
}
```

---

### 列出聊天助手

**GET** `/api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&owner_ids={owner_id}&name={chat_name}&id={chat_id}`

列出聊天助手。

#### 请求

- 方法：GET
- URL：`/api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&owner_ids={owner_id}&name={chat_name}&id={chat_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/chats?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&owner_ids={owner_id}&name={chat_name}&id={chat_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `page`：（*过滤器参数*），`integer`
  指定将显示聊天助手的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每个页面上聊天助手的数量。默认为`30`。
- `orderby`：（*过滤器参数*），`string`
  结果排序所依据的属性。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*），`boolean`
  指示检索到的聊天助手是否应按降序排序。默认为`true`。
- `keywords`：（*过滤器参数*），`string`
  与聊天助手名称的不区分大小写的模糊匹配。
- `owner_ids`：（*过滤器参数*），`string`（可重复）
  按所有者租户 ID 过滤。可以指定多次：`?owner_ids=id1&owner_ids=id2`。
- `id`：（*过滤器参数*），`string`
  要精确匹配地检索的聊天助手的 ID。
- `name`：（*过滤器参数*），`string`
  要检索的完全匹配的聊天助手的名称。

当提供 `id` 或 `name` 时，精确过滤优先于 `keywords`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chats": [
            {
                "icon": "",
                "create_date": "Fri, 18 Oct 2024 06:20:06 GMT",
                "create_time": 1729232406637,
                "description": "A helpful Assistant",
                "id": "04d0d8e28d1911efa3630242ac120006",
                "dataset_ids": ["527fa74891e811ef9c650242ac120006"],
                "kb_names": ["dataset_1"],
                "language": "English",
                "llm_id": "qwen-plus@Tongyi-Qianwen",
                "llm_setting": {
                    "frequency_penalty": 0.7,
                    "presence_penalty": 0.4,
                    "temperature": 0.1,
                    "top_p": 0.3
                },
                "name": "13243",
                "prompt_config": {
                    "empty_response": "Sorry! No relevant content was found in the knowledge base!",
                    "prologue": "Hi! I'm your assistant. What can I do for you?",
                    "quote": true,
                    "system": "You are an intelligent assistant...",
                    "parameters": [
                        {
                            "key": "knowledge",
                            "optional": false
                        }
                    ]
                },
                "rerank_id": "",
                "similarity_threshold": 0.2,
                "vector_similarity_weight": 0.3,
                "top_n": 6,
                "prompt_type": "simple",
                "status": "1",
                "tenant_id": "69736c5e723611efb51b0242ac120007",
                "update_date": "Fri, 18 Oct 2024 06:20:06 GMT",
                "update_time": 1729232406638
            }
        ],
        "total": 1
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "The chat doesn't exist"
}
```

---

## 会话管理

---

### 与聊天助手创建会话

**POST** `/api/v1/chats/{chat_id}/sessions`

与聊天助手创建会话。

#### 请求

- 方法：POST
- URL：`/api/v1/chats/{chat_id}/sessions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"user_id"`：`string`（可选）

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chats/{chat_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name": "new session"
     }'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `"name"`：（*请求体参数*），`string`
  要创建的聊天会话的名称。
- `"user_id"`：（*请求体参数*），`string`
  可选的用户定义 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "create_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "create_time": 1728636374571,
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "messages": [
            {
                "content": "Hi! I am your assistant, can I help you?",
                "role": "assistant"
            }
        ],
        "name": "new session",
        "update_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "update_time": 1728636374571
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "`name` can not be empty."
}
```

---

### 更新聊天助手的会话

**PATCH** `/api/v1/chats/{chat_id}/sessions/{session_id}`

更新指定聊天助手的会话。

> **注意**：已废弃
`PUT /api/v1/chats/{chat_id}/sessions/{session_id}` 已弃用。请改用此端点。

#### 请求

- 方法：PATCH
- URL：`/api/v1/chats/{chat_id}/sessions/{session_id}`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`

##### 请求示例

```bash
curl --request PATCH \
     --url http://{address}/api/v1/chats/{chat_id}/sessions/{session_id} \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "name": "<REVISED_SESSION_NAME_HERE>"
     }'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `session_id`: (*路径参数*)
  要更新的会话的 ID。
- `"name"`：（*请求体参数*），`string`
  会议的修订名称。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "create_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "create_time": 1728636374571,
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "messages": [
            {
                "content": "Hi! I am your assistant, can I help you?",
                "role": "assistant"
            }
        ],
        "name": "updated session name",
        "update_date": "Fri, 11 Oct 2024 08:46:14 GMT",
        "update_time": 1728636374571,
        "user_id": ""
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "`name` can not be empty."
}
```

---

### 列出聊天助手的会话

**GET** `/api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id}&user_id={user_id}`

列出与指定聊天助手关联的会话。

#### 请求

- 方法：GET
- URL：`/api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id}&user_id={user_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/chats/{chat_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={session_name}&id={session_id}&user_id={user_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `page`：（*过滤器参数*），`integer`
  指定将显示会话的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每页上的会话数。默认为`30`。如果设置为 `0`，则返回空列表。
- `orderby`：（*过滤器参数*），`string`
  会话排序所依据的字段。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*），`boolean`
  指示是否应按降序对检索到的会话进行排序。默认为`true`。
- `name`：（*过滤器参数*）`string`
  要检索的聊天会话的名称。
- `id`：（*过滤器参数*），`string`
  要检索的聊天会话的 ID。
- `user_id`：（*过滤器参数*），`string`
  创建会话时传入的可选用户定义 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "chat_id": "2ca4b22e878011ef88fe0242ac120005",
            "create_date": "Fri, 11 Oct 2024 08:46:43 GMT",
            "create_time": 1728636403974,
            "id": "578d541e87ad11ef96b90242ac120006",
            "messages": [
                {
                    "content": "Hi! I am your assistant, can I help you?",
                    "role": "assistant"
                }
            ],
            "name": "new session",
            "reference": [],
            "update_date": "Fri, 11 Oct 2024 08:46:43 GMT",
            "update_time": 1728636403974,
            "user_id": ""
        }
    ]
}
```

失败：

```json
{
    "code": 102,
    "message": "The session doesn't exist"
}
```

---

### 获取聊天助手的会话

**GET** `/api/v1/chats/{chat_id}/sessions/{session_id}`

获取指定聊天助手的特定会话，包括其消息、参考信息和头像。

#### 请求

- 方法：GET
- URL：`/api/v1/chats/{chat_id}/sessions/{session_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/chats/{chat_id}/sessions/{session_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `session_id`: (*路径参数*)
  要检索的会话的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "name": "new session",
        "avatar": "data:image/png;base64,...",
        "messages": [
            {
                "content": "Hi! I am your assistant, can I help you?",
                "role": "assistant"
            }
        ],
        "reference": []
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Session not found!"
}
```

---

### 从聊天助手会话中删除消息

**DELETE** `/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}`

从指定的聊天助手会话中删除用户消息及其配对的助理回复。

#### 请求

- 方法：DELETE
- URL：`/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `session_id`: (*路径参数*)
  拥有该消息的会话的 ID。
- `msg_id`: (*路径参数*)
  要删除的消息的 ID。

#### 响应

成功：返回更新后的会话对象。

```json
{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "messages": [],
        "reference": []
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Session not found!"
}
```

---

### 更新聊天助手会话中的消息反馈

**PUT** `/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback`

更新指定聊天助手会话中助理消息的反馈。

#### 请求

- 方法：PUT
- URL：`/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"thumbup"`：`boolean`
  - `"feedback"`：`string`（可选）

##### 请求示例

```bash
curl --request PUT \
     --url http://{address}/api/v1/chats/{chat_id}/sessions/{session_id}/messages/{msg_id}/feedback \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "thumbup": false,
          "feedback": "The answer missed the cited document."
     }'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `session_id`: (*路径参数*)
  拥有该消息的会话的 ID。
- `msg_id`: (*路径参数*)
  要更新的助理消息的 ID。
- `"thumbup"`：（*请求体参数*），`boolean`
  助理消息是否标记为正反馈。
- `"feedback"`：（*请求体参数*），`string`
  可选反馈文本，通常在 `"thumbup"` 为 `false` 时使用。

#### 响应

成功：返回更新后的会话对象。

```json
{
    "code": 0,
    "data": {
        "chat_id": "2ca4b22e878011ef88fe0242ac120005",
        "id": "4606b4ec87ad11efbc4f0242ac120006",
        "messages": [
            {
                "id": "message-id",
                "role": "assistant",
                "content": "Here is the answer.",
                "thumbup": false,
                "feedback": "The answer missed the cited document."
            }
        ]
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Session not found!"
}
```

---

### 删除聊天助手的会话

**DELETE** `/api/v1/chats/{chat_id}/sessions`

通过ID删除聊天助手的会话。

#### 请求

- 方法：DELETE
- URL：`/api/v1/chats/{chat_id}/sessions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats/{chat_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/chats/{chat_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "delete_all": true
     }'
```

##### 请求参数

- `chat_id`: (*路径参数*)
  关联的聊天助手的ID。
- `"ids"`：（*请求体参数*），`list[string]`
  要删除的会话的 ID。
  - 如果省略或设置为 `null` 或空数组，则不会删除任何会话。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的会话。
- `"delete_all"`：（*请求体参数*），`boolean`
  当`"ids"`被省略，或设置为`null`或空数组时，是否删除指定聊天助手的所有会话。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "The chat doesn't own the session"
}
```

---

### 与聊天助手交谈

**POST** `/api/v1/chat/completions`

启动聊天完成请求。同一端点支持三种模式：

> **注意**：已废弃
`POST /api/v1/chats/{chat_id}/completions` 已弃用。请改用此端点。

- 否`chat_id`：直接与租户的默认聊天模式交谈。
- 使用 `chat_id` 但没有 `session_id`：使用该聊天的配置并自动创建新会话。
- 同时使用 `chat_id` 和 `session_id`：继续现有的聊天会话。

> **提示**：NOTE

- 在流模式下，并非所有响应都包含参考，因为这取决于系统的判断。
- 在流模式下，最后一条消息是一条空消息：

  ```json
  data:
  {
    "code": 0,
    "data": true
  }
  ```

#### 请求

- 方法：POST
- URL：`/api/v1/chat/completions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：

  - `"messages"`：`list[object]`
  - `"question"`：`string`
  - `"stream"`：`boolean`
  - `"chat_id"`：`string`（可选）
  - `"session_id"`：`string`（可选）
  - `"llm_id"`：`string`（可选）
  - `"pass_all_history_messages"`：`boolean`（可选）
  - `"legacy"`：`boolean`（可选）

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
          "messages": [
              {
                  "role": "user",
                  "content": "Who are you?"
              }
          ]
     }'
```

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
          "chat_id": "{chat_id}",
          "stream": true,
          "session_id":"9fa7691cb85c11ef9c5f0242ac120005",
          "messages": [
              {
                  "role": "user",
                  "content": "Who are you?"
              }
          ]
     }'
```

##### 请求参数

- `"messages"`：（*请求体参数*），`list[object]`
  最新的用户消息，或当`pass_all_history_messages`为`true`时发送到模型的对话消息。需要 `messages` 或 `question`。
- `"question"`：（*请求体参数*），`string`
  最新的用户问题。这相当于通过 `messages: [{"role": "user", "content": question}]`。
- `"stream"`：（*请求体参数*），`boolean`
  启用流输出：
  - `true`：启用流式传输（默认）。
  - `false`：禁用流式传输。
- `"chat_id"`：（*请求体参数*）
  可选的聊天助手 ID。如果省略，则直接使用租户的默认聊天模型。
- `"session_id"`：（*请求体参数*）
  可选会话 ID。如果提供了 `chat_id` 但省略了 `session_id`，则会自动生成一个新会话。
- `"llm_id"`：（*请求体参数*），`string`
  当特定聊天模型应用于此请求时可选模型覆盖。
- `"pass_all_history_messages"`：（*请求体参数*），`boolean`
  当提供 `chat_id` 和 `session_id` 时，默认为 `false`，因此服务器使用存储的会话历史记录和仅来自请求的最新用户消息。设置为 `true` 以替换/使用提交的完整 `messages` 历史记录，并覆盖存储的会话历史记录。
- `"legacy"`：（*请求体参数*），`boolean`
  默认为`false`。实现与 RAGFlow v0.23.0 的向后兼容性，以实现流式响应。当设置为 `true` 时：
  - 累积输出：每个流式数据块中的 `"answer"` 字段返回截至当前已生成的完整文本，而不只是新增 token（增量）。
  - 无推理标记：`start_to_think` 和 `end_to_think` 信号从流中剥离。

#### 响应

成功，无需 `chat_id` 或 `session_id`：

```json
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "I am an assistant powered by the tenant's default chat model.",
        "reference": {},
        "audio_binary": null,
        "id": "b01eed84b85611efa0e90242ac120005",
        "session_id": ""
    }
}
data:{
    "code": 0,
    "message": "",
    "data": true
}
```

`chat_id` 和 `session_id` 成功：

带有 `chat_id` 和 `session_id` 的流式响应示例：

```json
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250170.37759,
        "final": false,
        "start_to_think": true,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "The user just said \"hello\". I should respond warmly and ask how I can help.",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250170.3778317,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": " Let's keep it short and friendly.",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250171.101234,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250171.5262048,
        "final": false,
        "end_to_think": true,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "Hello! 👋 Welcome!",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250171.5266216,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": true
}
```

对于`legacy: true`，相同的请求将`answer`中的思考内容保留为文字`<think>`标签，并在`</think>`之后附加最终答案：

```json
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "<think>The user just said \"hello\".",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250170.3778317,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "<think>The user just said \"hello\". I should respond warmly and ask how I can help.",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250170.901234,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": {
        "answer": "<think>The user just said \"hello\". I should respond warmly and ask how I can help. Let's keep it short and friendly.</think>Hello! 👋 Welcome!",
        "reference": {
            "chunks": []
        },
        "audio_binary": null,
        "prompt": "",
        "created_at": 1781250171.5262048,
        "final": false,
        "id": "76961783-1523-43f7-8148-19da08247922",
        "session_id": "4edfabd6663211f1943e217dfc5f0165",
        "chat_id": "d90fd732646f11f1803d2fb3c77f9b23"
    }
}
data:{
    "code": 0,
    "message": "",
    "data": true
}
```

失败：

```json
{
    "code": 102,
    "message": "Please input your question."
}
```

---

### 与智能体创建会话

> **危险操作**：已废弃
此方法已被弃用且不推荐。您仍然可以调用它，但请注意，调用 `Converse with agent` 将自动生成关联智能体的会话 ID。

**POST** `/api/v1/agents/{agent_id}/sessions`

创建与智能体的会话。

#### 请求

- 方法：POST
- URL：`/api/v1/agents/{agent_id}/sessions?user_id={user_id}`
- 请求头：
  - `'内容类型：application/json'
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - 所需参数：`str`
  - 其他参数：
    **Begin**组件中指定的变量。

##### 请求示例

如果智能体中的 **Begin** 组件未采用必需的参数：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/{agent_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
     }'
```

##### 请求参数

- `agent_id`: (*路径参数*)
  关联智能体的 ID。
- `user_id`：（*过滤器参数*）
  可选的用户定义 ID，用于在上传文件时创建会话时解析文档（尤其是图像）。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "agent_id": "dbb4ed366e8611f09690a55a6daec4ef",
        "dsl": {
            "components": {
                "Message:EightyJobsAsk": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Message",
                        "params": {
                            "content": [
                                "{begin@var1}{begin@var2}"
                            ],
                            "debug_inputs": {},
                            "delay_after_error": 2.0,
                            "description": "",
                            "exception_default_value": null,
                            "exception_goto": null,
                            "exception_method": null,
                            "inputs": {},
                            "max_retries": 0,
                            "message_history_window_size": 22,
                            "outputs": {
                                "content": {
                                    "type": "str",
                                    "value": null
                                }
                            },
                            "stream": true
                        }
                    },
                    "upstream": [
                        "begin"
                    ]
                },
                "begin": {
                    "downstream": [
                        "Message:EightyJobsAsk"
                    ],
                    "obj": {
                        "component_name": "Begin",
                        "params": {
                            "debug_inputs": {},
                            "delay_after_error": 2.0,
                            "description": "",
                            "enablePrologue": true,
                            "enable_tips": true,
                            "exception_default_value": null,
                            "exception_goto": null,
                            "exception_method": null,
                            "inputs": {
                                "var1": {
                                    "name": "var1",
                                    "optional": false,
                                    "options": [],
                                    "type": "line",
                                    "value": null
                                },
                                "var2": {
                                    "name": "var2",
                                    "optional": false,
                                    "options": [],
                                    "type": "line",
                                    "value": null
                                }
                            },
                            "max_retries": 0,
                            "message_history_window_size": 22,
                            "mode": "conversational",
                            "outputs": {},
                            "prologue": "Hi! I'm your assistant. What can I do for you?",
                            "tips": "Please fill in the form"
                        }
                    },
                    "upstream": []
                }
            },
            "globals": {
                "sys.conversation_turns": 0,
                "sys.files": [],
                "sys.query": "",
                "sys.user_id": ""
            },
            "graph": {
                "edges": [
                    {
                        "data": {
                            "isHovered": false
                        },
                        "id": "xy-edge__beginstart-Message:EightyJobsAskend",
                        "markerEnd": "logo",
                        "source": "begin",
                        "sourceHandle": "start",
                        "style": {
                            "stroke": "rgba(151, 154, 171, 1)",
                            "strokeWidth": 1
                        },
                        "target": "Message:EightyJobsAsk",
                        "targetHandle": "end",
                        "type": "buttonEdge",
                        "zIndex": 1001
                    }
                ],
                "nodes": [
                    {
                        "data": {
                            "form": {
                                "enablePrologue": true,
                                "inputs": {
                                    "var1": {
                                        "name": "var1",
                                        "optional": false,
                                        "options": [],
                                        "type": "line"
                                    },
                                    "var2": {
                                        "name": "var2",
                                        "optional": false,
                                        "options": [],
                                        "type": "line"
                                    }
                                },
                                "mode": "conversational",
                                "prologue": "Hi! I'm your assistant. What can I do for you?"
                            },
                            "label": "Begin",
                            "name": "begin"
                        },
                        "dragging": false,
                        "id": "begin",
                        "measured": {
                            "height": 112,
                            "width": 200
                        },
                        "position": {
                            "x": 270.64098070942583,
                            "y": -56.320928437811176
                        },
                        "selected": false,
                        "sourcePosition": "left",
                        "targetPosition": "right",
                        "type": "beginNode"
                    },
                    {
                        "data": {
                            "form": {
                                "content": [
                                    "{begin@var1}{begin@var2}"
                                ]
                            },
                            "label": "Message",
                            "name": "Message_0"
                        },
                        "dragging": false,
                        "id": "Message:EightyJobsAsk",
                        "measured": {
                            "height": 57,
                            "width": 200
                        },
                        "position": {
                            "x": 279.5,
                            "y": 190
                        },
                        "selected": true,
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "messageNode"
                    }
                ]
            },
            "history": [],
            "memory": [],
            "messages": [],
            "path": [],
            "retrieval": [],
            "task_id": "dbb4ed366e8611f09690a55a6daec4ef"
        },
        "id": "0b02fe80780e11f084adcfdc3ed1d902",
        "message": [
            {
                "content": "Hi! I'm your assistant. What can I do for you?",
                "role": "assistant"
            }
        ],
        "source": "agent",
        "user_id": "c3fb861af27a11efa69751e139332ced"
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Agent not found."
}
```

---

### 与智能体交谈

**POST** `/api/v1/agents/chat/completions`

向指定客服人员询问问题以启动人工智能对话。

对所有智能体对话使用单个完成端点。

> **注意**：已废弃
`POST /api/v1/agents/{agent_id}/completions` 已弃用。请改用此端点。

#### 请求

- 方法：POST
- URL：`/api/v1/agents/chat/completions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

#### 标准模式

将此模式用于本机智能体 API。

##### 请求体

- `"agent_id"`：`string`
- `"query"`：`string`
- `"stream"`：`boolean`
- `"session_id"`：`string`（可选）
- `"inputs"`：`object`（可选）
- `"files"`：`list[object]`（可选）
- `"user_id"`：`string`（可选）
- `"return_trace"`：`boolean`（可选，默认`false`）
- `"chat_template_kwargs": object`（可选）

#### 要处理的流事件

当`stream=true`时，服务器发送服务器发送事件（SSE）。客户端应该处理这些事件：

- `message`：来自**消息**组件的流内容。
- `message_end`：**消息**组件的结尾，其中可能包括`reference`或`attachment`。
- `node_finished`：组件完成。 `data.inputs`、`data.outputs`、`data.error`和`data.elapsed_time`描述节点结果。如果`return_trace=true`，同一事件还包含`data.trace`。

流以 `[DONE]` 结束。

> **重要信息**：IMPORTANT
您可以在请求体中包含自定义参数，但必须先在 [Begin 组件](https://ragflow.io/docs/dev/begin_component)中定义它们。

##### 请求示例

如果 **Begin** 组件不带参数：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "agent_id": "AGENT_ID",
        "query": "Hello",
        "stream": false
     }'
```

- 如果 **Begin** 组件采用参数，请将它们的值包含在 `"inputs"` 的主体中，如下所示：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "agent_id": "AGENT_ID",
        "query": "",
        "stream": false,
        "inputs": {
            "line_var": {
                "type": "line",
                "value": "I am line_var"
            },
            "int_var": {
                "type": "integer",
                "value": 1
            },
            "paragraph_var": {
                "type": "paragraph",
                "value": "a\nb\nc"
            },
            "option_var": {
                "type": "options",
                "value": "option 2"
            },
            "boolean_var": {
                "type": "boolean",
                "value": true
            }
        }
     }'
```

要继续现有会话：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "agent_id": "AGENT_ID",
        "query": "Hello again",
        "stream": true,
        "session_id": "cb2f385cb86211efa36e0242ac120005"
     }'
```

##### 请求参数

- `agent_id`：（*路径参数*），`string`
  关联智能体的 ID。
- `"question"`：（*请求体参数*），`string`，*必填*
  开始人工智能对话的问题。
- `"stream"`：（*请求体参数*），`boolean`
  是否以流式方式输出响应：
  - `true`：启用流式传输（默认）。
  - `false`：禁用流式传输。
- `"session_id"`：（*请求体参数*）
  会话的 ID。如果未提供，将生成一个新会话。
- `"inputs"`：（*请求体参数*）
  **Begin**组件中指定的变量。
- `"user_id"`：（*请求体参数*），`string`
  可选的用户定义 ID。当未提供 `session_id` 时，*仅*有效。
- `"chat_template_kwargs"`：（*请求体参数*），`object`
  底层 LLM 聊天模板的可选直通参数。通常用于在支持的模型上切换思维/推理模式（例如，`{"enable_thinking": false}`）。

> **提示**：NOTE
目前，此方法*不*支持文件类型输入/变量。作为解决方法，请使用以下方法将文件上传到智能体：
`http://{address}/v1/canvas/upload/{agent_id}`
*您将从其响应正文中获得相应的文件ID。*

##### 响应

标准模式流：

```json
data: {
    "event": "message",
    "message_id": "cecdcb0e83dc11f0858253708ecb6573",
    "created_at": 1756364483,
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
        "content": "Hello"
    },
    "session_id": "cd097ca083dc11f0858253708ecb6573"
}

data: {
    "event": "message_end",
    "message_id": "cecdcb0e83dc11f0858253708ecb6573",
    "created_at": 1756364483,
    "task_id": "d1f79142831f11f09cc51795b9eb07c0",
    "data": {
        "reference": {}
    },
    "session_id": "cd097ca083dc11f0858253708ecb6573"
}

data:[DONE]
```

当`extra_body.reference_metadata.include`是`true`时，每个引用分块可以包含`document_metadata`对象。

标准模式非流：

```json
{
    "code": 0,
    "data": {
        "data": {
            "content": "Hello",
            "reference": {},
            "trace": []
        },
        "message_id": "c4692a2683d911f0858253708ecb6573",
        "session_id": "c39f6f9c83d911f0858253708ecb6573",
        "task_id": "d1f79142831f11f09cc51795b9eb07c0"
    }
}
```

如果一个或多个组件产生结构化输出，请设置 `return_trace=true` 并检查 `trace` 中的该组件输出。

#### OpenAI兼容模式

使用相同的端点并添加 `"openai-compatible": true`。

##### 请求体

- `"agent_id"`：`string`
- `"messages"`：`list[object]`
- `"openai-compatible"`：`boolean`，必须是`true`
- `"stream"`：`boolean`
- `"session_id"`：`string`（可选）
- `"model"`：`string`（可选，接受兼容性）
- `"chat_template_kwargs": object`（可选）

##### 请求示例

流媒体请求：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "agent_id": "AGENT_ID",
        "openai-compatible": true,
        "stream": true,
        "messages": [
            {
                "role": "user",
                "content": "Hello"
            }
        ],
        "chat_template_kwargs": {
            "enable_thinking": true
        }
     }'
```

现有会话的非流请求：

```bash
curl --request POST \
     --url http://{address}/api/v1/agents/chat/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data-binary '
     {
        "agent_id": "AGENT_ID",
        "openai-compatible": true,
        "stream": false,
        "session_id": "cb2f385cb86211efa36e0242ac120005",
        "messages": [
            {
                "role": "user",
                "content": "Hello"
            }
        ]
     }'
```

##### 请求参数

- `"agent_id"`：（*请求体参数*），`string`，*必填*
  关联智能体的 ID。
- `"messages"`：（*请求体参数*），`list[object]`，*必填*
  OpenAI 风格的聊天消息。
- `"openai-compatible"`：（*请求体参数*），`boolean`，*必填*
  必须为 `true` 才能启用 OpenAI 兼容响应。
- `"stream"`：（*请求体参数*），`boolean`
  是否返回流式数据块。
- `"session_id"`：（*请求体参数*），`string`
  可选的现有会话 ID。
- `"model"`：（*请求体参数*），`string`
  可选的兼容性字段。服务器仍然按 `agent_id` 进行路由。
- `"chat_template_kwargs"`：（*请求体参数*），`object`
  底层 LLM 聊天模板的可选直通参数。通常用于在支持的模型上切换思维/推理模式（例如，`{"enable_thinking": false}`）。

##### 响应

OpenAI 兼容流：

```json
data: {
    "id": "chatcmpl-xxx",
    "object": "chat.completion.chunk",
    "model": "AGENT_ID",
    "choices": [
        {
            "delta": {
                "content": "Hello"
            },
            "finish_reason": null,
            "index": 0
        }
    ]
}

data: [DONE]
```

OpenAI 兼容的非流：

```json
{
    "id": "chatcmpl-xxx",
    "object": "chat.completion",
    "model": "AGENT_ID",
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Hello",
                "reference": {}
            }
        }
    ],
    "usage": {
        "prompt_tokens": 6,
        "completion_tokens": 1,
        "total_tokens": 7
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Agent not found."
}
```

---

### 列出智能体会话

**GET** `/api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}&user_id={user_id}&dsl={dsl}`

列出与指定智能体关联的会话。

#### 请求

- 方法：GET
- URL：`/api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/agents/{agent_id}/sessions?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&id={session_id}&user_id={user_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `agent_id`: (*路径参数*)
  关联智能体的 ID。
- `page`：（*过滤器参数*），`integer`
  指定将显示会话的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每页上的会话数。默认为`30`。
- `orderby`：（*过滤器参数*），`string`
  会话排序所依据的字段。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*），`boolean`
  指示是否应按降序对检索到的会话进行排序。默认为 `true`。
- `id`：（*过滤器参数*），`string`
  要检索的智能体会话的 ID。
- `user_id`：（*过滤器参数*），`string`
  创建会话时传入的可选用户定义 ID。
- `dsl`：（*过滤器参数*），`boolean`
  指示是否在响应中包含会话的 dsl 字段。默认为`true`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [{
        "agent_id": "e9e2b9c2b2f911ef801d0242ac120006",
        "dsl": {
            "answer": [],
            "components": {
                "Answer:OrangeTermsBurn": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Answer",
                        "params": {}
                    },
                    "upstream": []
                },
                "Generate:SocialYearsRemain": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Generate",
                        "params": {
                            "cite": true,
                            "frequency_penalty": 0.7,
                            "llm_id": "gpt-4o___OpenAI-API@OpenAI-API-Compatible",
                            "message_history_window_size": 12,
                            "parameters": [],
                            "presence_penalty": 0.4,
                            "prompt": "Please summarize the following paragraph. Pay attention to the numbers and do not make things up. The paragraph is as follows:\n{input}\nThis is what you need to summarize.",
                            "temperature": 0.1,
                            "top_p": 0.3
                        }
                    },
                    "upstream": []
                },
                "begin": {
                    "downstream": [],
                    "obj": {
                        "component_name": "Begin",
                        "params": {}
                    },
                    "upstream": []
                }
            },
            "graph": {
                "edges": [],
                "nodes": [
                    {
                        "data": {
                            "label": "Begin",
                            "name": "begin"
                        },
                        "height": 44,
                        "id": "begin",
                        "position": {
                            "x": 50,
                            "y": 200
                        },
                        "sourcePosition": "left",
                        "targetPosition": "right",
                        "type": "beginNode",
                        "width": 200
                    },
                    {
                        "data": {
                            "form": {
                                "cite": true,
                                "frequencyPenaltyEnabled": true,
                                "frequency_penalty": 0.7,
                                "llm_id": "gpt-4o___OpenAI-API@OpenAI-API-Compatible",
                                "maxTokensEnabled": true,
                                "message_history_window_size": 12,
                                "parameters": [],
                                "presencePenaltyEnabled": true,
                                "presence_penalty": 0.4,
                                "prompt": "Please summarize the following paragraph. Pay attention to the numbers and do not make things up. The paragraph is as follows:\n{input}\nThis is what you need to summarize.",
                                "temperature": 0.1,
                                "temperatureEnabled": true,
                                "topPEnabled": true,
                                "top_p": 0.3
                            },
                            "label": "Generate",
                            "name": "Generate Answer_0"
                        },
                        "dragging": false,
                        "height": 105,
                        "id": "Generate:SocialYearsRemain",
                        "position": {
                            "x": 561.3457829707513,
                            "y": 178.7211182312641
                        },
                        "positionAbsolute": {
                            "x": 561.3457829707513,
                            "y": 178.7211182312641
                        },
                        "selected": true,
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "generateNode",
                        "width": 200
                    },
                    {
                        "data": {
                            "form": {},
                            "label": "Answer",
                            "name": "Dialogue_0"
                        },
                        "height": 44,
                        "id": "Answer:OrangeTermsBurn",
                        "position": {
                            "x": 317.2368194777658,
                            "y": 218.30635555445093
                        },
                        "sourcePosition": "right",
                        "targetPosition": "left",
                        "type": "logicNode",
                        "width": 200
                    }
                ]
            },
            "history": [],
            "messages": [],
            "path": [],
            "reference": []
        },
        "id": "792dde22b2fa11ef97550242ac120006",
        "message": [
            {
                "content": "Hi! I'm your smart assistant. What can I do for you?",
                "role": "assistant"
            }
        ],
        "source": "agent",
        "user_id": ""
    }]
}
```

失败：

```json
{
    "code": 102,
    "message": "You don't own the agent ccd2f856b12311ef94ca0242ac1200052."
}
```

---

### 删除智能体的会话

**DELETE** `/api/v1/agents/{agent_id}/sessions`

按 ID 删除智能体的会话。

#### 请求

- 方法：DELETE
- URL：`/api/v1/agents/{agent_id}/sessions`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`
  - `"delete_all"`：`boolean`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/agents/{agent_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '
     {
          "ids": ["test_1", "test_2"]
     }'
```

```bash
curl --request DELETE \
     --url http://{address}/api/v1/agents/{agent_id}/sessions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "delete_all": true
     }'
```

##### 请求参数

- `agent_id`: (*路径参数*)
  关联智能体的 ID。
- `"ids"`：（*请求体参数*），`list[string]`
  要删除的会话的 ID。
  - 如果省略或设置为 `null` 或空数组，则不会删除任何会话。
  - 如果提供了 ID 数组，则仅删除与这些 ID 匹配的会话。
- `"delete_all"`：（*请求体参数*），`boolean`
  当省略 `"ids"` 或设置为 `null` 或空数组时，是否删除指定智能体的所有会话。默认为`false`。

#### 响应

成功：

```json
{
    "code": 0
}
```

失败：

```json
{
    "code": 102,
    "message": "The agent doesn't own the session cbd31e52f73911ef93b232903b842af6"
}
```

---

### 文字转语音

**POST** `/api/v1/chat/audio/speech`

使用租户的默认 TTS 模型将文本转换为语音音频，返回流式音频响应。

#### 请求

- 方法：POST
- URL：`/api/v1/chat/audio/speech`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_LOGIN_TOKEN>'`
- 请求体：
  - `"text"`：`string`*（必需）*要合成的文本。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/audio/speech \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --output audio.mp3 \
     --data '{"text": "Hello, how can I help you today?"}'
```

#### 响应

成功：二进制 `audio/mpeg` 流，带有标头 `Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`。

失败：

```json
{
    "code": 102,
    "message": "No default TTS model is set"
}
```

---

### 语音转文字

**POST** `/api/v1/chat/audio/transcription`

使用租户的默认 ASR（自动语音识别）模型转录音频文件。

#### 请求

- 方法：POST
- URL：`/api/v1/chat/audio/transcription`
- 请求头：
  - `'Authorization: Bearer <YOUR_LOGIN_TOKEN>'`
- 正文（多部分/表单数据）：
  - `"file"`：音频文件（`.wav`、`.mp3`、`.m4a`、`.aac`、`.flac`、 `.ogg`、`.webm`、`.opus`、`.wma`)
  - `"stream"`：`string``"true"`用于SSE流，`"false"`（默认）用于单个JSON响应。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/audio/transcription \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --form file=@recording.wav \
     --form stream=false
```

#### 响应

成功（非流式传输）：

```json
{
    "code": 0,
    "data": {
        "text": "Hello, how can I help you today?"
    }
}
```

成功（流媒体）：SSE 活动，内容为 `data: {"event": "partial", "text": "..."}`。

失败：

```json
{
    "code": 102,
    "message": "Unsupported audio format: .mp4. Allowed: .aac, .flac, .m4a, .mp3, .ogg, .opus, .wav, .webm, .wma"
}
```

---

### 生成思维导图

**POST** `/api/v1/chat/mindmap`

根据问题和一组知识库 ID 生成思维导图。

#### 请求

- 方法：POST
- URL：`/api/v1/chat/mindmap`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_LOGIN_TOKEN>'`
- 请求体：
  - `"question"`：`string`*（必需）*中心问题或主题。
  - `"kb_ids"`： `list[string]` *（必需）* 要搜索的知识库 ID。
  - `"search_id"`：`string` *（可选）*用于合并其他`kb_ids`和设置的已保存搜索配置的 ID。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/mindmap \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --data '{
         "question": "What is retrieval-augmented generation?",
         "kb_ids": ["kb-abc123"]
     }'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "name": "Retrieval-Augmented Generation",
        "children": [...]
    }
}
```

失败：

```json
{
    "code": 500,
    "message": "..."
}
```

---

### 生成相关问题

**POST** `/api/v1/chat/recommandation`

根据用户的原始查询生成五到十个替代问题字符串，以检索更相关的搜索结果。

> **注意**：已废弃
`POST /api/v1/sessions/related_questions` 已弃用。请改用此端点。

此操作需要 `Bearer Login Token`，通常会在 24 小时内过期。您可以在浏览器的请求标头中轻松找到它，如下所示：

![图片](https://raw.githubusercontent.com/infiniflow/ragflow-docs/main/images/login_token.jpg)

> **提示**：NOTE
聊天模型根据指令自主确定要生成的问题数量，通常在 5 到 10 之间。

#### 请求

- 方法：POST
- URL：`/api/v1/chat/recommandation`
- 请求头：
  - `'content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_LOGIN_TOKEN>'`
- 请求体：
  - `"question"`：`string`*（必需）*原始用户问题。
  - `"search_id"`：`string`*（可选）*使用自定义LLM设置的已保存搜索配置的ID。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/chat/recommandation \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --data '{
          "question": "What are the key advantages of Neovim over Vim?"
     }'
```

##### 请求参数

- `"question"`：（*请求体参数*），`string`
  原来的用户问题。
- `"search_id"`：（*请求体参数*），`string`
  用于使用自定义 LLM 设置的已保存搜索配置的 ID。如果提供，将使用搜索配置中的 LLM 模型和生成设置。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        "What makes Neovim superior to Vim in terms of features?",
        "How do the benefits of Neovim compare to those of Vim?",
        "What advantages does Neovim offer that are not present in Vim?",
        "In what ways does Neovim outperform Vim in functionality?",
        "What are the most significant improvements in Neovim compared to Vim?",
        "What unique advantages does Neovim bring to the table over Vim?",
        "How does the user experience in Neovim differ from Vim in terms of benefits?",
        "What are the top reasons to switch from Vim to Neovim?",
        "What features of Neovim are considered more advanced than those in Vim?"
    ],
    "message": "success"
}
```

失败：

```json
{
    "code": 401,
    "data": null,
    "message": "<Unauthorized '401: Unauthorized'>"
}
```

---

## 智能体管理

---

### 列出智能体

**GET** `/api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={agent_name}&id={agent_id}`

列出智能体。

#### 请求

- 方法：GET
- URL：`/api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&title={agent_name}&id={agent_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/agents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&title={agent_name}&id={agent_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `page`：（*过滤器参数*），`integer`
  指定将显示智能体的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每页上的智能体数量。默认为`30`。
- `orderby`：（*过滤器参数*），`string`
  结果排序所依据的属性。可用选项：
  - `create_time`（默认）
  - `update_time`
- `desc`：（*过滤器参数*），`boolean`
  指示检索到的智能体是否应按降序排序。默认为`true`。
- `id`：（*过滤器参数*），`string`
  要检索的智能体的 ID。
- `title`：（*过滤器参数*），`string`
  要检索的智能体的名称。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "avatar": null,
            "canvas_type": null,
            "create_date": "Thu, 05 Dec 2024 19:10:36 GMT",
            "create_time": 1733397036424,
            "description": null,
            "dsl": {
                "answer": [],
                "components": {
                    "begin": {
                        "downstream": [],
                        "obj": {
                            "component_name": "Begin",
                            "params": {}
                        },
                        "upstream": []
                    }
                },
                "graph": {
                    "edges": [],
                    "nodes": [
                        {
                            "data": {
                                "label": "Begin",
                                "name": "begin"
                            },
                            "height": 44,
                            "id": "begin",
                            "position": {
                                "x": 50,
                                "y": 200
                            },
                            "sourcePosition": "left",
                            "targetPosition": "right",
                            "type": "beginNode",
                            "width": 200
                        }
                    ]
                },
                "history": [],
                "messages": [],
                "path": [],
                "reference": []
            },
            "id": "8d9ca0e2b2f911ef9ca20242ac120006",
            "title": "123465",
            "update_date": "Thu, 05 Dec 2024 19:10:56 GMT",
            "update_time": 1733397056801,
            "user_id": "69736c5e723611efb51b0242ac120007"
        }
    ]
}
```

失败：

```json
{
    "code": 102,
    "message": "The agent doesn't exist."
}
```

---

### 创建智能体

**POST** `/api/v1/agents`

创建智能体。

#### 请求

- 方法：POST
- URL：`/api/v1/agents`
- 请求头：
  - `'Content-Type: application/json`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"title"`：`string`
  - `"description"`：`string`
  - `"dsl"`：`object`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/agents \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
         "title": "Test Agent",
         "description": "A test agent",
         "dsl": {
           // ... Canvas DSL here ...
         }
     }'
```

##### 请求参数

- `title`：（*请求体参数*），`string`，*必填*
  智能体的头衔。
- `description`：（*请求体参数*），`string`
  智能体的描述。默认为`None`。
- `dsl`：（*请求体参数*），`object`，*必填*
  智能体的画布 DSL 对象。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true,
    "message": "success"
}
```

失败：

```json
{
    "code": 102,
    "message": "Agent with title test already exists."
}
```

---

### 更新智能体

**PUT** `/api/v1/agents/{agent_id}`

通过 id 更新智能体。

#### 请求

- 方法：PUT
- URL：`/api/v1/agents/{agent_id}`
- 请求头：
  - `'Content-Type: application/json`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"title"`：`string`
  - `"description"`：`string`
  - `"dsl"`：`object`

##### 请求示例

```bash
curl --request PUT \
     --url http://{address}/api/v1/agents/58af890a2a8911f0a71a11b922ed82d6 \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
         "title": "Test Agent",
         "description": "A test agent",
         "dsl": {
           // ... Canvas DSL here ...
         }
     }'
```

##### 请求参数

- `agent_id`：（*路径参数*），`string`
  要更新的智能体的 ID。
- `title`：（*请求体参数*），`string`
  智能体的头衔。
- `description`：（*请求体参数*），`string`
  智能体的描述。
- `dsl`：（*请求体参数*），`object`
  智能体的画布 DSL 对象。

仅在请求正文中指定要更改的参数。如果参数不存在或者为`None`，则不会更新。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true,
    "message": "success"
}
```

失败：

```json
{
    "code": 103,
    "message": "Only owner of canvas authorized for this operation."
}
```

---

### 删除智能体

**DELETE** `/api/v1/agents/{agent_id}`

通过id删除智能体。

#### 请求

- 方法：DELETE
- URL：`/api/v1/agents/{agent_id}`
- 请求头：
  - `'Content-Type: application/json`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/agents/58af890a2a8911f0a71a11b922ed82d6 \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{}'
```

##### 请求参数

- `agent_id`：（*路径参数*），`string`
  要删除的智能体的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true,
    "message": "success"
}
```

失败：

```json
{
    "code": 103,
    "message": "Only owner of canvas authorized for this operation."
}
```

---

## 记忆管理

### 创建记忆

**POST** `/api/v1/memories`

创造新的记忆。

#### 请求

- 方法：POST
- URL：`/api/v1/memories`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"memory_type"`：`list[string]`
  - `"embd_id"`：`string`。
  - `"llm_id"`：`string`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/memories' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR_API_KEY>' \
--data-raw '{
    "name": "new_memory_1",
    "memory_type": ["raw", "semantic"],
    "embd_id": "BAAI/bge-large-zh-v1.5@BAAI",
    "llm_id": "glm-4-flash@ZHIPU-AI"
}'
```

##### 请求参数

- `name`：（*请求体参数*），`string`，*必填*

  要创建的记忆的唯一名称。它必须遵守以下要求：

  - 仅基本多语言平面 (BMP)
  - 最多 128 个字符

- `memory_type`：（*请求体参数*），`list[enum<string>]`，*必填*

  指定要提取的记忆类型。可用选项：

  - `raw`：用户和智能体之间的原始对话内容。 *默认必需*。
  - `semantic`：有关用户和世界的一般知识和事实。
  - `episodic`：特定事件和经历的时间戳记录。
  - `procedural`：学到的技能、习惯和自动化程序。

- `embd_id`：（*请求体参数*），`string`，*必填*

  要使用的嵌入模型的名称。例如：`"BAAI/bge-large-zh-v1.5@BAAI"`

  - 最多 255 个字符
  - 必须遵循 `model_name@model_factory` 格式

- `llm_id`：（*请求体参数*），`string`，*必填*

  要使用的聊天模型的名称。例如：`"glm-4-flash@ZHIPU-AI"`

  - 最多 255 个字符
  - 必须遵循 `model_name@model_factory` 格式

#### 响应

成功：

```json
{
	"code": 0,
	"data": {
	...your new memory here
	},
	"message": true
}
```

失败：

```json
{
    "code": 101,
    "message": "Memory name cannot be empty or whitespace."
}
```

### 更新记忆

**PUT** `/api/v1/memories/{memory_id}`

更新指定记忆的配置。

#### 请求

- 方法：PUT
- URL：`/api/v1/memories/{memory_id}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"avatar"`：`string`
  - `"permission"`：`string`
  - `"llm_id"`：`string`
  - `"description"`：`string`
  - `"memory_size"`：`int`
  - `"forgetting_policy"`：`string`
  - `"temperature"`：`float`
  - `"system_promot"`：`string`
  - `"user_prompt"`：`string`

##### 请求示例

```bash
curl --location --request PUT 'http://{address}/api/v1/memories/d6775d4eeada11f08ca284ba59bc53c7' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR_API_KEY>' \
--data '{
    "name": "name_update",
}'
```

##### 请求参数

- `memory_id`: (*路径参数*)

  要更新的记忆的 ID。

- `name`：（*请求体参数*），`string`，*可选*

  修改后的记忆名称。

  - 仅基本多语言平面 (BMP)
  - 最多 128 个字符，*可选*

- `avatar`：（*请求体参数*），`string`，*可选*

  更新后的头像的base64编码。

  - 最多 65535 个字符

- `permission`：（*请求体参数*），`enum<string>`，*可选*

  更新后的记忆权限。可用选项：

  - `"me"`：（默认）只有您可以管理记忆。
  - `"team"`：团队成员可以读取和使用该记忆；只有团队所有者、团队管理员和超级管理员可以创建或管理团队共享资源。

- `llm_id`：（*请求体参数*），`string`，*可选*

  要使用的聊天模型的名称。例如：`"glm-4-flash@ZHIPU-AI"`

  - 最多 255 个字符
  - 必须遵循 `model_name@model_factory` 格式

- `description`：（*请求体参数*），`string`，*可选*

  记忆的描述。默认为 `None`。

- `memory_size`：（*请求体参数*），`int`，*可选*

  默认为 `5*1024*1024` 字节。考虑每条消息的内容 + 其嵌入向量（≈ 内容 + 维度 × 8 字节）。示例：具有 1024 维嵌入的 1 KB 消息使用约 9 KB。 5 MB 默认限制可容纳约 500 条此类消息。

  - 最大 10 * 1024 * 1024 字节

- `forgetting_policy`：（*请求体参数*），`enum<string>`，*可选*

  当达到大小限制时，根据所选策略逐出现有数据，为新消息释放空间。可用选项：

  - `"FIFO"`：（默认）优先考虑最早`forget_at`时间删除的邮件。当设置了 `forget_at` 的消息池不足时，它会按照 `valid_at` 的升序顺序选择消息（最旧的在前）。

- `temperature`：（*请求体参数*），`float`，*可选*

  调整输出随机性。较低=更具确定性；更高=更有创意。

  - 范围 [0, 1]

- `system_prompt`：（*请求体参数*），`string`，*可选*

  定义人工智能助手的系统级指令和角色。它是根据`memory/utils/prompt_util.py`中的`PromptAssembler`所选择的`memory_type`自动组装的。此提示设置了整个对话的基本行为和上下文。

  - 保持 `OUTPUT REQUIREMENTS` 和 `OUTPUT FORMAT` 部分不变。

- `user_prompt`：（*请求体参数*），`string`，*可选*

  代表用户的自定义设置，即AI需要直接响应的特定问题或指令。默认为`None`。

#### 响应

成功：

```json
{
	"code": 0,
	"data": {
	...your updated memory here
	},
	"message": true
}
```

失败：

```json
{
    "code": 101,
    "message": "Memory name cannot be empty or whitespace."
}
```

### 列出记忆

**GET** `/api/v1/memories?tenant_id={tenant_ids}&memory_type={memory_types}&storage_type={storage_type}&keywords={keywords}&page={page}&page_size={page_size}`

列出回忆。

#### 请求

- 方法：GET
- URL：`/api/v1/memories?tenant_id={tenant_ids}&memory_type={memory_types}&storage_type={storage_type}&keywords={keywords}&page={page}&page_size={page_size}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/memories?keywords=&page_size=50&page=1&memory_type=semantic%2Cepisodic' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `tenant_id`：（*过滤器参数*），`string`或`list[string]`， *可选*

  车主ID，支持搜索多个ID。

- `memory_type`：（*过滤器参数*），`enum<string>`或`list[enum<string>]`， *可选*

  记忆类型（在创建期间设置）。如果记忆的类型为**包含在**所提供的值中，则记忆匹配。可用选项：

  - `raw`
  - `semantic`
  - `episodic`
  - `procedural`

- `storage_type`：（*过滤器参数*），`enum<string>`，*可选*

  消息的存储格式。可用选项：

  - `table`：（默认）

- `keywords`：（*过滤器参数*），`string`，*可选*

  检索的记忆名称，支持模糊检索。

- `page`：（*过滤器参数*），`int`，*可选*

  指定将显示记忆的页面。默认为`1`。

- `page_size`：（*过滤器参数*），`int`，*可选*

  每页上的记忆数量。默认为`50`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "memory_list": [
            {
                "avatar": null,
                "create_date": "Tue, 06 Jan 2026 16:36:47 GMT",
                "create_time": 1767688607040,
                "description": null,
                "id": "d6775d4eeada11f08ca284ba59bc53c7",
                "memory_type": [
                    "raw",
                    "semantic"
                ],
                "name": "new_memory_1",
                "owner_name": "Lynn",
                "permissions": "me",
                "storage_type": "table",
                "tenant_id": "55777efac9df11f09cd07f49bd527ade"
            },
            ...other 3 memories here
        ],
        "total_count": 4
    },
    "message": true
}
```

失败：

```json
{
    "code": 500,
    "message": "Internal Server Error."
}
```

### 获取记忆配置

**GET** `/api/v1/memories/{memory_id}/config`

获取指定记忆的配置。

#### 请求

- 方法：GET
- URL：`/api/v1/memories/{memory_id}/config`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/memories/6c8983badede11f083f184ba59bc53c7/config' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  记忆的 ID。

#### 响应

成功

```json
{
    "code": 0,
    "data": {
        "avatar": null,
        "create_date": "Mon, 22 Dec 2025 10:32:13 GMT",
        "create_time": 1766370733354,
        "description": null,
        "embd_id": "BAAI/bge-large-zh-v1.5@SILICONFLOW",
        "forgetting_policy": "FIFO",
        "id": "6c8983badede11f083f184ba59bc53c7",
        "llm_id": "glm-4.5-flash@ZHIPU-AI",
        "memory_size": 5242880,
        "memory_type": [
            "raw",
            "semantic",
            "episodic",
            "procedural"
        ],
        "name": "mem1222",
        "owner_name": null,
        "permissions": "me",
        "storage_type": "table",
        "system_prompt": ...your prompt here,
        "temperature": 0.5,
        "tenant_id": "55777efac9df11f09cd07f49bd527ade",
        "update_date": null,
        "update_time": null,
        "user_prompt": null
    },
    "message": true
}
```

失败

```json
{
    "code": 404,
    "data": null,
    "message": "Memory '{memory_id}' not found."
}
```

### 删除记忆

**DELETE** `/api/v1/memories/{memory_id}`

删除指定记忆。

#### 请求

- 方法：DELETE
- URL：`/api/v1/memories/{memory_id}`
- 请求头：
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location --request DELETE 'http://{address}/api/v1/memories/d6775d4eeada11f08ca284ba59bc53c7' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  要删除的记忆的 ID。

#### 响应

成功

```json
{
    "code": 0,
    "data": null,
    "message": true
}
```

失败

```json
{
    "code": 404,
    "data": null,
    "message": true
}
```

### 列出记忆的消息

**GET** `/api/v1/memories/{memory_id}?agent_id={agent_id}&keywords={session_id}&page={page}&page_size={page_size}`

列出指定记忆的消息。

#### 请求

- 方法：GET
- URL：`/api/v1/memories/{memory_id}?agent_id={agent_id}&keywords={session_id}&page={page}&page_size={page_size}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/memories/6c8983badede11f083f184ba59bc53c?page=1' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  显示消息的记忆 ID。

- `agent_id`：（*过滤器参数*），`string`或`list[string]`， *可选*

  按源智能体的 ID 过滤消息。支持多个值。

- `session_id`：（*过滤器参数*），`string`，*可选*

  按会话 ID 过滤消息。该字段支持模糊搜索。

- `page`：（*过滤器参数*），`int`，*可选*

  指定将显示消息的页面。默认为`1`。

- `page_size`：（*过滤器参数*），`int`，*可选*

  每页上的消息数。默认为`50`。

#### 响应

成功

```json
{
    "code": 0,
    "data": {
        "messages": {
            "message_list": [
                {
                    "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
                    "agent_name": "memory_agent_1223",
                    "extract": [
                        {
                            "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
                            "agent_name": "memory_agent_1223",
                            "forget_at": "None",
                            "invalid_at": "None",
                            "memory_id": "6c8983badede11f083f184ba59bc53c7",
                            "message_id": 236,
                            "message_type": "semantic",
                            "session_id": "65b89ab8e96411f08d4e84ba59bc53c7",
                            "source_id": 233,
                            "status": true,
                            "user_id": "",
                            "valid_at": "2026-01-04 19:56:46"
                        },
                        ...other extracted messages
                    ],
                    "forget_at": "None",
                    "invalid_at": "None",
                    "memory_id": "6c8983badede11f083f184ba59bc53c7",
                    "message_id": 233,
                    "message_type": "raw",
                    "session_id": "65b89ab8e96411f08d4e84ba59bc53c7",
                    "source_id": "None",
                    "status": true,
                    "task": {
                        "progress": 1.0,
                        "progress_msg": "\n2026-01-04 19:56:46 Prepared prompts and LLM.\n2026-01-04 19:57:48 Get extracted result from LLM.\n2026-01-04 19:57:48 Extracted 6 messages from raw dialogue.\n2026-01-04 19:57:48 Prepared embedding model.\n2026-01-04 19:57:48 Embedded extracted content.\n2026-01-04 19:57:48 Saved messages to storage.\n2026-01-04 19:57:48 Message saved successfully."
                    },
                    "user_id": "",
                    "valid_at": "2026-01-04 19:56:42"
                },
                {
                    "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
                    "agent_name": "memory_agent_1223",
                    "extract": [],
                    "forget_at": "None",
                    "invalid_at": "None",
                    "memory_id": "6c8983badede11f083f184ba59bc53c7",
                    "message_id": 226,
                    "message_type": "raw",
                    "session_id": "d982a8cbe96111f08a1384ba59bc53c7",
                    "source_id": "None",
                    "status": true,
                    "task": {
                        "progress": -1.0,
                        "progress_msg": "Failed to insert message into memory. Details: 6c8983badede11f083f184ba59bc53c7_228:{'type': 'document_parsing_exception', 'reason': \"[1:230] failed to parse field [valid_at] of type [date] in document with id '6c8983badede11f083f184ba59bc53c7_228'. Preview of field's value: ''\", 'caused_by': {'type': 'illegal_argument_exception', 'reason': 'cannot parse empty date'}}; 6c8983badede11f083f184ba59bc53c7_229:{'type': 'document_parsing_exception', 'reason': \"[1:230] failed to parse field [valid_at] of type [date] in document with id '6c8983badede11f083f184ba59bc53c7_229'. Preview of field's value: ''\", 'caused_by': {'type': 'illegal_argument_exception', 'reason': 'cannot parse empty date'}}; 6c8983badede11f083f184ba59bc53c7_230:{'type': 'document_parsing_exception', 'reason': \"[1:230] failed to parse field [valid_at] of type [date] in document with id '6c8983badede11f083f184ba59bc53c7_230'. Preview of field's value: ''\", 'caused_by': {'type': 'illegal_argument_exception', 'reason': 'cannot parse empty date'}}; 6c8983badede11f083f184ba59bc53c7_231:{'type': 'document_parsing_exception', 'reason': \"[1:230] failed to parse field [valid_at] of type [date] in document with id '6c8983badede11f083f184ba59bc53c7_231'. Preview of field's value: ''\", 'caused_by': {'type': 'illegal_argument_exception', 'reason': 'cannot parse empty date'}}; 6c8983badede11f083f184ba59bc53c7_232:{'type': 'document_parsing_exception', 'reason': \"[1:230] failed to parse field [valid_at] of type [date] in document with id '6c8983badede11f083f184ba59bc53c7_232'. Preview of field's value: ''\", 'caused_by': {'type': 'illegal_argument_exception', 'reason': 'cannot parse empty date'}}"
                    },
                    "user_id": "",
                    "valid_at": "2026-01-04 19:38:26"
                },
                ...other 11 messages
            ],
            "total_count": 13
        },
        "storage_type": "table"
    },
    "message": true
}
```

失败

```
{
    "code": 404,
    "data": null,
    "message": "Memory '{memory_id}' not found."
}
```

### 添加消息

**POST** `/api/v1/messages`

将消息添加到指定的记忆中。

#### 请求

- 方法：POST
- URL：`/api/v1/messages`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"memory_id"`：`list[string]`
  - `"agent_id"`：`string`
  - `"session_id"`：`string`
  - `"user_id"`：`string`
  - `"user_input"`：`string`
  - `"agent_response"`：`string`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/messages' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR_API_KEY>' \
--data '{
    "memory_id": ["6c8983badede11f083f184ba59bc53c7", "87ebb892df1711f08d6b84ba59bc53c7"],
    "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
    "session_id": "bf0a50abeb8111f0917884ba59bc53c7",
    "user_id": "55777efac9df11f09cd07f49bd527ade",
    "user_input": "your user input here",
    "agent_response": "your agent response here"

}'
```

##### 请求参数

- `memory_id`：（*请求体参数*），`list[string]`，*必填*

  保存消息的存储器的ID。

- `agent_id`：（*请求体参数*），`string`，*必填*

  消息源智能体的 ID。

- `session_id`：（*请求体参数*），`string`，*必填*

  消息会话的 ID。

- `user_id`：（*请求体参数*），`string`，*可选*

  参与与智能体对话的用户。默认为`None`。

- `user_input`：（*请求体参数*），`string`，*必填*

  用户提供的文本输入。

- `agent_response`：（*请求体参数*），`string`，*必填*

  AI 智能体生成的文本响应。

#### 响应

成功

```json
{
    "code": 0,
    "data": null,
    "message": "All add to task."
}
```

失败

```json
{
    "code": 500,
    "data": null,
    "message": "Some messages failed to add. Detail: {fail information}"
}
```

### 忘记消息

**DELETE** `/api/v1/messages/{memory_id}:{message_id}`

忘记指定的消息。遗忘后，这条消息将不会被智能体检索到，并且也会被遗忘策略优先清理。

#### 请求

- 方法：DELETE
- URL：`/api/v1/messages/{memory_id}:{message_id}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location --request DELETE 'http://{address}/api/v1/messages/6c8983badede11f083f184ba59bc53c7:272' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  指定消息所属记忆的ID。

- `message_id`：（*路径参数*），`string`，*必填*

  要忘记的消息的 ID。

#### 响应

成功

```json
{
    "code": 0,
    "data": null,
    "message": true
}
```

失败

```json
{
    "code": 404,
    "data": null,
    "message": "Memory '{memory_id}' not found."
}
```

### 更新消息状态

**PUT** `/api/v1/messages/{memory_id}:{message_id}`

更新消息状态、启用或禁用消息。一旦消息被禁用，智能体将无法检索该消息。

#### 请求

- 方法：PUT
- URL：`/api/v1/messages/{memory_id}:{message_id}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"status"`：`bool`

##### 请求示例

```bash
curl --location --request PUT 'http://{address}/api/v1/messages/6c8983badede11f083f184ba59bc53c7:270' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR_API_KEY>' \
--data '{
    "status": false
}'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  指定消息所属记忆的ID。

- `message_id`：（*路径参数*），`string`，*必填*

  要启用或禁用的消息的 ID。

- `status`：（*请求体参数*），`bool`，*必填*

  消息的状态。 `True` = `enabled`，`False` = `disabled`。

#### 响应

成功

```json
{
    "code": 0,
    "data": null,
    "message": true
}
```

失败

```json
{
    "code": 404,
    "data": null,
    "message": "Memory '{memory_id}' not found."
}
```

### 搜索消息

**GET** `/api/v1/messages/search?query={question}&memory_id={memory_id}&similarity_threshold={similarity_threshold}&keywords_similarity_weight={keywords_similarity_weight}&top_n={top_n}`

根据提供的`query`和其他配置参数从记忆中搜索和检索消息。

#### 请求

- 方法：GET
- URL：`/api/v1/messages/search?query={question}&memory_id={memory_id}&similarity_threshold={similarity_threshold}&keywords_similarity_weight={keywords_similarity_weight}&top_n={top_n}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/messages/search?query=%22who%20are%20you%3F%22&memory_id=6c8983badede11f083f184ba59bc53c7&similarity_threshold=0.2&keywords_similarity_weight=0.7&top_n=10' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `question`：（*过滤器参数*），`string`，*必填*

  用于查找相关消息的搜索词或自然语言问题。

- `memory_id`：（*过滤器参数*），`string`或`list[string]`， *必填*

  要搜索的记忆的 ID。  支持多个值。

- `agent_id`：（*过滤器参数*），`string`，*可选*

  消息源智能体的 ID。默认为`None`。

- `session_id`：（*过滤器参数*），`string`，*可选*

  消息会话的 ID。默认为 `None`。

- `user_id`：（*过滤器参数*），`string`，*可选*

  参与与智能体对话的用户。默认为 `None`。

- `similarity_threshold`：（*过滤器参数*），`float`，*可选*

  消息被视为匹配所需的最小余弦相似度分数。值越高，结果越精确，但结果越少。默认为`0.2`。

  - 范围 [0.0, 1.0]

- `keywords_similarity_weight`：（*过滤器参数*），`float`，*可选*

  控制关键字匹配与语义（基于嵌入）匹配对最终相关性得分的影响。值为 0.5 赋予它们相同的权重。默认为`0.7`。

  - 范围 [0.0, 1.0]

- `top_n`：（*过滤器参数*），`int`，*可选*

  要返回的最相关消息的最大数量。这限制了结果集的大小以提高效率。默认为`10`。

#### 响应

成功

```json
{
    "code": 0,
    "data": [
        {
            "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
            "content": "User Input: who am I?\nAgent Response: To address the question \"who am I?\", let's follow the logical steps outlined in the instructions:\n\n1. **Understand the User's Request**: The user is asking for a clarification or identification of their own self. This is a fundamental question about personal identity.\n\n2. **Decompose the Request**: The request is quite simple and doesn't require complex decomposition. The core task is to provide an answer that identifies the user in some capacity.\n\n3. **Execute the Subtask**:\n   - **Identify the nature of the question**: The user is seeking to understand their own existence or their sense of self.\n   - **Assess the context**: The context is not explicitly given, so the response will be general.\n   - **Provide a response**: The answer should acknowledge the user's inquiry into their identity.\n\n4. **Validate Accuracy and Consistency**: The response should be consistent with the general understanding of the question. Since the user has not provided specific details about their identity, the response should be broad and open-ended.\n\n5. **Summarize the Final Result**: The user is asking \"who am I?\" which is an inquiry into their own identity. The answer is that the user is the individual who is asking the question. Without more specific information, a detailed description of their identity cannot be provided.\n\nSo, the final summary would be:\n\nThe user is asking the question \"who am I?\" to seek an understanding of their own identity. The response to this question is that the user is the individual who is posing the question. Without additional context or details, a more comprehensive description of the user's identity cannot be given.",
            "forget_at": "None",
            "invalid_at": "None",
            "memory_id": "6c8983badede11f083f184ba59bc53c7",
            "message_id": 61,
            "message_type": "raw",
            "session_id": "ebf8025de52211f0b56684ba59bc53c7",
            "source_id": "None",
            "status": true,
            "user_id": "",
            "valid_at": "2025-12-30 09:57:49"
        },
        ...other 2 matched messages here
    ],
    "message": true
}
```

失败

```json
{
    "code": 500,
    "message": "Internal Server Error."
}
```

### 获取最近消息

**GET** `/api/v1/messages?memory_id={memory_id}&agent_id={agent_id}&session_id={session_id}&limit={limit}`

从指定记忆中检索最新消息。通常接受 `limit` 参数来控制返回的消息数量。

#### 请求

- 方法：GET
- URL：`/api/v1/messages?memory_id={memory_id}&agent_id={agent_id}&session_id={session_id}&limit={limit}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/messages?memory_id=6c8983badede11f083f184ba59bc53c7&limit=10' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*过滤器参数*），`string`或`list[string]`， *必填*

  要搜索的记忆的 ID。  支持多个值。

- `agent_id`：（*过滤器参数*），`string`，*可选*

  消息源智能体的 ID。默认为`None`。

- `session_id`：（*过滤器参数*），`string`，*可选*

  消息会话的 ID。默认为`None`。

- `limit`：（*过滤器参数*），`int`，*可选*

  控制返回消息的数量。默认为`10`。

#### 响应

成功

```json
{
    "code": 0,
    "data": [
        {
            "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
            "content": "User Input: what is pineapple?\nAgent Response: A pineapple is a tropical fruit known for its sweet, tangy flavor and distinctive, spiky appearance. Here are the key facts:\nScientific Name: Ananas comosus\nPhysical Description: It has a tough, spiky, diamond-patterned outer skin (rind) that is usually green, yellow, or brownish. Inside, the juicy yellow flesh surrounds a fibrous core.\nGrowth: Unlike most fruits, pineapples do not grow on trees. They grow from a central stem as a composite fruit, meaning they are formed from many individual berries that fuse together around the core. They grow on a short, leafy plant close to the ground.\nUses: Pineapples are eaten fresh, cooked, grilled, juiced, or canned. They are a popular ingredient in desserts, fruit salads, savory dishes (like pizzas or ham glazes), smoothies, and cocktails.\nNutrition: They are a good source of Vitamin C, manganese, and contain an enzyme called bromelain, which aids in digestion and can tenderize meat.\nSymbolism: The pineapple is a traditional symbol of hospitality and welcome in many cultures.\nAre you asking about the fruit itself, or its use in a specific context?",
            "forget_at": "None",
            "invalid_at": "None",
            "memory_id": "6c8983badede11f083f184ba59bc53c7",
            "message_id": 269,
            "message_type": "raw",
            "session_id": "bf0a50abeb8111f0917884ba59bc53c7",
            "source_id": "None",
            "status": true,
            "user_id": "",
            "valid_at": "2026-01-07 16:49:12"
        },
        ...other 9 messages here
    ],
    "message": true
}
```

失败

```json
{
    "code": 500,
    "message": "Internal Server Error."
}
```

### 获取消息内容

**GET** `/api/v1/messages/{memory_id}:{message_id}/content`

使用特定消息的唯一消息 ID 检索其完整内容和嵌入向量。

#### 请求

- 方法：GET
- URL：`/api/v1/messages/{memory_id}:{message_id}/content`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --location 'http://{address}/api/v1/messages/6c8983badede11f083f184ba59bc53c7:270/content' \
--header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `memory_id`：（*路径参数*），`string`，*必填*

  指定消息所属记忆的ID。

- `message_id`：（*路径参数*），`string`，*必填*

  消息的 ID。

#### 响应

成功

```json
{
    "code": 0,
    "data": {
        "agent_id": "8db9c8eddfcc11f0b5da84ba59bc53c7",
        "content": "Pineapples are tropical fruits known for their sweet, tangy flavor and distinctive, spiky appearance",
        "content_embed": [
            0.03641991,
            ...embed vector here
        ],
        "forget_at": null,
        "id": "6c8983badede11f083f184ba59bc53c7_270",
        "invalid_at": null,
        "memory_id": "6c8983badede11f083f184ba59bc53c7",
        "message_id": 270,
        "message_type": "semantic",
        "session_id": "bf0a50abeb8111f0917884ba59bc53c7",
        "source_id": 269,
        "status": false,
        "user_id": "",
        "valid_at": "2026-01-07 16:48:37",
        "zone_id": 0
    },
    "message": true
}
```

失败

```json
{
    "code": 404,
    "data": null,
    "message": "Memory '{memory_id}' not found."
}
```

---

## 系统

---

### 检查系统健康状况

**GET** `/api/v1/system/healthz`

检查RAGFlow依赖项（数据库、Redis、文档引擎、对象存储）的健康状态。

> **注意**：已废弃
`GET /v1/system/healthz` 已弃用。请改用此端点。

#### 请求

- 方法：GET
- URL：`/api/v1/system/healthz`
- 请求头：
  - '内容类型：应用程序/json'
  （无需授权）

##### 请求示例

```bash
curl --request GET
     --url http://{address}/api/v1/system/healthz
     --header 'Content-Type: application/json'
```

##### 请求参数

- `address`：（*路径参数*），字符串
  后端服务的主机和端口（例如，`localhost:7897`）。

---

#### 响应

- **200 OK** – 所有服务均正常

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "db": "ok",
  "redis": "ok",
  "doc_engine": "ok",
  "storage": "ok",
  "status": "ok"
}
```

- **500 内部服务器错误** – 至少一项服务运行状况不佳

```http
HTTP/1.1 500 INTERNAL SERVER ERROR
Content-Type: application/json

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

说明：

- 每项服务都报告为“ok”或“nok”。
- 顶级 `status` 反映了整体健康状况。
- 如果任何服务为“nok”，详细错误信息将显示在`_meta`中。

---

## 文件管理

---

### 上传文件

**POST** `/api/v1/files`

将一个或多个文件上传到系统。

> **注意**：已废弃
`POST /api/v1/file/upload` 已弃用。请改用此端点。

#### 请求

- 方法：POST
- URL：`/api/v1/files`
- 请求头：
  - `'Content-Type: multipart/form-data'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 形式：
  - `'file=@{FILE_PATH}'`
  - `'parent_id'`：`string`（可选）

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/files \
     --header 'Content-Type: multipart/form-data' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --form 'file=@./test1.txt' \
     --form 'file=@./test2.pdf' \
     --form 'parent_id={folder_id}'
```

##### 请求参数

- `'file'`：（*表单参数*），`file`，*必填*
  要上传的文件。可以在单个请求中上传多个文件。
- `'parent_id'`：（*表单参数*），`string`
  文件将上传到的父文件夹 ID。如果未指定，文件将上传到根文件夹。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "id": "b330ec2e91ec11efbc510242ac120004",
            "name": "test1.txt",
            "size": 17966,
            "type": "doc",
            "parent_id": "527fa74891e811ef9c650242ac120006",
            "location": "test1.txt",
            "create_time": 1729763127646
        }
    ]
}
```

失败：

```json
{
    "code": 400,
    "message": "No file part!"
}
```

---

### 上传文件

**POST** `/api/v1/documents/upload`

上传文件并创建相应的文档。

> **注意**：已废弃
`POST /v1/document/upload_info` 和 `POST /api/v1/file/upload_info` 已弃用。请改用此端点。

#### 请求

- 方法：POST
- URL：`/api/v1/documents/upload`
- 请求头：
  - `'Content-Type: multipart/form-data'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 形式：
  - `'file=@{FILE_PATH}'`（与`url`互斥）
- 查询：
  - `url`：要抓取并转换为运行时附件的 URL（与 `file` 互斥）。

##### 请求示例

上传本地文件：

```bash
curl --request POST \
     --url http://{address}/api/v1/documents/upload \
     --header 'Content-Type: multipart/form-data' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --form 'file=@./test1.pdf'
```

抓取一个URL：

```bash
curl --request POST \
     --url 'http://{address}/api/v1/documents/upload?url=https://example.com/page' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `'file'`：（*表单参数*），`file`，*可选*
  要上传的文件。与 `url` 互斥；必须提供 `file` 或 `url`。
- `url`：（*查询参数*），`string`，*可选*
  要抓取并存储为附件的 URL。与 `file` 互斥；必须提供 `url` 或 `file`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
      "created_at": 1772451421.7924063,
      "created_by": "be951084066611f18f5f00155d2f98f4",
      "extension": "pdf",
      "id": "2143a03d162c11f1b80f00155d334d02",
      "mime_type": "application/pdf",
      "name": "test1.pdf",
      "preview_url": null,
      "size": 49705
    },
    "message": "success"
}
```

失败：

```json
{
    "code": 400,
    "message": "Provide either multipart file(s) or ?url=...!"
}
```

---

### 下载附件

**GET** `/api/v1/agents/attachments/{attachment_id}/download`

> **注意**：已废弃
之前的端点 `GET /v1/document/download/{doc_id}` 和 `GET /api/v1/document/download/{doc_id}` 已弃用。请改用此端点。

下载之前上传的运行时附件以在智能体系统中使用。

#### 请求

- 方法：GET
- URL：`/api/v1/agents/attachments/{attachment_id}/download`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 查询参数：
  - `ext`：`string`（可选）

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/agents/attachments/{attachment_id}/download?ext=pdf' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --output ./downloaded_attachment.pdf
```

##### 请求参数

- `attachment_id`：（*路径参数*），`string`，*必填*
  应下载其文件的附件 ID。
- `ext`：（*查询参数*），`string`，*可选*
  指定响应内容类型的文件扩展名提示。默认为`"markdown"`。可用值：
  - `"markdown"`
  - `"html"`
  - `"pdf"`
  - `"docx"`
  - `"xlsx"`
  - `"csv"`

#### 响应

成功：

将文件内容作为带有相关 Content-Type 标头的二进制流返回。

失败：

```json
{
    "code": 500,
    "message": "Internal server error"
}
```

---

### 创建文件或文件夹

**POST** `/api/v1/files`

在系统中创建新文件或文件夹。

> **注意**：已废弃
`POST /api/v1/file/create` 已弃用。请改用此端点。

#### 请求

- 方法：POST
- URL：`/api/v1/files`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"name"`：`string`
  - `"parent_id"`：`string`（可选）
  - `"type"`：`string`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/files \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "name": "New Folder",
          "type": "folder",
          "parent_id": "{folder_id}"
     }'
```

##### 请求参数

- `"name"`：（*请求体参数*），`string`，*必填*
  要创建的文件或文件夹的名称。
- `"parent_id"`：（*请求体参数*），`string`
  父文件夹 ID。如果未指定，文件/文件夹将在根文件夹中创建。
- `"type"`：（*请求体参数*），`string`
  要创建的文件的类型。可用选项：
  - `"folder"`：创建文件夹
  - `"virtual"`：创建虚拟文件

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "b330ec2e91ec11efbc510242ac120004",
        "name": "New Folder",
        "type": "folder",
        "parent_id": "527fa74891e811ef9c650242ac120006",
        "size": 0,
        "create_time": 1729763127646
    }
}
```

失败：

```json
{
    "code": 409,
    "message": "Duplicated folder name in the same folder."
}
```

---

### 列出文件

**GET** `/api/v1/files?parent_id={parent_id}&keywords={keywords}&page={page}&page_size={page_size}&orderby={orderby}&desc={desc}`

列出特定文件夹下的文件和文件夹。

> **注意**：已废弃
`GET /api/v1/file/list` 已弃用。请改用此端点。

#### 请求

- 方法：GET
- URL：`/api/v1/files?parent_id={parent_id}&keywords={keywords}&page={page}&page_size={page_size}&orderby={orderby}&desc={desc}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files?parent_id={folder_id}&page=1&page_size=15' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `parent_id`：（*过滤器参数*），`string`
  列出其中文件的文件夹 ID。如果未指定，则默认使用根文件夹。
- `keywords`：（*过滤器参数*），`string`
  搜索关键字以按名称过滤文件。
- `page`：（*过滤器参数*），`integer`
  指定将显示文件的页面。默认为`1`。
- `page_size`：（*过滤器参数*），`integer`
  每页上的文件数。默认为 `15`。
- `orderby`：（*过滤参数*），`string`
  文件排序依据的字段。可用选项：
  - `create_time`（默认）
- `desc`：（*过滤器参数*），`boolean`
  指示检索的文件是否应按降序排序。默认为`true`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "total": 10,
        "files": [
            {
                "id": "b330ec2e91ec11efbc510242ac120004",
                "name": "test1.txt",
                "type": "doc",
                "size": 17966,
                "parent_id": "527fa74891e811ef9c650242ac120006",
                "create_time": 1729763127646
            }
        ],
        "parent_folder": {
            "id": "527fa74891e811ef9c650242ac120006",
            "name": "Parent Folder"
        }
    }
}
```

失败：

```json
{
    "code": 404,
    "message": "Folder not found!"
}
```

---

### 获取父文件夹

**GET** `/api/v1/files/{file_id}/parent`

检索指定文件的直接父文件夹信息。

> **注意**：已废弃
`GET /api/v1/file/parent_folder?file_id=...` 已弃用。请改用此端点。

#### 请求

- 方法：GET
- URL：`/api/v1/files/{file_id}/parent`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}/parent' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `file_id`：（*路径参数*），`string`，*必填*
  要检索其直接父文件夹的文件的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "parent_folder": {
            "id": "527fa74891e811ef9c650242ac120006",
            "name": "Parent Folder"
        }
    }
}
```

失败：

```json
{
    "code": 404,
    "message": "Folder not found!"
}
```

---

### 获取所有父文件夹

**GET** `/api/v1/files/{file_id}/ancestors`

检索文件夹层次结构中指定文件的所有父文件夹。

> **注意**：已废弃
`GET /api/v1/file/all_parent_folder?file_id=...` 已弃用。请改用此端点。

#### 请求

- 方法：GET
- URL：`/api/v1/files/{file_id}/ancestors`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/files/{file_id}/ancestors' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `file_id`：（*路径参数*），`string`，*必填*
  要检索其父文件夹的文件的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "parent_folders": [
            {
                "id": "527fa74891e811ef9c650242ac120006",
                "name": "Parent Folder 1"
            },
            {
                "id": "627fa74891e811ef9c650242ac120007",
                "name": "Parent Folder 2"
            }
        ]
    }
}
```

失败：

```json
{
    "code": 404,
    "message": "Folder not found!"
}
```

---

### 删除文件

**DELETE** `/api/v1/files`

删除一个或多个文件或文件夹。

> **注意**：已废弃
`POST /api/v1/file/rm` 已弃用。请改用此端点。

#### 请求

- 方法：DELETE
- URL：`/api/v1/files`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"ids"`：`list[string]`

##### 请求示例

```bash
curl --request DELETE \
     --url http://{address}/api/v1/files \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "ids": ["file_id_1", "file_id_2"]
     }'
```

##### 请求参数

- `"ids"`：（*请求体参数*），`list[string]`，*必填*
  要删除的文件或文件夹的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "success_count": 2
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Partially deleted 1 files with 1 errors",
    "data": {
        "success_count": 1,
        "errors": [
            "No authorization for file file1"
        ]
    }
}
```

---

### 下载文件

**GET** `/api/v1/files/{file_id}`

从系统下载文件。

> **注意**：已废弃
`GET /api/v1/file/get/{file_id}` 已弃用。请改用此端点。

#### 请求

- 方法：GET
- URL：`/api/v1/files/{file_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/files/{file_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --output ./downloaded_file.txt
```

##### 请求参数

- `file_id`：（*路径参数*），`string`，*必填*
  要下载的文件的 ID。

#### 响应

成功：

将文件内容作为带有适当 Content-Type 标头的二进制流返回。

失败：

```json
{
    "code": 404,
    "message": "Document not found!"
}
```

---

### 移动或重命名文件

**POST** `/api/v1/files/move`

移动和/或重命名文件或文件夹。遵循 Linux `mv` 语义：必须至少提供 `dest_file_id` 或 `new_name` 之一。

> **注意**：已废弃
之前的端点 `POST /api/v1/file/mv` 和 `POST /api/v1/file/rename` 已弃用。请改用此端点。

- 仅`dest_file_id`：将文件移动到新文件夹，名称不变。
- 仅`new_name`：就地重命名单个文件或文件夹，无存储操作。
- 两者：同时移动和重命名。

#### 请求

- 方法：POST
- URL：`/api/v1/files/move`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"src_file_ids"`：`list[string]`，*必填*
  - `"dest_file_id"`：`string`，*可选*
  - `"new_name"`：`string`，*可选*

##### 请求示例

将文件移动到文件夹：

```bash
curl --request POST \
     --url http://{address}/api/v1/files/move \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "src_file_ids": ["file_id_1", "file_id_2"],
          "dest_file_id": "{destination_folder_id}"
     }'
```

就地重命名文件：

```bash
curl --request POST \
     --url http://{address}/api/v1/files/move \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "src_file_ids": ["{file_id}"],
          "new_name": "new_name.txt"
     }'
```

##### 请求参数

- `"src_file_ids"`：（*请求体参数*），`list[string]`，*必填*
  要移动或重命名的文件或文件夹的 ID。
- `"dest_file_id"`：（*请求体参数*），`string`，*可选*
  目标文件夹的 ID。省略就地重命名。
- `"new_name"`：（*请求体参数*），`string`，*可选*
  文件或文件夹的新名称。仅当 `src_file_ids` 包含单个条目时有效。注意：*不支持*更改文件扩展名。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 404,
    "message": "File or Folder not found!"
}
```

或

```json
{
    "code": 404,
    "message": "Parent folder not found!"
}
```

或

```json
{
    "code": 400,
    "message": "The extension of file can't be changed"
}
```

---

### 将文件链接到知识库并转换为文档

**POST** `/api/v1/files/link-to-datasets`

将文件转换为文档并将其链接到指定的知识库。

> **注意**：已废弃
`POST /api/v1/file/convert` 已弃用。请改用此端点。

#### 请求

- 方法：POST
- URL：`/api/v1/files/link-to-datasets`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `"file_ids"`：`list[string]`
  - `"kb_ids"`：`list[string]`

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/files/link-to-datasets \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "file_ids": ["file_id_1", "file_id_2"],
          "kb_ids": ["dataset_id_1", "dataset_id_2"]
     }'
```

##### 请求参数

- `"file_ids"`：（*请求体参数*），`list[string]`，*必填*
  要转换的文件的 ID。如果提供了文件夹 ID，则该文件夹中的所有文件都将被转换。
- `"kb_ids"`：（*请求体参数*），`list[string]`，*必填*
  目标知识库的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "id": "file2doc_id_1",
            "file_id": "file_id_1",
            "document_id": "document_id_1"
        }
    ]
}
```

失败：

```json
{
    "code": 404,
    "message": "File not found!"
}
```

或

```json
{
    "code": 404,
    "message": "Can't find this dataset!"
}
```

---

### 创建提交

**POST** `/api/v1/folders/{folder_id}/commits`

为指定文件夹创建新的快照提交。
该端点还支持：
- `/api/v1/workspace/{workspace_id}/commits`（别名，workspace_id ==folder_id）
- `/api/v1/datasets/{dataset_id}/commits`（将知识库解析到其文件夹）

#### 请求

- 方法：POST
- URL：`/api/v1/folders/{folder_id}/commits`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：
  - `'message'`：`string`（必填）
    提交消息。
  - `'files'`：`list[object]`（必填）
    文件更改列表。每个文件更改都是一个具有以下字段的对象：

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/folders/{folder_id}/commits \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --data '{
          "message": "update config files",
          "files": [
               {"file_id": "file_uuid", "file_name": "config.json", "operation": "modify", "content": "{\"key\": \"value\"}"},
               {"file_id": "file_uuid", "file_name": "readme.md", "operation": "add", "content": "# New README"}
          ]
     }'
```

##### 请求参数

- `"message"`：（*请求体参数*），`string`，*必填*
  描述更改的提交消息。
- `"files"`：（*请求体参数*），`list[object]`，*必填*
  每个文件更改对象都支持以下字段：

  |领域|类型 |必填 |描述 |
  |-------|------|----------|-------------|
  | `file_id`| `string`|是的 |文件 ID |
  | `file_name`| `string` |仅用于添加/重命名 |文件名 |
  | `operation`| `string` |是的 | `"add"`、`"modify"`、`"delete"`或`"rename"`|
  | `content` | `string` |仅用于添加/修改 |文件内容|
  | `old_name` | `string`|仅用于重命名 |旧文件名 |
  | `new_name` | `string`|仅用于重命名 |新文件名 |

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "commit_uuid",
        "folder_id": "folder_uuid",
        "parent_id": null,
        "message": "update config files",
        "author_id": "user_uuid",
        "file_count": 2,
        "tree_state": "{\"file_uuid\": {\"hash\": \"abcd1234\", \"location\": \".objects/abcd1234\", \"name\": \"config.json\", \"size\": 1024, \"status\": \"1\", \"parent_id\": \"folder_uuid\"}}",
        "create_time": 1718200000000
    }
}
```

> **说明**
`tree_state` 是一个包含文件条目平面映射的 JSON 字符串。每个条目都包含 `parent_id`，用于跟踪文件在提交时属于哪个子文件夹。子文件夹是从 `parent_id` 值推断出来的。

失败：

```json
{
    "code": 101,
    "message": "required argument are missing: message"
}
```

---

### 列出提交

**GET** `/api/v1/folders/{folder_id}/commits`

列出指定文件夹的所有提交，并分页。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits`
- `/api/v1/datasets/{dataset_id}/commits`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 查询：
  - `'page'`：`int`（可选，默认：1）
  - `'page_size'`：`int`（可选，默认：15）
  - `'order_by'`：`string`（可选，默认：`"create_time"`）
  - `'desc'`：`bool`（可选，默认：`true`）

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits?page=1&page_size=15' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `"page"`：（*查询参数*），`int`，*可选*
  页码。默认为 1。
- `"page_size"`：（*查询参数*），`int`，*可选*
  每页的项目数。默认为 15。
- `"order_by"`：（*查询参数*），`string`，*可选*
  排序字段。默认为`"create_time"`。
- `"desc"`：（*查询参数*），`bool`，*可选*
  降序排序。默认为`true`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "total": 2,
        "page": 1,
        "page_size": 15,
        "commits": [
            {
                "id": "commit_uuid",
                "folder_id": "folder_uuid",
                "parent_id": null,
                "message": "first commit",
                "author_id": "user_uuid",
                "file_count": 3,
                "create_time": 1718200000000
            }
        ]
    }
}
```

---

### 获取提交

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}`

检索特定提交的详细信息，包括其文件更改。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits/{commit_id}`
- `/api/v1/datasets/{dataset_id}/commits/{commit_id}`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits/{commit_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/folders/{folder_id}/commits/{commit_id} \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `"folder_id"`：（*路径参数*），`string`，*必填*
  文件夹 ID。
- `"commit_id"`：（*路径参数*），`string`，*必填*
  提交 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "commit_uuid",
        "folder_id": "folder_uuid",
        "parent_id": null,
        "message": "added config files",
        "author_id": "user_uuid",
        "file_count": 2,
        "create_time": 1718200000000,
        "files": [
            {
                "file_id": "file_uuid",
                "operation": "add",
                "old_hash": null,
                "new_hash": "abcd1234",
                "old_name": null,
                "new_name": null
            }
        ]
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Commit not found in workspace"
}
```

---

### 列出提交文件

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/files`

列出与特定提交关联的文件更改。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits/{commit_id}/files`
- `/api/v1/datasets/{dataset_id}/commits/{commit_id}/files`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits/{commit_id}/files`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/files \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "id": "item_uuid",
            "file_id": "file_uuid",
            "operation": "add",
            "old_hash": null,
            "new_hash": "abcd1234",
            "old_location": null,
            "new_location": ".objects/abcd1234",
            "old_name": null,
            "new_name": null
        }
    ]
}
```

---

### 比较提交差异

**GET** `/api/v1/folders/{folder_id}/commits/diff?from={commit_id}&to={commit_id}`

比较两个提交并返回差异。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits/diff?from=...&to=...`
- `/api/v1/datasets/{dataset_id}/commits/diff?from=...&to=...`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits/diff`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 查询：
  - `'from'`：`string`（必填）
    源提交 ID。
  - `'to'`：`string`（必填）
    目标提交 ID。

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/folders/{folder_id}/commits/diff?from=from_commit_id&to=to_commit_id' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `"from"`：（*查询参数*），`string`，*必填*
  源提交 ID。
- `"to"`：（*查询参数*），`string`，*必填*
  目标提交 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "file_id": "file_uuid",
            "file_name": "config.json",
            "operation": "modify",
            "old_hash": "abc123",
            "new_hash": "def456",
            "old_location": ".objects/abc123",
            "new_location": ".objects/def456"
        }
    ]
}
```

失败：

```json
{
    "code": 102,
    "message": "Commit not found in workspace"
}
```

---

### 获取未提交的更改

**GET** `/api/v1/folders/{folder_id}/changes`

返回指定文件夹的未提交更改（类似于`git status`）。
也可以在：
- `/api/v1/workspace/{workspace_id}/changes`
- `/api/v1/datasets/{dataset_id}/changes`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/changes`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/folders/{folder_id}/changes \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "file_id": "file_uuid",
            "file_name": "new.txt",
            "operation": "add"
        },
        {
            "file_id": "file_uuid",
            "file_name": "config.json",
            "operation": "modify"
        },
        {
            "file_id": "file_uuid",
            "file_name": "old.md",
            "operation": "delete"
        }
    ]
}
```

---

### 获取提交树

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/tree`

检索特定提交时存在的完整文件夹树快照。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits/{commit_id}/tree`
- `/api/v1/datasets/{dataset_id}/commits/{commit_id}/tree`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits/{commit_id}/tree`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/tree \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "folder_uuid",
        "name": "workspace_name",
        "type": "folder",
        "children": [
            {
                "id": "file_uuid",
                "name": "config.json",
                "type": "file",
                "hash": "abcd1234",
                "size": 1024,
                "status": "1",
                "location": ".objects/abcd1234"
            },
            {
                "id": "sub_folder_uuid",
                "name": "sub_folder_name",
                "type": "folder",
                "children": [
                    {
                        "id": "file_uuid_2",
                        "name": "nested.txt",
                        "type": "file",
                        "hash": "ef5678",
                        "size": 512,
                        "status": "1",
                        "location": ".objects/ef5678"
                    }
                ]
            }
        ]
    }
}
```

---

### 获取提交文件内容

**GET** `/api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content`

检索特定提交时存在的文件内容。
也可以在：
- `/api/v1/workspace/{workspace_id}/commits/{commit_id}/files/{file_id}/content`
- `/api/v1/datasets/{dataset_id}/commits/{commit_id}/files/{file_id}/content`

#### 请求

- 方法：GET
- URL：`/api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/folders/{folder_id}/commits/{commit_id}/files/{file_id}/content \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "content": "file content as it existed in that commit"
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "File not found in this commit"
}
```

---

### 获取文件版本历史记录

**GET** `/api/v1/files/{file_id}/versions`

返回所有提交中特定文件的版本历史记录。

#### 请求

- 方法：GET
- URL：`/api/v1/files/{file_id}/versions`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url http://{address}/api/v1/files/{file_id}/versions \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

#### 响应

成功：

```json
{
    "code": 0,
    "data": [
        {
            "commit_id": "commit_uuid",
            "operation": "modify",
            "hash": "def456",
            "create_time": 1718200000000,
            "message": "updated file"
        },
        {
            "commit_id": "commit_uuid",
            "operation": "add",
            "hash": "abc123",
            "create_time": 1718100000000,
            "message": "initial commit"
        }
    ]
}
```

---

## 搜索应用管理

### 创建搜索应用

**POST** `/api/v1/searches`

创建一个搜索应用。

#### 请求

- 方法：POST
- URL：`/api/v1/searches`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：

```json
{
    "name": "my_search_app",
    "description": "optional description"
}
```

##### 请求示例

```bash
curl --request POST \
     --url 'http://{address}/api/v1/searches' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --header 'Content-Type: application/json' \
     --data '{
         "name": "my_search_app",
         "description": "My first search app"
     }'
```

##### 请求参数

- `"name"`：（*请求体参数*），`string`，*必填*
  搜索应用的名称。必须是唯一的且不超过 255 个字符。
- `"description"`：（*请求体参数*），`string`
  搜索应用的简要说明。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "search_id": "b330ec2e91ec11efbc510242ac120006"
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Search name can't be empty."
}
```

---

### 列出搜索应用

**GET** `/api/v1/searches?keywords={keywords}&page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&owner_ids={owner_ids}`

列出当前用户的搜索应用。

#### 请求

- 方法：GET
- URL：`/api/v1/searches`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/searches?page=1&page_size=20' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `keywords`：（*过滤器参数*），`string`
  搜索关键字以按名称过滤搜索应用。
- `page`：（*过滤器参数*），`integer`
  指定页码。默认为 `0`（无分页）。
- `page_size`：（*过滤器参数*），`integer`
  每页的项目数。默认为 `0`（无分页）。
- `orderby`：（*过滤器参数*），`string`
  排序依据的字段。默认为 `create_time`。
- `desc`：（*过滤器参数*），`boolean`
  是否按降序排序。默认为`true`。
- `owner_ids`：（*过滤器参数*），`string`（可重复）
  按所有者租户 ID 过滤。可以指定多次：`?owner_ids=id1&owner_ids=id2`。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "total": 2,
        "search_apps": [
            {
                "id": "b330ec2e91ec11efbc510242ac120006",
                "name": "my_search_app",
                "description": "My first search app",
                "tenant_id": "7c8983badede11f083f184ba59bc53c7",
                "create_time": 1729763127646
            }
        ]
    }
}
```

---

### 获取搜索应用

**GET** `/api/v1/searches/{search_id}`

获取搜索应用的详细信息。

#### 请求

- 方法：GET
- URL：`/api/v1/searches/{search_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request GET \
     --url 'http://{address}/api/v1/searches/b330ec2e91ec11efbc510242ac120006' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `search_id`：（*路径参数*），`string`，*必填*
  要检索的搜索应用的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "b330ec2e91ec11efbc510242ac120006",
        "name": "my_search_app",
        "description": "My first search app",
        "tenant_id": "7c8983badede11f083f184ba59bc53c7",
        "search_config": {},
        "create_time": 1729763127646
    }
}
```

失败：

```json
{
    "code": 102,
    "message": "Can't find this Search App!"
}
```

---

### 更新搜索应用

**PUT** `/api/v1/searches/{search_id}`

更新搜索应用。

#### 请求

- 方法：PUT
- URL：`/api/v1/searches/{search_id}`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_API_KEY>'`
- 请求体：

```json
{
    "name": "updated_name",
    "search_config": {"top_k": 5}
}
```

##### 请求示例

```bash
curl --request PUT \
     --url 'http://{address}/api/v1/searches/b330ec2e91ec11efbc510242ac120006' \
     --header 'Authorization: Bearer <YOUR_API_KEY>' \
     --header 'Content-Type: application/json' \
     --data '{
         "name": "updated_name",
         "search_config": {"top_k": 5}
     }'
```

##### 请求参数

- `search_id`：（*路径参数*），`string`，*必填*
  要更新的搜索应用的 ID。
- `"name"`：（*请求体参数*），`string`，*必填*
  搜索应用的新名称。
- `"search_config"`：（*请求体参数*），`object`，*必填*
  要更新的配置字段。与现有配置合并。

#### 响应

成功：

```json
{
    "code": 0,
    "data": {
        "id": "b330ec2e91ec11efbc510242ac120006",
        "name": "updated_name",
        "search_config": {"top_k": 5},
        "create_time": 1729763127646
    }
}
```

失败：

```json
{
    "code": 109,
    "message": "No authorization."
}
```

---

### 删除搜索应用

**DELETE** `/api/v1/searches/{search_id}`

删除搜索应用。

#### 请求

- 方法：DELETE
- URL：`/api/v1/searches/{search_id}`
- 请求头：
  - `'Authorization: Bearer <YOUR_API_KEY>'`

##### 请求示例

```bash
curl --request DELETE \
     --url 'http://{address}/api/v1/searches/b330ec2e91ec11efbc510242ac120006' \
     --header 'Authorization: Bearer <YOUR_API_KEY>'
```

##### 请求参数

- `search_id`：（*路径参数*），`string`，*必填*
  要删除的搜索应用的 ID。

#### 响应

成功：

```json
{
    "code": 0,
    "data": true
}
```

失败：

```json
{
    "code": 109,
    "message": "No authorization."
}
```

---

### 搜索完成

**POST** `/api/v1/searches/{search_id}/completions`

使用保存的搜索应用配置生成答案，并将结果作为服务器发送的事件流返回。

#### 请求

- 方法：POST
- URL：`/api/v1/searches/{search_id}/completions`
- 请求头：
  - `'Content-Type: application/json'`
  - `'Authorization: Bearer <YOUR_LOGIN_TOKEN>'`
- 请求体：
  - `"question"`：`string`*（必需）*用户问题。
  - `"kb_ids"`：`list[string]`*（可选）*备用知识库ID。仅当搜索应用配置尚未定义 `kb_ids` 时使用。

##### 请求示例

```bash
curl --request POST \
     --url http://{address}/api/v1/searches/{search_id}/completions \
     --header 'Content-Type: application/json' \
     --header 'Authorization: Bearer <YOUR_LOGIN_TOKEN>' \
     --data '{
         "question": "What is retrieval-augmented generation?"
     }'
```

##### 请求参数

- `search_id`：（*路径参数*），`string`，*必填*
  搜索应用的 ID。
- `"question"`：（*请求体参数*），`string`，*必填*
  用户的问题。
- `"kb_ids"`：（*请求体参数*），`list[string]`
  当搜索应用配置未定义可选后备知识库 ID 时。

#### 响应

成功（流媒体）：

```text
data: {"code": 0, "message": "", "data": {"answer": "...", "reference": {...}}}

data: {"code": 0, "message": "", "data": true}
```

失败：

```json
{
    "code": 109,
    "message": "No authorization."
}
```
