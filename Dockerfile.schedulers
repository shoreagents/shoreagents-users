# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY schedulers-package.json package.json
COPY package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy scheduler scripts and configurations
COPY scripts/ ./scripts/
COPY ecosystem.railway.schedulers.config.js ./
COPY scripts/railway-schedulers-start.sh ./

# Make the startup script executable
RUN chmod +x scripts/railway-schedulers-start.sh

# Create PM2 directory
RUN mkdir -p /app/.pm2

# Set PM2 home
ENV PM2_HOME=/app/.pm2

# Expose port (Railway will set this)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD pm2 status || exit 1

# Start the schedulers
CMD ["bash", "scripts/railway-schedulers-start.sh"]
