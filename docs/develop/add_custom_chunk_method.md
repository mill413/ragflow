# 新增内置分块方法

本文说明如何在保留现有“扩展示例分块”的前提下，新增一个独立的内置分块方法，并接入任务执行、API 校验、前端配置和工作空间可见性控制。

下文使用 `custom_pdf` 作为示例 `parser_id`。实际开发时可以替换为需要的名称，但应满足以下约束：

- 使用小写字母、数字和下划线。
- 长度不超过 32 个字符。
- 不要与已有的 `ParserType` 值重复。
- 写入知识库和文档记录后不要随意修改。

完整调用链如下：

```text
前端选择 custom_pdf
  → API 校验方法和工作空间权限
  → 知识库或文档保存 parser_id
  → 任务执行器取得对应 Python 模块
  → 调用 custom_pdf.chunk(...)
  → 返回标准分块数据
  → 向量化并写入检索引擎
```

## 一、新建分块实现

在 `rag/app/` 下新建一个与 `parser_id` 同名的模块：

```text
rag/app/custom_pdf.py
```

模块的核心是统一签名的 `chunk()` 函数：

```python
from common.constants import MAXIMUM_PAGE_NUMBER


def chunk(
    filename,
    binary=None,
    from_page=0,
    to_page=MAXIMUM_PAGE_NUMBER,
    lang="Chinese",
    callback=None,
    **kwargs,
):
    parser_config = kwargs.get("parser_config") or {}

    # 1. 根据文件类型和 parser_config 解析文件。
    # 2. 对解析结果执行新的分块算法。
    # 3. 转换为 RAGFlow 标准分块字典并返回。
    chunks = []
    return chunks
```

任务执行器会传入：

- `filename`：原始文件名。
- `binary`：文件二进制内容。
- `from_page`、`to_page`：本次任务处理的页码范围。
- `lang`：知识库配置的文档语言。
- `callback(progress, message)`：解析进度回调。
- `kwargs["parser_config"]`：知识库或文档解析配置。
- `kwargs["tenant_id"]`：资源所属工作空间 ID。
- `kwargs["kb_id"]`：资源所属知识库 ID。

`chunk()` 必须返回 `list[dict]`，不能只返回纯文本列表。建议使用现有的 `tokenize_chunks()`、`tokenize_table()`、`tokenize()` 等方法生成索引需要的字段。

具体实现应参考最接近目标场景的现有方法：

- `rag/app/naive.py`：多种文件格式和完整的通用解析流程。
- `rag/app/paper.py`：仅处理 PDF，并根据论文结构分块。
- `rag/app/book.py`：处理 PDF、Word 和文本，并按书籍结构分块。
- `rag/app/manual.py`：处理 PDF 和文档目录结构。
- `rag/app/one.py`：将一个文件合并为单个文本块。
- `rag/app/example_chunk.py`：扩展方法的函数签名、返回格式和可见性参考。

## 二、注册分块类型

在 `common/constants.py` 的 `ParserType` 中增加：

```python
class ParserType(StrEnum):
    EXAMPLE_CHUNK = "example_chunk"
    CUSTOM_PDF = "custom_pdf"
```

后续所有位置都应使用同一个 `parser_id`。

## 三、注册任务执行器

当前仓库存在两条任务执行路径，两处都要在现有代码上追加新模块。下面的代码只表示需要新增的内容，不能替换文件中原有的导入和注册表。

在 `rag/svr/task_executor.py` 已有的 `from rag.app import ...` 导入列表中增加 `custom_pdf`：

```python
from rag.app import (
    # ...保留已有模块
    custom_pdf,
)
```

然后在同一文件已有的 `FACTORY` 字典中追加一个映射，保留其他所有映射：

```python
FACTORY = {
    # ...保留已有映射
    ParserType.CUSTOM_PDF.value: custom_pdf,
}
```

在 `rag/svr/task_executor_refactor/chunk_builder.py` 的 `get_parser()` 中进行相同的增量修改：

```python
def get_parser(parser_id: str):
    from rag.app import (
        # ...保留已有模块
        custom_pdf,
    )

    factory = {
        # ...保留已有映射
        ParserType.CUSTOM_PDF.value: custom_pdf,
    }

    return factory[parser_id.lower()]
```

这里的 `# ...保留已有内容` 只是文档中的省略标记，不要复制到代码中。实际修改只包括：

1. 在已有导入列表中增加 `custom_pdf`。
2. 在已有 `FACTORY` 或 `factory` 字典中增加 `ParserType.CUSTOM_PDF.value: custom_pdf`。

缺少其中任意一条执行路径，都可能出现知识库可以保存新方法，但解析任务找不到实现的问题。

## 四、增加解析配置

在 `api/utils/api_utils.py` 的 `get_parser_config()` 中增加新方法的默认配置：

```python
"custom_pdf": {
    "layout_recognize": "DeepDOC",
    "raptor": {"use_raptor": False},
    "graphrag": {"use_graphrag": False},
},
```

这些默认值会在创建知识库和切换分块方法时使用。算法内部的回退值应与这里保持一致。

### 新方法需要专有参数时

如果算法只使用 `layout_recognize`、`chunk_token_num`、`delimiter` 等已有字段，直接从 `parser_config` 读取即可：

```python
chunk_token_num = parser_config.get("chunk_token_num", 512)
delimiter = parser_config.get("delimiter", "\n")
```

如果算法需要其他方法没有的参数，建议放在 `parser_config.ext.custom_pdf` 中：

```json
{
  "layout_recognize": "DeepDOC",
  "ext": {
    "custom_pdf": {
      "max_chunk_length": 1000,
      "merge_short_text": true
    }
  }
}
```

在 `custom_pdf.chunk()` 中读取：

```python
parser_config = kwargs.get("parser_config") or {}
ext_config = parser_config.get("ext") or {}
custom_config = ext_config.get("custom_pdf") or {}

max_chunk_length = custom_config.get("max_chunk_length", 1000)
merge_short_text = custom_config.get("merge_short_text", True)
```

这表示依次取得：

```text
parser_config
└── ext
    └── custom_pdf
        ├── max_chunk_length
        └── merge_short_text
```

如果算法没有专有参数，则不需要读取 `parser_config.ext`。

## 五、加入 API 允许列表

当前 API 使用硬编码集合校验分块方法，需要在 `api/utils/validation_utils.py` 修改两处。

### 修改文档分块方法

在 `UpdateDocumentReq.validate_document_chunk_method()` 的 `valid_chunk_method` 中加入：

```python
"custom_pdf",
```

缺少该项时，修改单个文档的分块方法会提示方法不存在。

### 创建或修改知识库

在 `CreateDatasetReq.validate_chunk_method()` 的 `allowed` 中加入：

```python
"custom_pdf",
```

缺少该项时，创建或修改知识库会提示不是受支持的内置分块方法。

同时更新 `api/apps/restful_apis/dataset_api.py` 中创建和修改知识库接口的 `chunk_method` 文档枚举。该枚举不参与运行时校验，但需要保证 API 文档准确。

## 六、加入工作空间可见性控制

在 `api/db/services/workspace_parser_service.py` 中注册：

```python
class WorkspaceParserService:
    EXTENDED_PARSERS = {
        ParserType.EXAMPLE_CHUNK.value: "Extension Example Chunking",
        ParserType.CUSTOM_PDF.value: "Custom PDF Chunking",
    }
```

不要将扩展方法加入默认的 `settings.PARSERS`，否则所有新工作空间都会默认看到它。

`EXTENDED_PARSERS` 中的名称是后端接口和前端翻译缺失时使用的备用名称，不强制使用英文。推荐保留英文备用名称，再通过前端 i18n 分别显示中英文。

扩展方法启用后会写入工作空间现有的 `tenant.parser_ids` 字段，不需要修改数据库表结构。

## 七、注册前端

### 增加方法类型

在 `web/src/constants/knowledge.ts` 中增加：

```typescript
export enum DocumentParserType {
  ExampleChunk = 'example_chunk',
  CustomPdf = 'custom_pdf',
}
```

### 增加中英文名称

在 `web/src/locales/zh.ts` 中增加：

```typescript
parserLabel: {
  custom_pdf: '自定义 PDF 分块',
}
```

在 `web/src/locales/en.ts` 中增加：

```typescript
parserLabel: {
  custom_pdf: 'Custom PDF Chunking',
}
```

前端优先显示 i18n 翻译，翻译不存在时才使用 `EXTENDED_PARSERS` 返回的备用名称。

### 声明支持的文件类型

在 `web/src/components/chunk-method-dialog/hooks.ts` 的 PDF 方法列表中加入：

```typescript
"custom_pdf",
```

如果方法只支持 PDF，还需要在 `web/src/pages/dataset/dataset-setting/configuration/common-item.tsx` 对其他文件类型隐藏它。建议统一维护仅支持 PDF 的方法集合：

```typescript
const PdfOnlyChunkMethods = new Set([
  "example_chunk",
  "custom_pdf",
]);
```

### 注册配置界面

如果新方法只使用已有配置字段，可以复用最接近的配置组件。在 `web/src/pages/dataset/dataset-setting/chunk-method-form.tsx` 中增加映射：

```typescript
const ConfigurationComponentMap = {
  [DocumentParserType.CustomPdf]: ExampleChunkConfiguration,
};
```

如果新方法有独立参数，则新建：

```text
web/src/pages/dataset/dataset-setting/configuration/custom-pdf.tsx
```

并将专有表单参数保存到：

```text
parser_config.ext.custom_pdf
```

## 八、启用或禁用

扩展方法默认不对任何工作空间开放。管理员可以在管理后台的用户详情或团队详情中启用，也可以调用现有接口：

```http
PATCH /api/v1/admin/workspaces/<workspace_id>/chunk-methods/custom_pdf
Content-Type: application/json

{
  "enabled": true
}
```

- 个人工作空间 ID 与用户 ID 相同。
- 团队工作空间使用团队 ID。
- `enabled: true` 表示启用。
- `enabled: false` 表示禁用。
- 配置立即生效，不需要重启服务。

禁用后前端不再展示该方法，后端也会拒绝创建、修改或重新解析使用该方法的资源。

## 九、验证

至少增加并执行以下测试：

```bash
uv run pytest test/unit_test/rag/app/test_custom_pdf.py
uv run pytest test/unit_test/api/db/services/test_workspace_parser_service.py
uv run pytest test/unit_test/rag/svr/task_executor_refactor/test_chunk_builder.py
```

使用真实文件验证：

1. 为测试工作空间启用 `custom_pdf`。
2. 创建知识库并选择新方法。
3. 上传该方法支持的真实文件并启动解析。
4. 检查分块文本、页码、表格和检索结果。
5. 重新解析同一文件，确认结果稳定。
6. 禁用该方法，确认前端不再显示且后端拒绝绕过前端提交。

提交前确认：

- 两个任务执行器都已注册。
- 两个 API 允许列表都已更新。
- 默认配置与算法回退值一致。
- 前端只在支持的文件类型中显示。
- 未授权工作空间无法使用。
- `chunk()` 返回标准分块字典。
