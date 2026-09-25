# Multi-stage build: compile the React app, then run the API which also serves it.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false
COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
