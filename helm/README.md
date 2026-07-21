# RAGFlow Helm Chart

A Helm chart to deploy RAGFlow and its dependencies on Kubernetes.

- Components: RAGFlow (web/api), Elasticsearch, MySQL, MinIO, and Redis
- Requirements: Kubernetes >= 1.24, Helm >= 3.10

## Install

```bash
helm upgrade --install ragflow ./ \
  --namespace ragflow --create-namespace
```

Uninstall:
```bash
helm uninstall ragflow -n ragflow
```

## Global Settings

- `global.repo`: Prepend a global image registry prefix for all images.
  - Behavior: Replaces the registry part and keeps the image path (e.g., `quay.io/minio/minio` -> `registry.example.com/myproj/minio/minio`).
  - Example: `global.repo: "registry.example.com/myproj"`
- `global.imagePullSecrets`: List of image pull secrets applied to all Pods.
  - Example:
    ```yaml
    global:
      imagePullSecrets:
        - name: regcred
    ```
- `global.nodeSelector`: Node labels required by every Pod rendered by the chart.
  - Example:
    ```yaml
    global:
      nodeSelector:
        kubernetes.io/arch: amd64
    ```
- `global.nodeName`: Exact node name from `kubectl get nodes`. When set, it
  takes precedence over `global.nodeSelector`.
  - Example:
    ```yaml
    global:
      nodeName: worker-01
    ```

## External Services (MySQL / MinIO / Redis)

The chart can deploy in-cluster services or connect to external ones. Toggle with `*.enabled`. When disabled, provide host/port via `env.*`.

- MySQL
  - `mysql.enabled`: default `true`
  - If `false`, set:
    - `env.MYSQL_HOST` (required), `env.MYSQL_PORT` (default `3306`)
    - `env.MYSQL_DBNAME` (default `rag_flow`), `env.MYSQL_PASSWORD` (required)
    - `env.MYSQL_USER` (default `root` if omitted)
- MinIO
  - `minio.enabled`: default `true`
  - Configure:
    - `env.MINIO_HOST` (optional external host), `env.MINIO_PORT` (default `9000`)
    - `env.MINIO_ROOT_USER` (default `rag_flow`), `env.MINIO_PASSWORD` (optional)
- Redis (Valkey)
  - `redis.enabled`: default `true`
  - If `false`, set:
    - `env.REDIS_HOST` (required), `env.REDIS_PORT` (default `6379`)
    - `env.REDIS_PASSWORD` (optional; empty disables auth if server allows)

Notes:
- When `*.enabled=true`, the chart renders in-cluster resources and injects corresponding `*_HOST`/`*_PORT` automatically.
- Sensitive variables like `MYSQL_PASSWORD` are required; `MINIO_PASSWORD` and `REDIS_PASSWORD` are optional. All secrets are stored in a Secret.

### Example: use external MySQL, MinIO, and Redis

```yaml
# values.override.yaml
mysql:
  enabled: false  # use external MySQL
minio:
  enabled: false  # use external MinIO (S3 compatible)
redis:
  enabled: false  # use external Redis/Valkey

env:
  # MySQL
  MYSQL_HOST: mydb.example.com
  MYSQL_PORT: "3306"
  MYSQL_USER: root
  MYSQL_DBNAME: rag_flow
  MYSQL_PASSWORD: "<your-mysql-password>"

  # MinIO
  MINIO_HOST: s3.example.com
  MINIO_PORT: "9000"
  MINIO_ROOT_USER: rag_flow
  MINIO_PASSWORD: "<your-minio-secret>"

  # Redis
  REDIS_HOST: redis.example.com
  REDIS_PORT: "6379"
  REDIS_PASSWORD: "<your-redis-pass>"
```

Apply:
```bash
helm upgrade --install ragflow ./helm -n ragflow -f values.override.yaml
```

## Document Engine

Elasticsearch is the only document engine supported by this chart. Configure its password through `env.ELASTIC_PASSWORD`:

```yaml
env:
  ELASTIC_PASSWORD: "<es-pass>"
```

## RAGFlow Runtime

The default RAGFlow entrypoint arguments match `docker/docker-compose.yml`:

```yaml
ragflow:
  args:
    - --enable-adminserver
    - --init-model-provider-tables
    - --workers=1
```

Application environment variables are configured through `env`. Service host
names are generated from Kubernetes service DNS names, while runtime defaults
such as `API_PROXY_SCHEME`, registration, parser batch sizes, and thread pool
size remain aligned with the Docker deployment.

## Ingress

Expose the web UI via Ingress:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: ragflow.example.com
      paths:
      - path: /
        pathType: Prefix
```

## NodePort

RAGFlow Web, Elasticsearch, MySQL, and MinIO use `NodePort` services by
default. Leave `nodePort` empty to let Kubernetes allocate a port, or set a
fixed port from the cluster's NodePort range.

```yaml
ragflow:
  service:
    type: NodePort
    nodePort: 30080
```

Elasticsearch, MySQL, and MinIO expose the same optional settings under their
respective `service` blocks. The direct API, admin, and Redis services remain
private `ClusterIP` services.

## Persistent Volume Paths

Elasticsearch, MySQL, MinIO, and Redis use PVCs. By default, the cluster's
StorageClass dynamically provisions their volumes. To bind a component to a
directory on a Kubernetes node, set an absolute `storage.hostPath`:

```yaml
global:
  nodeName: worker-01

elasticsearch:
  storage:
    hostPath: /data/ragflow/elasticsearch

mysql:
  storage:
    hostPath: /data/ragflow/mysql

minio:
  storage:
    hostPath: /data/ragflow/minio

redis:
  storage:
    hostPath: /data/ragflow/redis
```

When `hostPath` is set, the chart creates a retained static PV and binds the
component's PVC to it. HostPath storage is node-local, so use
`global.nodeName` to schedule the Pods onto the node that owns these
directories. Leave every `hostPath` empty for cluster-managed dynamic
provisioning.

## Validate the Chart

```bash
helm lint ./helm
helm template ragflow ./helm > rendered.yaml
```

## Notes

- The chart deploys Elasticsearch, MySQL, MinIO, and Redis in the cluster by default.
- The chart injects derived `*_HOST`/`*_PORT` and required secrets into a single Secret (`<release>-ragflow-env-config`).
- `global.repo` and `global.imagePullSecrets` apply to all Pods; per-component `*.image.pullSecrets` still work and are merged with global settings.
