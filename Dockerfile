FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Bind to universal port
EXPOSE 3000

# Start server
CMD [ "npm", "start" ]
