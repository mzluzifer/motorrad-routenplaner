FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install --workspace backend --include-workspace-root
COPY backend ./backend
RUN npm run build --workspace backend

FROM node:22-slim
WORKDIR /app/backend
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/brouter-profiles ./brouter-profiles
EXPOSE 8080
CMD ["node", "dist/index.js"]
