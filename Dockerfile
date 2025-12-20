FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .
RUN npm run build


FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=build /app/build /usr/share/nginx/html

RUN mkdir -p /tmp/nginx && chmod -R 777 /tmp/nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
