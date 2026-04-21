FROM node:20-alpine
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy application source
COPY . .

EXPOSE 3003

# Use bun to run the TypeScript service directly
CMD ["bun", "run", "index.ts"]
