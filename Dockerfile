# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files for backend
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy backend server
COPY server ./server

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "server/index.js"]
