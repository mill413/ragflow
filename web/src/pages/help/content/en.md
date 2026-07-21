# RAGFlow basics

Start with workspaces and models, then build a knowledge base, validate retrieval, and create an AI application. This guide describes the current secondary-development edition.

[Create a dataset](/datasets) · [Configure models](/user-setting/model)

![The RAGFlow home page shows visible workspace quotas, datasets, and applications](/help/home-overview.webp)

## Quick start {#quick-start}

The basic RAGFlow path is to choose ownership, prepare models, import and parse knowledge, create an application, and start asking questions.

```help-flow
workspace | Choose a workspace | Decide whether the resource is personal or shared
model | Configure models | Prepare chat, embedding, and parsing models
knowledge | Import knowledge | Upload files and wait for parsing to finish
application | Create an app | Attach knowledge from the same workspace
use | Start using it | Ask questions through the web UI or API
```

> **Recommendation:** Configure models before creating your first dataset. A dataset needs at least one available embedding model.

## Workspaces {#workspace}

A workspace controls resource ownership, visibility, and reference boundaries. Check the workspace selector in the header before creating a resource.

![Select all, personal, or team workspaces from the header](/help/workspace-selector.webp)

### Personal workspace

- Used for personal models, datasets, and applications.
- Resources are visible to you and super administrators by default.
- Suitable for drafts, experiments, and private material.
- Ownership labels use `Personal-{creator}`.

### Team workspace

- Used for shared knowledge and applications.
- Team members can see shared resources; editing depends on resource type and team role.
- Ownership labels use `Team-{team name}`.

> “All” shows every workspace the account can access. You must still choose a specific workspace when creating a resource.

## Model setup {#models}

A dataset needs an embedding model. Chats and agents usually need a chat model, and PDFs parsed with MinerU require a MinerU service.

![Configure default models and providers from the model provider page](/help/model-settings.webp)

The current edition provides these model providers:

- **MinerU** for document parsing, with an optional API key.
- **OpenAI-API-Compatible** for OpenAI-compatible chat and embedding models. Its service URL should include `/v1`.
- **Xinference** for models deployed through Xinference.

### Recommended setup order

1. Select the personal or team workspace that needs the model.
2. Open [Model providers](/user-setting/model).
3. Choose a provider and enter the service URL, model name, and optional key.
4. Select “Validate” to test connectivity. Validation times out after 30 seconds.
5. Set the default chat and embedding models.

> Shared models configured by administrators are available to all workspaces by default. Users can also add private models to personal workspaces.

## Knowledge bases {#knowledge}

A knowledge base turns source files into searchable chunks. Applications can reliably use it only after parsing finishes and when both resources share a workspace.

![The dataset list shows names, file counts, and owning workspaces](/help/dataset-list.webp)

### Create and parse

1. Open [Datasets](/datasets) and select “Create dataset”.
2. Choose a workspace, embedding model, and chunking method.
3. Open the dataset file list and select “Add file”.
4. Start parsing after upload and wait for parsing to complete.
5. Use realistic questions in “Retrieval test” to evaluate recall and similarity.

![The dataset file list supports upload, parsing status, retrieval tests, and configuration](/help/dataset-files.webp)

### Choose a chunking method

- Use **General** for ordinary documents.
- Choose a matching built-in method for Q&A, tables, papers, books, and other structured material.
- After changing chunking parameters, validate the result through retrieval testing.

> **Important:** Wait for “Parsing complete” before building an application. If parsing fails, check status details, model connectivity, and the file format.

## AI applications {#applications}

Applications can reference shared resources in the same workspace. Team applications are collaboratively used and maintained.

```help-apps
chat | Chat | Combine datasets, prompts, and a chat model into a multi-turn assistant for the web UI or compatible APIs | /chats
search | Search | Find knowledge quickly for document lookup, evidence location, and result aggregation | /searches
agent | Agent | Combine models, datasets, tools, memory, and conditions in a visual workflow for complex tasks | /agents
memory | Memory | Store reusable long-term information to provide context across chat or agent sessions | /memories
```

### Before creating an application

1. The application and referenced dataset belong to the same workspace.
2. The workspace has the required chat or embedding model.
3. Dataset files have finished parsing.
4. The current user still has access to the team.

## Permissions {#permissions}

Save, delete, and configuration actions depend on the resource workspace, resource type, and current role.

| Role | Personal resources | Team datasets and files | Team chats, searches, agents, and memories |
| --- | --- | --- | --- |
| Team member | Manage own resources | View, retrieve, and reference | Collaborative read and write |
| Team administrator | Manage own resources | Manage every team resource | Manage every team app and session |
| Super administrator | Manage all personal resources | Manage resources in every workspace | Manage all applications and sessions |

> For read-only users, configuration pages keep the Save button disabled and explain why. Do not bypass UI permissions by manually changing request parameters.

## Troubleshooting {#troubleshooting}

### “Provider not found” appears

Confirm that the model instance still exists, its type is correct, and the resource workspace can use it.

### An uploaded file cannot be retrieved

Check parsing status in the dataset file list. If it failed, verify MinerU or embedding-model connectivity and parse again.

### A dataset is missing from an application

Applications can reference only resources in the same workspace. Check both ownership labels and confirm team membership.

### More files cannot be uploaded

Check workspace quotas on the home page. Remove unused files or ask an administrator to raise the file or storage limit.

### Still need help

Record the time, account, workspace, resource ID, and complete error message, then contact your internal administrator.
