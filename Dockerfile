# Stage 1: build the React frontend
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
COPY frontend/k-id-core-web.tgz ./
RUN npm ci
COPY frontend/ ./
ARG VITE_KID_PUBLISHABLE_KEY
ARG VITE_KID_BASE_URL
RUN npm run build

# Stage 2: FastAPI serves the API, the voice websocket and the built frontend from one origin
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" httpx websockets numpy python-dotenv "bcrypt>=5.0.0" "pyjwt>=2.15.1"
COPY backend/app ./app
COPY --from=web /web/dist /app/frontend/dist
ENV PORT=10000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
