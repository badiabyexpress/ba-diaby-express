# Ba-Diaby Express — Plateforme de gestion logistique

Application de gestion pour Ba-Diaby Express : colis, tarification multi-devises,
clients, comptabilité, commissions par agence et assistant IA.

## Stack technique

- **React 18** + **Vite** (build rapide, supporté nativement par Vercel)
- **lucide-react** pour les icônes
- Stockage : **Supabase** (base PostgreSQL partagée, synchronisation en temps réel entre tous les appareils)
- IA : **Claude (Anthropic)** via une fonction serverless (`api/claude.js`) qui garde la clé API côté serveur

## Synchronisation en temps réel

Toutes les données (colis, utilisateurs, tarifs...) sont stockées dans un projet Supabase
partagé ("Site transport colis"). Deux agents connectés sur deux appareils différents
voient les mêmes données, et toute modification apparaît automatiquement chez les autres
sans recharger la page (abonnement Supabase Realtime, voir `src/lib/storage.js`).

**Note de sécurité** : l'application utilise son propre écran de connexion (pas de compte
Supabase par utilisateur), donc la clé publique Supabase autorise l'accès à la table de
données — la protection réelle vient de l'écran de connexion applicatif. Convient à un usage
interne d'entreprise ; pour des données très sensibles, il faudrait migrer vers de vrais
comptes Supabase Auth par utilisateur.

## Démarrer en local

```bash
npm install
cp .env.example .env   # les identifiants Supabase y sont déjà pré-remplis, ajoutez juste votre clé ANTHROPIC_API_KEY
npm run dev
```

L'application sera disponible sur http://localhost:5173

Note : les fonctions serverless (`api/claude.js`) ne tournent pas avec `vite dev` seul.
Pour les tester en local, utilisez `vercel dev` (voir DEPLOIEMENT.md) ou déployez
directement sur Vercel.

## Compte de démonstration

- Identifiant : `admin`
- Mot de passe : `admin123`

Pensez à changer ce mot de passe une fois en production (Configuration → Gestion Utilisateurs).

## Structure du projet

```
ba-diaby-express/
├── api/
│   └── claude.js        # Fonction serverless : proxy sécurisé vers l'API Claude
├── src/
│   ├── App.jsx           # Toute l'application (une seule page)
│   ├── main.jsx          # Point d'entrée React
│   └── lib/storage.js    # Couche de stockage (localStorage)
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

Voir `DEPLOIEMENT.md` pour la mise en ligne complète (GitHub → Vercel → nom de domaine).
