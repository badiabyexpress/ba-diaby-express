# Guide de déploiement — Ba-Diaby Express

Ce guide suppose que vous avez déjà : un compte [GitHub](https://github.com) et un
compte [Vercel](https://vercel.com) (vous pouvez créer le compte Vercel avec votre
compte GitHub directement, c'est le plus simple).

---

## Étape 1 — Créer le dépôt GitHub

Je ne peux pas créer le dépôt à votre place (je n'ai pas accès à votre compte),
mais voici exactement comment faire.

### Option A — Depuis le site GitHub (le plus simple)

1. Allez sur https://github.com/new
2. Nom du dépôt : `ba-diaby-express` (ou ce que vous voulez)
3. Laissez-le en **Private** si vous ne voulez pas que le code soit public
4. Ne cochez aucune case d'initialisation (pas de README, pas de .gitignore — on les a déjà)
5. Cliquez sur **Create repository**
6. GitHub vous montre une page avec des commandes — gardez-la ouverte, vous en aurez besoin à l'étape 2

### Option B — Depuis votre ordinateur avec GitHub CLI

```bash
gh repo create ba-diaby-express --private --source=. --remote=origin
```

---

## Étape 2 — Envoyer le code sur GitHub

Téléchargez le dossier du projet que je vous ai fourni, ouvrez un terminal dedans, puis :

```bash
cd ba-diaby-express
git init
git add .
git commit -m "Version initiale — Ba-Diaby Express"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM-UTILISATEUR/ba-diaby-express.git
git push -u origin main
```

Remplacez `VOTRE-NOM-UTILISATEUR` par votre identifiant GitHub. Si on vous demande de
vous authentifier, suivez les instructions de GitHub (jeton d'accès personnel ou
connexion via le navigateur).

---

## Étape 3 — Connecter GitHub à Vercel

1. Allez sur https://vercel.com/new
2. Cliquez sur **Import Git Repository**
3. Si ce n'est pas déjà fait, autorisez Vercel à accéder à votre compte GitHub
4. Sélectionnez le dépôt `ba-diaby-express` dans la liste
5. Vercel détecte automatiquement **Vite** comme framework — laissez les réglages par défaut :
   - Build Command : `npm run build`
   - Output Directory : `dist`
6. **Avant de cliquer sur Deploy**, ouvrez la section **Environment Variables** et ajoutez ces trois variables (cochez les 3 environnements Production/Preview/Development pour chacune) :
   - `ANTHROPIC_API_KEY` : votre clé API (récupérée sur https://console.anthropic.com/settings/keys)
   - `VITE_SUPABASE_URL` : `https://vtzpejzghtcakqucuvmc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` : la valeur présente dans `.env.example`
7. Cliquez sur **Deploy**

Après 1 à 2 minutes, Vercel vous donne une URL du type `ba-diaby-express.vercel.app` —
votre site est en ligne.

**Important** : à chaque fois que vous (ou moi, si vous me redonnez du code) poussez
une modification sur la branche `main` de GitHub, Vercel redéploie automatiquement le
site. C'est ce lien GitHub ↔ Vercel qui permet les mises à jour continues.

---

## Étape 4 — Connecter votre nom de domaine

Une fois le domaine acheté (chez Namecheap, OVH, Google Domains, etc.) :

1. Dans votre projet sur Vercel, allez dans **Settings → Domains**
2. Tapez votre nom de domaine (ex : `badiaby-express.com`) et cliquez sur **Add**
3. Vercel vous indique les enregistrements DNS à ajouter — en général :
   - Pour le domaine racine (`badiaby-express.com`) : un enregistrement **A** pointant vers `76.76.21.21`
   - Pour un sous-domaine (`www.badiaby-express.com`) : un enregistrement **CNAME** pointant vers `cname.vercel-dns.com`
4. Allez chez votre registrar (là où vous avez acheté le domaine), ouvrez la gestion DNS, et ajoutez exactement les enregistrements indiqués par Vercel
5. Revenez sur Vercel — la validation se fait automatiquement, ça prend généralement de quelques minutes à quelques heures (le temps que le changement DNS se propage)
6. Vercel active automatiquement le certificat HTTPS (cadenas) une fois le domaine validé — rien à faire de votre côté

---

## Compatibilité Vercel — confirmée ✅

Ce projet est un site **Vite + React** classique avec deux petites fonctions serverless
(`api/claude.js`). C'est exactement le type de projet pour lequel Vercel est conçu :
détection automatique, build en une commande, fonctions serverless incluses sans
configuration supplémentaire. Aucun changement d'architecture n'est nécessaire.

---

## Base de données — déjà en place ✅

Le projet Supabase "Site transport colis" est créé et connecté (table `bde_data`,
synchronisation en temps réel activée). Toutes les données sont partagées entre tous
les appareils qui ouvrent le site — plus besoin de migration supplémentaire pour ça.

Point de sécurité à connaître : l'application utilise son propre écran de connexion
(pas de compte Supabase par utilisateur), donc la clé publique Supabase donne accès à la
table de données — voir la note détaillée dans `src/lib/storage.js`. Convient à un usage
interne d'entreprise ; pour des données très sensibles, il faudrait passer à de vrais
comptes Supabase Auth par utilisateur (dites-le-moi si vous voulez qu'on fasse cette évolution).
