# Multi-stage build for Cube.js + React app
FROM node:18-alpine AS base

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build React app
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/schema ./schema
COPY --from=base /app/cube.js ./cube.js
COPY --from=base /app/cube.config.js ./cube.config.js
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cubejs -u 1001

# Set ownership
RUN chown -R cubejs:nodejs /app
USER cubejs

# Expose ports
EXPOSE 4000 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/cubejs-api/v1/load || exit 1

# Start the application
CMD ["npm", "run", "cube"]
