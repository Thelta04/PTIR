# Stage 1: Base image for building and development
FROM node:22-alpine AS base
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .

# Stage 2: Development (used by docker-compose.override.yml)
FROM base AS dev
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 3: Build for production
FROM base AS build
RUN npm run build

# Stage 4: Final Nginx image (used by default or targeted as 'prod')
FROM nginx:1.27-alpine AS prod
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
