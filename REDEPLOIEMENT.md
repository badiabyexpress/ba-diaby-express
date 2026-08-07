# Redéploiement — Ba-Diaby Express

Ce guide s'adresse au cas où le site est **déjà en ligne** et où vous voulez publier
cette nouvelle version. Pour une première mise en ligne, voir `DEPLOIEMENT.md`.

---

## 1. Publier la nouvelle version

Le dépôt GitHub est déjà relié à Vercel : **envoyer le code déclenche automatiquement
le déploiement**, il n'y a rien à configurer de nouveau.

```bash
cd ba-diaby-express
git add .
git commit -m "Étiquettes et reçus à zones fixes, mots de passe PBKDF2, performances, couleurs"
git push
```

Vercel reconstruit le site en 1 à 2 minutes. Suivez l'avancement sur
https://vercel.com → votre projet → onglet **Deployments**.

### Rien à changer par ailleurs

- **Variables d'environnement** : inchangées (`ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`). Ne pas y toucher.
- **Base de données** : aucune migration. La structure de la table `bde_data` ne change pas.
- **Dépendances** : `package.json` est identique, Vercel réutilisera son cache.

### Si le déploiement échoue

Ouvrez le journal du déploiement sur Vercel et cherchez la première ligne rouge.
Pour revenir en arrière immédiatement : **Deployments → version précédente →
« Promote to Production »**. Le site repart sur l'ancienne version en quelques secondes.

---

## 2. Ce qui a changé (et donc ce qu'il faut regarder)

### Aucune action requise de votre part

| Changement | Effet à la première ouverture |
|---|---|
| Mots de passe renforcés (PBKDF2) | Chaque compte est mis à niveau **tout seul** à sa prochaine connexion. Les identifiants restent les mêmes. |
| Couleurs revues | Le mode clair devient lisible partout (il ne l'était pas). |
| Étiquettes, reçus, bons de sortie | Nouvelle mise en page qui ne peut plus déborder de la page. |
| Listes longues | Affichage par tranches de 100, avec « Afficher plus ». Recherche, totaux et exports portent toujours sur la totalité. |
| Poids du colis | Un poids de 0 ou négatif est désormais refusé à la création. |

### Un point à connaître sur les colis déjà enregistrés

L'obligation d'un poids supérieur à 0 s'applique **aux nouveaux colis**. Si des colis à
0 kg existent déjà en base, ils restent tels quels — ils ne sont pas corrigés
rétroactivement, pour ne pas modifier des factures déjà émises.

Pour les repérer : page **Colis**, puis exportez en CSV et triez sur la colonne du poids.

---

## 3. À vérifier après le déploiement

Ces points n'ont **pas pu être testés** dans mon environnement, qui n'a pas d'accès
réseau : la génération de PDF, les codes QR et les exports Excel dépendent de
bibliothèques chargées depuis Internet. Ils sont à confirmer sur le site en ligne.

### Priorité haute — les documents imprimés

- [ ] **Étiquette** d'un colis dont le destinataire a un **nom long** (qui tient sur deux
      lignes) et une **adresse longue**. C'était précisément le cas qui débordait.
      Vérifier que le code-barres, les poids et le bandeau bleu sont bien tous visibles.
- [ ] **Reçu** d'un paiement **Mobile Money** avec référence, numéro du payeur et numéro
      receveur : c'est le cas qui faisait sortir le bloc signature de la page.
- [ ] **Bon de sortie** : le trait de signature ne doit plus couper le texte.
- [ ] **Ticket thermique 80 mm**, si vous utilisez une imprimante thermique.
- [ ] **Facture PDF** d'un colis à plusieurs produits.

### Priorité haute — le matériel

- [ ] **Scanner caméra** sur un téléphone d'agent (nécessite le site en `https://`).
- [ ] **Photo à l'entrepôt** : prise de vue et envoi depuis un téléphone.

### Priorité normale

- [ ] **Exports Excel** : Paiements, Colis, et « Clients proches du palier ».
- [ ] **Récapitulatif PDF** de la Comptabilité.
- [ ] **Mode clair** : cliquez sur « Mode clair » dans le menu et parcourez quelques pages.
- [ ] **Connexion de votre équipe** : chaque compte doit se connecter normalement
      (la mise à niveau du mot de passe est invisible).

---

## 4. Avant le lancement public — décisions qui vous appartiennent

### Le mot de passe administrateur

Le compte `admin` utilise toujours le mot de passe de test `admin123`. Volontairement
inchangé pendant vos essais en équipe. **À modifier avant d'ouvrir le site au public** :
Configuration → Gestion Utilisateurs.

### Les catégories de produits et leurs tarifs

Les catégories visibles (Vêtements, Électronique, Documents…) et leurs prix au kilo sont
des **données de test**. À remplacer par vos vraies catégories avant le lancement :
Configuration → Catégories.

### Les taux de commission

Point important relevé lors des tests : avec les valeurs par défaut, la commission
(2 €/kg) est **supérieure au prix de vente** de cinq catégories sur six. Le calcul est
juste, ce sont les valeurs de départ qui sont incohérentes — d'où un résultat négatif en
Comptabilité. À ajuster avec vos vrais taux : Configuration → Commissions par Agence.

### Les langues

L'interface d'administration est en français uniquement. Le **portail client** est, lui,
traduit en anglais et en arabe (105 libellés) pour vos clients en France, Belgique,
Canada, États-Unis et Maroc — c'est bien ce qui est en place.

Pour proposer aussi l'administration en anglais, il faudra traduire environ 425 textes.
Le jour où ce sera fait, une seule ligne à modifier dans `src/App.jsx` :

```js
const LANGUES_DISPONIBLES = ["fr", "en"];
```

---

## 5. Ce que la plateforme ne fait pas

À savoir pour ne pas être surpris :

- **Pas de paiement Mobile Money automatique.** Le client *déclare* son paiement, un agent
  le *confirme*. Un vrai encaissement automatique demanderait un partenariat Orange Money
  ou MTN.
- **Pas d'envoi WhatsApp silencieux.** L'application ouvre un brouillon WhatsApp
  pré-rempli ; l'agent appuie sur Envoyer. L'envoi automatique nécessiterait un compte
  Twilio payant.
- **Pas de notification par e-mail.** Aucun service d'envoi (SendGrid, Mailgun) n'est
  configuré.

---

## 6. Sauvegarde

Avant toute manipulation importante : **Configuration → Système → « Sauvegarder (JSON) »**.
Le fichier téléchargé contient l'intégralité des données (colis, clients, comptabilité,
messages) et permet une restauration depuis la même page.

Prenez cette sauvegarde **avant** le redéploiement, par précaution — même si ce
déploiement ne touche pas à la base de données.

---

## 7. Activer WhatsApp (Twilio)

L'envoi automatique est **prêt côté code**. Tant qu'il n'est pas configuré, l'application
ouvre un brouillon WhatsApp que l'agent envoie lui-même — exactement comme aujourd'hui.

### Étape 1 — Activer le bac à sable WhatsApp

Console Twilio → **Messaging → Try it out → Send a WhatsApp message**.

Vous y trouverez un numéro Twilio partagé et un code d'adhésion (`join xxx-xxx`).
Chaque personne qui doit recevoir des messages envoie ce code au numéro depuis WhatsApp.

C'est gratuit et immédiat, mais réservé aux **essais avec votre équipe** : vous ne pouvez
pas demander à un vrai client d'envoyer un code d'adhésion.

> Votre numéro local américain (10DLC) affiché « Messaging disabled — Complete A2P
> registration » ne sert **pas** pour WhatsApp. C'est un canal SMS distinct, et il est
> de toute façon inadapté à un envoi vers la Guinée ou la France.

### Étape 2 — Renseigner les trois variables dans Vercel

**Project Settings → Environment Variables** :

| Variable | Valeur |
|---|---|
| `TWILIO_ACCOUNT_SID` | votre identifiant de compte (commence par `AC`) |
| `TWILIO_AUTH_TOKEN` | votre Auth Token — **à ne jamais partager** |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (bac à sable) |

Puis **redéployez** : Deployments → dernier déploiement → Redeploy.

### Étape 3 — Essayer

Ouvrez un colis dont le destinataire a rejoint le bac à sable, puis **Notifier WhatsApp**.

- Message parti → le bouton affiche « Message envoyé »
- Sinon → le brouillon WhatsApp s'ouvre, avec l'explication du refus

### Étape 4 — Passer en WhatsApp Business

Pour écrire à de vrais clients, il faut un numéro validé par Meta (vérification
d'entreprise, quelques jours). Une fois obtenu, **une seule chose à changer** :
`TWILIO_WHATSAPP_FROM` prend votre numéro validé. Le code reste identique.

### À savoir : la fenêtre de 24 heures

WhatsApp n'autorise le texte libre que dans les **24 h suivant le dernier message du
client**. Au-delà, il faut un modèle validé par Meta. L'application détecte ce cas et
l'explique à l'agent, qui bascule alors sur le brouillon.

Prévoyez de faire valider quelques modèles courants : colis arrivé, colis prêt au
retrait, rappel de paiement.

---

## 8. Activer l'envoi des factures par e-mail

Facultatif. Tant que ce n'est pas configuré, le bouton « Envoyer par e-mail » ouvre
simplement un brouillon que l'agent envoie lui-même.

### Ce que ça change

Quand un client a une adresse e-mail renseignée :

- sa **facture part automatiquement** après chaque encaissement, en pièce jointe ;
- un bouton **« Envoyer par e-mail »** apparaît sur sa fiche colis pour un envoi manuel.

Les clients sans adresse e-mail ne sont pas concernés — rien ne change pour eux, et
aucune erreur n'est affichée à l'agent.

### Étape 1 — Créer un compte Resend

Rendez-vous sur **resend.com**. Le forfait gratuit couvre **3 000 e-mails par mois**,
largement suffisant pour votre volume.

Récupérez la clé d'API (elle commence par `re_`).

### Étape 2 — Choisir l'adresse expéditrice

Resend n'envoie que depuis un domaine vérifié.

- **Si vous avez un domaine** (ex. badiabyexpress.com) : ajoutez-le dans Resend et
  suivez les instructions de vérification. Vous pourrez écrire à tous vos clients.
- **Sans domaine** : utilisez l'adresse de test fournie par Resend. Les e-mails ne
  partiront qu'à votre propre adresse — de quoi valider le circuit avant d'aller plus loin.

### Étape 3 — Renseigner les variables dans Vercel

**Project Settings → Environment Variables** :

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | votre clé — **à ne jamais partager** |
| `EMAIL_FROM` | `Ba-Diaby Express <contact@votredomaine.com>` |

Puis **redéployez** : Deployments → dernier déploiement → Redeploy.

### Étape 4 — Essayer

Ouvrez un colis dont le destinataire a une adresse e-mail, puis cliquez sur
**Envoyer par e-mail**. Le bouton affiche « Facture envoyée » si tout va bien.

### À savoir

Sur vos 343 clients repris de l'ancienne plateforme, **14 seulement ont une adresse
e-mail**. WhatsApp touche bien plus de monde chez vous — l'e-mail sert surtout pour
vos clients en France, en Belgique et aux États-Unis.
