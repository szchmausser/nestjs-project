# Imagen base: Node.js 20 LTS (Alpine)
FROM node:20-alpine

# Instalar herramientas útiles
RUN apk add --no-cache bash git curl sqlite

# Establecer directorio de trabajo
WORKDIR /app

# 1. Crear la carpeta node_modules antes de cambiar de usuario
RUN mkdir -p /app/node_modules && chown -R node:node /app

# Asegurar que el usuario 'node' tiene permisos sobre la carpeta /app
# 'node' ya tiene el UID/GID 1000 en esta imagen base
RUN chown -R node:node /app

# Cambiar al usuario existente 'node'
USER node

# Exponer puertos comunes
# EXPOSE 3000 5173 4200 8080
EXPOSE 3000

# Mantener contenedor activo
CMD ["tail", "-f", "/dev/null"]