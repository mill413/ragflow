# Repository Guidelines

## Project Structure & Module Organization

The Python backend lives in `api/`, with database models and services under `api/db/`. Ingestion, retrieval, and LLM integration belong in `rag/`; document parsing and OCR are in `deepdoc/`; workflow and tool components are in `agent/`. The React and TypeScript frontend is under `web/`, while the administrator service is in `admin/`. Deployment files are maintained in `docker/` and `helm/`. SDK code is in `sdk/`, and automated tests are collected from `test/`.

## Build, Test, and Development Commands

Use Python 3.13 or newer:

```bash
uv sync --python 3.13 --all-extras   # install backend dependencies
docker compose -f docker/docker-compose-base.yml up -d
uv run pytest                        # run backend tests
ruff check && ruff format --check    # lint and verify formatting
```

Frontend development runs from `web/`:

```bash
npm install
npm run dev          # start Vite development server
npm run type-check   # run TypeScript checks
npm run lint         # run ESLint
npm run test         # run Jest with coverage
npm run build        # create the production bundle
```

## Coding Style & Naming Conventions

Python uses four-space indentation, `snake_case` functions and modules, and `PascalCase` classes. Ruff is authoritative; the configured line length is 200. TypeScript uses two-space indentation, `camelCase` functions and variables, and `PascalCase` components and types. Follow Prettier and ESLint output. Keep changes in the abstraction that owns the behavior. Prefer removing obsolete paths over adding legacy shims, duplicate implementations, or commented-out code.

## Testing Guidelines

Name Python tests `test_*.py` and place them under the closest matching `test/` subtree. Frontend tests use Jest and normally live in `__tests__/` or use `.test.ts(x)` names. Add focused regression tests for fixes and run the narrowest relevant test first, for example:

```bash
uv run pytest test/unit_test/admin/test_example.py
```

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit prefixes such as `feat(admin):`, `fix(chat):`, `docs(api):`, and `build(docker):`. Keep commits scoped and imperative. Pull requests should explain the problem, implementation, validation performed, and deployment or migration impact; link relevant issues and include screenshots for UI changes. When rewriting a community contribution, preserve the original author and add the maintainer with a `Co-authored-by:` trailer.

## Security & Configuration

Do not commit `.env` files, credentials, exported images, runtime data, or generated logs. Document new settings in example configuration files and keep environment-specific values outside tracked source.
