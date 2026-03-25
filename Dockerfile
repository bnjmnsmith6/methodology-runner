# Methodology Runner - Production Dockerfile
# Node.js 22 with TypeScript support

FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Run the application using tsx
CMD ["npx", "tsx", "src/index.ts"]
