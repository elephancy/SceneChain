FROM node:26-alpine AS build
WORKDIR /work
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
RUN sed -i 's@^[[:space:]]*pid[[:space:]].*;@pid /tmp/nginx.pid;@' /etc/nginx/nginx.conf \
    && grep -Fx 'pid /tmp/nginx.pid;' /etc/nginx/nginx.conf >/dev/null \
    && chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx --from=build /work/dist /usr/share/nginx/html
EXPOSE 80
USER nginx
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1/ || exit 1
