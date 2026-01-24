# Noken Declic - Backend API

Plateforme sénégalaise d'aide à l'emploi, aux formations et aux bourses.

## 🚀 Stack Technique

- **Framework**: NestJS 11
- **ORM**: Prisma
- **Base de données**: PostgreSQL
- **Authentification**: JWT + Google OAuth2
- **IA**: OpenAI GPT-4o
- **Documentation**: Swagger

## 📋 Prérequis

- Node.js 20+
- PostgreSQL 15+
- npm ou yarn

## ⚙️ Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Configurer les variables d'environnement dans .env

# Générer le client Prisma
npx prisma generate

# Créer la base de données et appliquer les migrations
npx prisma migrate dev

# Lancer en développement
npm run start:dev
```

## 🔧 Configuration

Configurer les variables dans `.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/nokendeclic"
JWT_SECRET="votre-secret-jwt"
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secret"
OPENAI_API_KEY="votre-openai-api-key"
```

## 📚 Documentation API

Une fois le serveur lancé, accéder à Swagger:
- http://localhost:3000/api/docs

## 🏗️ Structure du Projet

```
src/
├── common/           # Décorateurs, guards, filtres
├── config/           # Configuration
├── prisma/           # Service Prisma
└── modules/
    ├── auth/         # Authentification (JWT + OAuth2)
    ├── users/        # Gestion utilisateurs
    ├── offres/       # Offres d'emploi/formation/bourse
    ├── cv/           # CV Builder
    ├── messages/     # Messagerie
    ├── commentaires/ # Commentaires publics
    ├── retours/      # Candidatures privées
    ├── chatbot/      # Assistant IA
    ├── admin/        # Statistiques admin
    └── favorites/    # Favoris
```

## 📡 Endpoints Principaux

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /api/auth/login` | Connexion email/password |
| Auth | `GET /api/auth/google` | OAuth2 Google |
| Auth | `POST /api/auth/refresh` | Rafraîchir tokens |
| Users | `GET /api/users/me` | Profil connecté |
| Offres | `GET /api/offres` | Liste avec filtres |
| Offres | `POST /api/offres` | Créer une offre |
| CV | `GET /api/cv/me` | Mon CV |
| CV | `POST /api/cv/me` | Sauvegarder CV |
| Chatbot | `POST /api/chatbot/chat` | Conversation IA |
| Admin | `GET /api/admin/statistics` | Stats plateforme |

## 🔐 Rôles

- **ADMIN**: Accès complet
- **PARTENAIRE**: Créer/gérer ses offres
- **MEMBRE**: Consulter, postuler, commenter

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Couverture
npm run test:cov
```

## 📦 Build Production

```bash
npm run build
npm run start:prod
```

## 📄 License

MIT
