# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VUE_APP_GOOGLE_CLIENT_ID
ENV VUE_APP_GOOGLE_CLIENT_ID=$VUE_APP_GOOGLE_CLIENT_ID

RUN OUTPUT_DIR=dist npx vue-cli-service build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
