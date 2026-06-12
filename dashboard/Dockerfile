# ==========================================
# Dashboard Dockerfile (React + Tailwind v4 Dev Server)
# ==========================================
FROM node:20-slim

WORKDIR /app

# Copy package descriptors first to optimize Docker layer caching
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose Vite development server port
EXPOSE 5173

# Run the dev server. The '--host' flag is critical to ensure Vite listens
# on all network interfaces inside the container, allowing it to be accessed
# from the host machine.
CMD ["npm", "run", "dev", "--", "--host"]
