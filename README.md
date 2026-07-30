# RAGFlow 二次开发版

本项目基于 [RAGFlow](https://github.com/infiniflow/ragflow) `0.26.4` 进行二次开发，面向私有化部署、团队知识协作和统一运维场景。项目保留 RAGFlow 的知识库、检索、聊天、智能体与文档解析能力，并重点改造了工作空间权限、管理后台、资源配额、模型管理、中文界面及 Docker 部署流程。

> 本仓库是基于 RAGFlow 的二次开发版本。升级上游版本前，需要先评估团队权限、资源归属、管理后台和部署配置的冲突。

[English upstream reference](./README_en.md)

## 主要改造

### 多工作空间与团队权限

- 团队是独立工作空间，用户可以加入多个团队。
- 资源分为个人资源和团队共享资源，并在卡片、详情和筛选器中显示所属工作空间。
- 知识库、聊天、搜索、智能体、记忆、文件、数据源、MCP、知识编译模板及 DataFlow 按工作空间隔离。
- 团队成员、团队管理员和超级管理员按照资源类型获得对应的读写权限。
- 超级管理员可以在主站查看和管理所有个人、团队及其资源。
- 登录令牌支持同一账号在多台设备同时登录，主站与管理后台登录状态相互隔离。

### 管理后台

管理后台位于主站的 `/admin` 路径，提供以下能力：

- 总览：用户、团队、知识库、聊天、搜索、智能体、记忆、文件、存储和处理状态统计。
- 用户管理：用户详情、部门归属、状态、角色、个人资源和模型配置。
- 团队管理：团队及成员增删改查、团队角色和团队资源详情。
- 部门管理：树形部门结构及部门人数统计。
- 资源管理：知识库、聊天、搜索、智能体、记忆和文件的统一监管与详情查看。
- 模型管理：管理共享模型和用户私有模型，并控制共享模型可见范围。
- 配额管理：分别配置个人、团队和知识库的文件数量及存储上限。
- 运行状态：查看服务状态、资源总量和各工作空间存储分布。

### 主站体验

- 默认使用中文，并仅保留中文和英文界面资源。
- 内置首次登录引导，介绍工作空间切换、帮助文档和个人设置。
- 内置 Markdown 帮助中心，不再跳转外部官网。
- 中文时间统一使用 `YYYY/MM/DD HH:mm:ss`，部署默认采用上海时区。
- 只读资源的保存操作会被禁用，并显示权限提示。
- 首页显示当前可见工作空间的配额使用情况。

### 模型与数据源

- 管理员可以配置全局共享模型，用户仍可配置自己的私有模型。
- 模型配置支持 MinerU、OpenAI-API-Compatible 和 Xinference 等私有化部署常用提供商。
- OpenAI 兼容模型和 MinerU 提供独立的连通性验证与超时提示。
- 数据源界面保留 S3、IMAP、MySQL 和 PostgreSQL。

### 扩展分块方法

- 扩展的内置分块方法可以按个人或团队工作空间启用，默认不开放。
- 管理员可以在管理后台的用户详情或团队详情中配置扩展分块方法的可见性。
- 前端隐藏未授权方法，后端同时校验知识库创建、配置修改和文件重新解析请求。
- 项目提供“扩展示例分块”作为函数签名、标准返回结构、PDF 解析器复用和可见性控制的参考实现。

新增独立分块方法时，需要同时注册 Python 实现、任务执行器、API 校验、前端配置和工作空间可见性。完整步骤参见 [新增内置分块方法](./docs/develop/add_custom_chunk_method.md)。

### 部署流程

- 仅保留 Elasticsearch 作为检索引擎。
- 提供本地热更新和测试环境两套 Compose 配置。
- 本地环境使用固定资源限制，防止开发构建耗尽宿主机内存。
- Kibana 和 Sandbox 作为可选 Compose profile，默认不启动。
- 统一使用 `docker/manage.sh` 构建、部署、停止、查看日志、导入和导出镜像。
- 推送 `release` 分支时，由 GitHub Actions 构建并发布镜像。

## 目录结构

| 目录                | 说明                                       |
| ------------------- | ------------------------------------------ |
| `api/`              | Python API、权限校验、业务服务和数据库访问 |
| `rag/`              | 检索、模型调用、文档处理和 RAG 核心逻辑    |
| `agent/`            | 智能体组件、工具和工作流运行逻辑           |
| `admin/`            | 管理后台服务端及管理命令行代码             |
| `web/`              | React、TypeScript 和 Vite 前端             |
| `docker/`           | Compose、镜像管理脚本和运行配置            |
| `test/`             | 自动化测试                                 |

## 分支约定

- `release`：发布分支，只接收已经验证的版本；推送后会触发镜像构建工作流。
- `dev`：日常集成分支。
- 功能分支：从 `dev` 创建，完成后合并回 `dev`。
- `main`：保留上游历史，不作为本项目的开发或发布入口。

所有远程推送操作均由仓库维护者本人执行。

## 快速部署

### 环境要求

- Linux x86_64
- Docker Engine
- Docker Compose v2
- Git
- 建议预留足够的磁盘空间用于 Elasticsearch、MySQL、MinIO 和模型镜像

首次部署前，复制环境变量模板并检查其中的密码、端口、时区和服务配置。生产环境不要继续使用示例密码。

```bash
cp docker/.env.example docker/.env
```

### 构建镜像

先构建包含系统工具链、Python、Node.js、Nginx、Chrome 和解析资源的构建基础镜像：

```bash
docker/manage.sh build-base
```

再基于该镜像安装项目依赖、构建前端并组装最终镜像：

```bash
docker/manage.sh build
```

默认镜像标签格式为：

```text
ragflow-build-base:<RAGFlow版本>
ragflow-local:<RAGFlow版本>.<9位Git提交哈希>
```

可以通过 `RAGFLOW_BUILD_BASE_IMAGE` 和 `RAGFLOW_IMAGE` 指定其他镜像名称。联网环境可以将构建基础镜像发布到 GHCR；内部环境只需拉取该基础镜像，并通过 `UBUNTU_MIRROR`、`PYPI_INDEX_URL` 和 `NPM_REGISTRY` 配置内部软件源后构建最终镜像。

### 部署测试环境

测试环境使用已构建镜像，不挂载源码，也不启用热更新：

```bash
docker/manage.sh deploy test
```

默认访问地址：

- 主站：`http://127.0.0.1/`
- 管理后台：`http://127.0.0.1/admin`
- API 服务：`http://127.0.0.1:9380`
- 管理 API：`http://127.0.0.1:9381`

端口可以在 `docker/.env` 中调整。

### 部署本地热更新环境

```bash
docker/manage.sh deploy local
```

本地环境挂载后端源码并启动 Vite，RAGFlow 与依赖服务的资源限制直接写在 [`docker/docker-compose.local.yml`](./docker/docker-compose.local.yml) 中。

默认访问地址：

- 主站：`http://127.0.0.1:18082/`
- 管理后台：`http://127.0.0.1:18082/admin`
- API 服务：`http://127.0.0.1:19380`
- 管理 API：`http://127.0.0.1:19381`

### 启用可选组件

```bash
# 启用 Kibana
docker/manage.sh deploy test --kibana

# 启用 Sandbox
docker/manage.sh deploy test --sandbox

# 同时启用
docker/manage.sh deploy test --kibana --sandbox
```

### 常用管理命令

```bash
# 查看容器状态
docker/manage.sh status test

# 查看全部日志
docker/manage.sh logs test

# 查看指定服务日志
docker/manage.sh logs test ragflow

# 重建环境但保留数据卷
docker/manage.sh restart test

# 停止环境并保留数据卷
docker/manage.sh stop test

# 停止环境并删除数据卷
docker/manage.sh stop test --volumes

# 检查最终 Compose 配置
docker/manage.sh config test
```

`--volumes` 会删除 MySQL、Elasticsearch、MinIO 和 Redis 等持久化数据，执行前必须确认数据可以丢弃或已经备份。

### 镜像导入与导出

```bash
# 导出当前 RAGFlow 镜像
docker/manage.sh export ragflow-image.tar.gz

# 在离线环境导入
docker/manage.sh import docker/dist/ragflow-image.tar.gz
```

导出文件统一保存在 `docker/dist/`，且只包含 RAGFlow 镜像。MySQL、Elasticsearch、MinIO、Redis、Kibana 和 Sandbox 镜像需要在目标环境单独准备。

## 开发

### 后端

```bash
uv sync --python 3.13 --all-extras
uv run python3 ragflow_deps/download_deps.py
export PYTHONPATH=$(pwd)
bash docker/launch_backend_service.sh
```

常用检查：

```bash
uv run pytest <测试路径>
ruff check <修改文件>
ruff format <修改文件>
```

### 前端

```bash
cd web
npm install
npm run dev
```

常用检查：

```bash
npm run lint
npm run type-check
npm run build
```

## 内置帮助文档维护

帮助中心由以下 Markdown 文件生成：

- 中文：[`web/src/pages/help/content/zh.md`](./web/src/pages/help/content/zh.md)
- 英文：[`web/src/pages/help/content/en.md`](./web/src/pages/help/content/en.md)
- 渲染器：[`web/src/pages/help/index.tsx`](./web/src/pages/help/index.tsx)
- 截图：[`web/public/help/`](./web/public/help/)

一般内容更新只需要修改中英文 Markdown，不需要修改 React 代码。

### 标题与左侧目录

每个二级标题都应设置稳定且唯一的锚点：

```markdown
## 工作空间 {#workspace}
```

渲染器会移除页面上显示的 `{#workspace}`，根据二级标题自动生成左侧目录，并在滚动时高亮当前章节。锚点建议只使用小写字母、数字和连字符。

### 添加截图

截图统一存放在 `web/public/help/`：

```markdown
![工作空间切换示例](/help/workspace-selector.webp)
```

图片替代文本会同时作为图片说明显示。截图应优先使用 WebP，并确保不包含密码、API Key、Token 或其他敏感数据。

### 流程图扩展

使用 `help-flow` 代码块生成响应式操作流程，每行格式为 `图标 | 标题 | 说明`：

````markdown
```help-flow
workspace | 选择空间 | 确定资源归属
model | 配置模型 | 准备所需模型
knowledge | 导入知识 | 上传并解析文件
application | 创建应用 | 绑定知识库
use | 开始使用 | 发起问答
```
````

支持的图标名称为 `workspace`、`model`、`knowledge`、`application` 和 `use`。

### 应用卡片扩展

使用 `help-apps` 代码块生成应用入口卡片，每行格式为 `图标 | 标题 | 说明 | 站内路由`：

````markdown
```help-apps
chat | 聊天 | 多轮知识问答 | /chats
search | 搜索 | 检索知识内容 | /searches
agent | 智能体 | 编排复杂流程 | /agents
memory | 记忆 | 保存长期信息 | /memories
```
````

支持的图标名称为 `chat`、`search`、`agent` 和 `memory`。

### 其他 Markdown 能力

- GFM 表格会显示为可横向滚动的表格。
- 引用块会渲染为醒目的提示信息。
- 以 `/` 开头的站内链接使用前端路由跳转。
- 支持普通图片、链接、粗体、行内代码、有序列表和无序列表。

## 发布

将验证完成的 `dev` 合并到 `release` 后，由维护者推送远程分支：

```bash
git switch release
git merge --no-ff dev
git push origin release
```

推送 `release` 会触发 [镜像构建工作流](./.github/workflows/release-image.yml)，构建镜像并发布到 GitHub Container Registry。推送前应至少完成相关单元测试、前端构建和 Compose 配置检查。

## 上游项目与许可证

本项目基于开源 RAGFlow 开发，原始项目及其版权归相应作者所有：

- 上游仓库：<https://github.com/infiniflow/ragflow>
- 上游文档：<https://ragflow.io/docs/>
- 许可证：[`LICENSE`](./LICENSE)

二次开发代码继续遵循仓库中的 Apache License 2.0 许可证要求。
