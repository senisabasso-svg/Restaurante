# Etapa 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Declarar argumento para la variable de entorno
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente (incluyendo nginx.conf)
COPY . .

# Build de la aplicación
RUN npm run build

# Etapa 2: Production
FROM nginx:alpine

# Instalar wget para health check
RUN apk add --no-cache wget

# Copiar archivos build
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de nginx desde la etapa de build
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/nginx-health || exit 1

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
