# ─── Stage 1: deps ───────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ─── Stage 2: runtime ────────────────────────────────────────
FROM node:18-alpine AS runtime

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Document the port (actual binding comes from env PORT)
EXPOSE 5001

# Healthcheck: hit a lightweight endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5001}/health || exit 1

CMD ["node", "server.js"]
