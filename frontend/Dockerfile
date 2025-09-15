FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Construire l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
