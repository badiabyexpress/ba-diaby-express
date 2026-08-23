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

Le domaine de l'entreprise est **`badiabyexpress.com`**, acheté chez Vercel le 23/08/2026,
renouvellement automatique activé.

### Si le domaine est acheté chez Vercel (le cas ici)

C'est le chemin le plus court : les nameservers sont déjà ceux de Vercel, donc **il n'y a aucun
DNS à saisir à la main**.

1. Vercel → **Domains** → `badiabyexpress.com` → section **Connected Projects** → **Connect**
2. Choisissez le projet **ba-diaby-express**
3. Vercel ajoute `badiabyexpress.com` et `www.badiabyexpress.com`, et fabrique le certificat
   HTTPS tout seul en quelques minutes
4. Choisissez l'adresse principale : **`badiabyexpress.com`**, sans le `www` — plus court à dicter
   au téléphone. Le `www` redirige dessus automatiquement.

### Si le domaine est acheté ailleurs (Namecheap, OVH…)

1. Dans le projet sur Vercel, **Settings → Domains**, tapez le domaine et **Add**
2. Vercel indique les enregistrements DNS à créer — en général :
   - domaine racine : un enregistrement **A** vers `76.76.21.21`
   - `www` : un enregistrement **CNAME** vers `cname.vercel-dns.com`
3. Chez le registrar, ouvrez la gestion DNS et ajoutez exactement ces enregistrements
4. La validation se fait ensuite toute seule — de quelques minutes à quelques heures, le temps que
   le changement se propage. Le certificat HTTPS suit automatiquement.

### Ce qui ne change pas

**L'ancienne adresse `ba-diaby-express.vercel.app` reste valable.** Les étiquettes déjà imprimées,
avec leur QR code, continuent donc de fonctionner : rien à réimprimer.

Les QR codes des nouvelles étiquettes suivent l'adresse depuis laquelle l'agent travaille (voir
`trackingUrlFor` dans `src/App.jsx`) : ils basculeront d'eux-mêmes sur le nouveau domaine, sans
aucune modification du code.

### Ce qui mérite d'être repris ensuite

- **Les e-mails** : `EMAIL_FROM` peut maintenant utiliser une adresse du domaine
  (`contact@badiabyexpress.com`) une fois celui-ci vérifié chez Resend — voir `REDEPLOIEMENT.md`.
- **WhatsApp / Meta** : un domaine à soi facilite la vérification de l'entreprise.

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

Point de sécurité : **la base est fermée à la clé publique depuis le 23/08/2026.** Le navigateur
ne lui parle plus directement — il passe par les fonctions serveur, qui détiennent seules la clé
de service. Quelqu'un qui extrait la clé publique du code n'obtient donc plus rien.

Cela suppose que `SUPABASE_SERVICE_ROLE_KEY` soit configurée sur Vercel : sans elle, les fonctions
répondent 501 et l'application retomberait sur un accès direct que la base refuse désormais.
Tout est décrit dans `SECURITE.md`, y compris le SQL pour rouvrir la base en quelques secondes.
