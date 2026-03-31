FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
COPY scripts ./scripts
EXPOSE 5002
CMD ["npm", "start"]
