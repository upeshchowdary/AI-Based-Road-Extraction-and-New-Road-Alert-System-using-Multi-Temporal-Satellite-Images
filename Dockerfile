# RoadWatch AP — one container: FastAPI API + built web UI + data bundle.
# Render builds this from render.yaml; locally: docker build -t roadwatch . && docker run -p 8000:8000 roadwatch

# ---- 1. web UI (Vite build; the Docs page imports docs/guides/*.md) --------------------------------
FROM node:22-slim AS web
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
COPY web/package.json web/pnpm-lock.yaml web/
RUN cd web && pnpm install --frozen-lockfile
COPY web web
COPY docs/guides docs/guides
RUN cd web && pnpm build

# ---- 2. API -------------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.12.5 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

# dependencies first (cached layer), then the project itself
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --extra serve --no-install-project --no-cache
COPY src src
RUN uv sync --frozen --no-dev --extra serve --no-cache

# small tracked inputs the API reads (configs, tile registry + holdout, run log, public web data)
COPY configs configs
COPY evidence evidence
COPY runs/RUN_LOG.csv runs/RUN_LOG.csv
COPY web/public web/public
COPY --from=web /src/web/dist web/dist

# data bundle (zone images, metrics, predicted roads, alerts) from the GitHub release
ARG DATA_URL=https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images/releases/download/data-v1/roadwatch_data.tar.gz
RUN python -c "import io, sys, tarfile, urllib.request; \
data = urllib.request.urlopen(sys.argv[1], timeout=300).read(); \
tarfile.open(fileobj=io.BytesIO(data)).extractall('data_cache', filter='data')" "$DATA_URL" \
 && test -f data_cache/bundle_manifest.json

ENV PATH=/app/.venv/bin:$PATH PORT=8000
EXPOSE 8000
# Render sets $PORT; bind all interfaces inside the container
CMD ["sh", "-c", "roadwatch serve --host 0.0.0.0 --port ${PORT}"]
