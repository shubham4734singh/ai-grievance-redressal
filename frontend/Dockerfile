FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_PROXY_TARGET=http://backend:8000
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]
