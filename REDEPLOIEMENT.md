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
