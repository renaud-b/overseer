# Étape 1 : base Node avec serveur statique
FROM node:18-alpine

# Étape 2 : création du dossier
WORKDIR /app

# Étape 3 : copie du projet
COPY . .

# Étape 4 : installation d'un serveur statique ultra léger
RUN npm install -g serve

# Étape 5 : serveur qui sert le dossier courant
CMD ["serve", "-s", ".", "-l", "8097"]