FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY ui ./ui
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
