FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# Need full install: typescript builds the image, prisma CLI runs migrate at startup.
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build \
  && mkdir -p dist/web dist/admin \
  && cp -R web/. dist/web/ \
  && cp -R admin/. dist/admin/
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
