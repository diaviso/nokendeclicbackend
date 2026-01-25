# Déploiement sur Railway

## Prérequis
- Compte Railway (https://railway.app)
- Projet Git pushé sur GitHub/GitLab

## Étapes de déploiement

### 1. Créer un nouveau projet sur Railway
1. Connectez-vous à Railway
2. Cliquez sur "New Project"
3. Sélectionnez "Deploy from GitHub repo"
4. Autorisez Railway à accéder à votre repo

### 2. Ajouter une base de données PostgreSQL
1. Dans votre projet Railway, cliquez sur "New"
2. Sélectionnez "Database" → "PostgreSQL"
3. Railway créera automatiquement la variable `DATABASE_URL`

### 3. Configurer les variables d'environnement
Dans les settings de votre service, ajoutez ces variables :

```
JWT_SECRET=<générer une clé sécurisée de 64 caractères>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<générer une autre clé sécurisée de 64 caractères>
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=<votre client ID Google>
GOOGLE_CLIENT_SECRET=<votre secret Google>
GOOGLE_CALLBACK_URL=https://<votre-domaine-railway>/auth/google/callback

OPENAI_API_KEY=<votre clé API OpenAI>

FRONTEND_URL=https://<url-de-votre-frontend>

MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=<votre email>
MAIL_PASS=<votre mot de passe d'application>
MAIL_FROM="NOKEN DECLIC <votre-email>"
```

### 4. Exécuter les migrations Prisma
Après le premier déploiement, exécutez dans le terminal Railway :
```bash
npx prisma migrate deploy
```

Ou ajoutez cette commande au script de démarrage si nécessaire.

### 5. Vérifier le déploiement
- Accédez à `https://<votre-domaine>/api/docs` pour voir Swagger
- Testez les endpoints de l'API

## Variables automatiques Railway
Railway configure automatiquement :
- `PORT` - Le port sur lequel l'app doit écouter
- `DATABASE_URL` - L'URL de connexion PostgreSQL (si vous avez ajouté une DB)

## Commandes utiles

```bash
# Générer le client Prisma
npm run prisma:generate

# Appliquer les migrations en production
npm run prisma:migrate:deploy

# Pousser le schéma sans migration (dev uniquement)
npm run prisma:push
```

## Troubleshooting

### L'app ne démarre pas
- Vérifiez les logs dans Railway
- Assurez-vous que toutes les variables d'environnement sont configurées
- Vérifiez que `DATABASE_URL` est bien définie

### Erreurs Prisma
- Exécutez `npx prisma generate` manuellement
- Vérifiez que les migrations sont appliquées

### Erreurs CORS
- Vérifiez que `FRONTEND_URL` contient l'URL exacte de votre frontend
- Pour plusieurs origines, séparez-les par des virgules : `https://app1.com,https://app2.com`
