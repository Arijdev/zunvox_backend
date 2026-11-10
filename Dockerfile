# ==============================================================================
# Production Dockerfile: Node.js Express Backend alongside Gotenberg v8
# ==============================================================================
FROM gotenberg/gotenberg:8

# Switch to root to install Node.js and system tools
USER root

# Avoid interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install curl, certificates, supervisor, and standard fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    supervisor \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x LTS from NodeSource
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set up supervisor log and PID directories
RUN mkdir -p /var/log/supervisor /var/run

# Copy supervisor configuration
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set application working directory
WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code and configurations
COPY src/ ./src/
COPY .env.example ./.env.example

# Create temporary upload storage directory
RUN mkdir -p uploads/tmp && chmod -R 777 uploads/tmp

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV GOTENBERG_URL=http://127.0.0.1:3000
ENV GOTENBERG_TIMEOUT_MS=60000
ENV UPLOAD_TEMP_DIR=/app/uploads/tmp

# Expose the Node.js Express server port
EXPOSE 5000

# Docker Healthcheck verifying both Node server and Gotenberg readiness
HEALTHCHECK --interval=20s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Start both Gotenberg and Node.js using Supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

