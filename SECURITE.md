# Sécurité de l'accès aux données

Ce document décrit l'état réel de la protection des données de Ba-Diaby Express, ce qui a déjà
été fait, et ce qu'il reste à faire. Il est destiné à être lu par quelqu'un qui reprendra le
sujet dans six mois.

---

## Le problème de fond

L'application gère son propre écran de connexion (identifiant + mot de passe, comptes stockés
dans les données). Elle ne se sert pas des comptes Supabase. Pour lire et écrire, le navigateur
utilise donc la **clé « anon » de Supabase**, qui est publiée dans le JavaScript envoyé à chaque
visiteur — elle est publique par construction.

Tant que la base accorde des droits à cette clé, **l'écran de connexion de l'application ne
protège rien** : quelqu'un qui extrait la clé du code peut interroger la base directement, sans
jamais voir l'écran de connexion. La table `bde_data` contient les clients, leurs numéros de
téléphone, leurs adresses, tous les paiements, et les comptes utilisateurs avec l'empreinte de
leur mot de passe.

C'est le compromis assumé au départ, documenté dans `src/lib/storage.js`. Il n'est pas tenable
à long terme.

---

## Ce qui a été fait (15/08/2026)

Migration `limiter_suppression_aux_sauvegardes`.

La table n'avait qu'une seule politique : `ALL / public / USING true` — tous les droits, y compris
la suppression. Elle a été remplacée par quatre politiques explicites :

| Opération | Autorisée à la clé publique | Pourquoi |
|---|---|---|
| Lecture | oui | l'application en a besoin à chaque ouverture |
| Création | oui | première écriture d'une clé (sauvegarde du jour) |
| Mise à jour | oui | chaque enregistrement de colis, de paiement… |
| **Suppression** | **uniquement les clés `bde-backup-%`** | l'application ne supprime que ses vieilles sauvegardes |

**Effet** : la ligne de données vivante (`bde-data`) ne peut plus être effacée avec la clé
publique. Le scénario « quelqu'un vide la base » est écarté.

**Ce que cela ne corrige pas** : la lecture et la modification restent ouvertes à cette clé. La
confidentialité des données n'est donc pas encore assurée — seule leur destruction l'est.

Vérifié après application, sous le rôle `anon` lui-même : lecture OK, écriture OK, rotation des
sauvegardes OK, suppression de `bde-data` bloquée.

### Revenir en arrière

```sql
drop policy if exists "Lecture par la clé applicative" on public.bde_data;
drop policy if exists "Création par la clé applicative" on public.bde_data;
drop policy if exists "Mise à jour par la clé applicative" on public.bde_data;
drop policy if exists "Suppression limitée aux sauvegardes" on public.bde_data;
create policy "Accès complet via la clé anon" on public.bde_data for all using (true) with check (true);
```

---

## Ce qu'il reste à faire : vérifier la connexion côté serveur

### Pourquoi les solutions évidentes ne conviennent pas ici

- **Créer un compte Supabase par agent** : les mots de passe sont stockés hachés (PBKDF2), donc
  non récupérables pour créer les comptes correspondants. Il faudrait faire redéfinir son mot de
  passe à toute l'équipe. Et comme tout le monde lit la même ligne de données, les règles d'accès
  ne feraient pas de distinction entre eux : le gain serait d'exiger un compte, rien de plus.
- **Un compte Supabase unique pour l'application** : ses identifiants devraient se trouver dans
  le code envoyé au navigateur — le problème de la clé anon, à l'identique.

### L'approche retenue

1. Une fonction serveur `api/login.js` reçoit identifiant + mot de passe, lit les comptes avec la
   **clé de service** (jamais envoyée au navigateur), vérifie l'empreinte PBKDF2 comme le fait
   aujourd'hui le navigateur, et renvoie un **jeton signé** valable quelques heures.
2. Le navigateur joint ce jeton à chaque appel Supabase (`Authorization: Bearer …`).
3. Les politiques deviennent `using (auth.role() = 'authenticated')` : la clé anon seule ne donne
   plus rien.

Bénéfice secondaire, important : la liste des comptes et leurs empreintes de mot de passe ne
partent plus dans le navigateur de qui le demande.

### Où en est le travail

Le code est écrit et vérifié — il ne reste que la configuration et le resserrage.

| | État |
|---|---|
| `api/login.js` — vérification serveur et jeton | fait, éprouvé |
| Jeton porté par les appels Supabase et le temps réel | fait |
| Repli automatique tant que ce n'est pas configuré | fait, éprouvé |
| Les deux variables dans Vercel | **à faire — vous** |
| Resserrage des politiques de la base | à faire — après vérification |

Ce qui a été éprouvé, et comment :

- **Les empreintes de mot de passe calculées par le serveur sont identiques à celles du
  navigateur** — comparées sur cinq cas, dont un mot de passe accentué, un vide, un très long et
  un nombre d'itérations différent. C'est le point critique : le moindre écart empêcherait tout le
  monde de se connecter.
- **La fonction**, sur treize cas : non configurée (501), bon mot de passe (jeton signé, rôle
  `authenticated`, expiration à 12 h), mauvais mot de passe et identifiant inconnu (réponse
  identique au mot près, pour ne pas révéler qui travaille dans l'entreprise), ancien schéma de
  mot de passe encore accepté, champs vides, onzième tentative bloquée, méthode GET refusée,
  et aucune empreinte dans la réponse.
- **L'application**, sur dix cas dans un navigateur : fonction absente ou serveur injoignable →
  connexion locale comme aujourd'hui et aucun jeton conservé ; serveur disponible → jeton conservé
  avec son expiration ; déconnexion → jeton effacé ; refus du serveur (401) et trop de tentatives
  (429) → message affiché, sans repli local qui contournerait le ralentissement.

Ce qui **n'a pas pu être vérifié ici** : que la base accepte réellement le jeton fabriqué. Ce
conteneur n'a aucun accès réseau sortant. C'est précisément ce que valide l'étape 2 ci-dessous,
et pourquoi les politiques ne doivent être resserrées qu'après.

### Ce qu'il faut avant de commencer

Deux variables à créer dans Vercel → Settings → Environment Variables, prises dans Supabase →
Settings → API. **Aucune ne doit commencer par `VITE_`** : ce préfixe les enverrait au navigateur,
ce qui annulerait tout l'intérêt.

- `SUPABASE_SERVICE_ROLE_KEY` — la clé de service
- `SUPABASE_JWT_SECRET` — le secret qui signe les jetons

### L'ordre de déploiement, qui n'est pas négociable

1. Mettre en ligne le code (connexion serveur + jeton) **en gardant les politiques actuelles**.
   L'application continue de fonctionner exactement comme avant.
2. Vérifier une vraie connexion sur le site, avec un vrai compte.
3. **Seulement ensuite**, resserrer les politiques.
4. En cas de problème : rétablir les politiques précédentes (SQL ci-dessus) — le site refonctionne
   en quelques secondes, sans redéploiement.

Faire l'inverse — resserrer d'abord — bloque toute l'équipe dès la première tentative de
connexion.

### À traiter en même temps

- **La synchronisation temps réel** (`subscribeToChanges`) passe aussi par la clé anon : c'est
  traité — le canal se rouvre après chaque connexion pour repartir avec le jeton, sinon les
  appareils cesseraient de se mettre à jour entre eux le jour du resserrage.
- **Le mode hors ligne** conserve une copie locale des données : elle reste lisible sur l'appareil.
  C'est voulu — c'est ce qui permet de travailler sans réseau — mais cela signifie qu'un téléphone
  perdu expose les données qu'il a en cache. La vraie réponse est le verrouillage de l'appareil.
- **La reprise de session** : aujourd'hui l'application restaure la session depuis le navigateur
  sans mot de passe. Avec un jeton qui expire, une reconnexion sera demandée à l'expiration.
