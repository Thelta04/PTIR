# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (output at /app/dist)
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# The nginx config will be mounted from the nginx container/service
# We just need the built files here
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
