/**
 * Qui a le droit de faire quoi — la seule table, partagée par l'écran et par le serveur.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Ces permissions vivaient dans src/App.jsx, c'est-à-dire dans le navigateur : elles décidaient
 * quels boutons s'affichent. Un bouton qu'on n'affiche pas n'est pas un bouton qu'on ne peut pas
 * actionner — qui ouvre les outils de développement écrit ce qu'il veut. Le serveur doit donc lire
 * la même table, et c'est pour cela qu'elle a déménagé ici.
 *
 * Le préfixe `_` empêche Vercel d'en faire une fonction : ce n'est pas une porte, c'est un outil.
 *
 * DEUX LECTEURS, UNE SEULE SOURCE
 * -------------------------------
 * src/App.jsx l'importe pour construire ses écrans, api/_cloisonnement.js pour trancher une
 * écriture. En recopier une moitié dans le serveur aurait marché le premier jour et divergé le
 * second — et une divergence, ici, ne se voit pas : elle s'appelle une permission qu'on croyait
 * retirée.
 */

export const ROLES = ["Administrateur", "Agent", "Comptable", "Chauffeur", "Partenaire"];

export const PERMISSIONS_SCHEMA = [
  { group: "COLIS", permissions: [
    { key: "colis.voir_propres", label: "Voir ses propres colis" },
    { key: "colis.voir_tous", label: "Voir tous les colis" },
    { key: "colis.creer", label: "Créer un colis" },
    { key: "colis.modifier", label: "Modifier un colis" },
    { key: "colis.changer_statut", label: "Changer le statut" },
    { key: "colis.annuler", label: "Annuler un colis" },
    { key: "colis.enregistrer_paiement", label: "Enregistrer un paiement" },
    { key: "colis.supprimer", label: "Supprimer un colis" },
    /*
     * Import Excel, bordereau de réception et règlement groupé agissent sur plusieurs colis à la
     * fois (import en masse, encaissement groupé) — des actions plus sensibles que la création
     * d'un colis à l'unité. Non accordées à l'Agent par défaut : c'est à l'administrateur de
     * désigner nommément les agences/agents autorisés, comme pour l'Espace Client.
     */
    { key: "colis.importer_excel", label: "Importer des colis depuis Excel" },
    { key: "colis.bordereau_reception", label: "Générer un bordereau de réception" },
    { key: "colis.reglement_groupe", label: "Encaisser plusieurs colis en une fois (règlement groupé)" },
  ]},
  { group: "BORDEREAUX", permissions: [
    { key: "bordereaux.consulter", label: "Consulter les bordereaux" },
    { key: "bordereaux.creer", label: "Créer un bordereau" },
    { key: "bordereaux.modifier", label: "Modifier un bordereau (ajouter/retirer des colis)" },
    { key: "bordereaux.valider", label: "Marquer un bordereau comme reçu" },
  ]},
  { group: "FACTURES", permissions: [
    { key: "factures.consulter", label: "Consulter les factures" },
    { key: "factures.creer", label: "Générer une facture" },
    { key: "factures.modifier", label: "Encaisser / modifier un paiement" },
  ]},
  { group: "CLIENTS", permissions: [
    { key: "clients.consulter", label: "Consulter les clients" },
  ]},
  /*
   * L'Espace Client est un circuit à part : commandes annoncées, réception et pesée, messages,
   * demandes express. Tous les agents n'ont pas vocation à y toucher — et un partenaire ne doit
   * jamais y accéder. Cette permission n'est accordée à personne par défaut hors administrateur :
   * c'est à l'administrateur de désigner nommément les agents concernés.
   */
  { group: "ESPACE CLIENT", permissions: [
    { key: "espaceclient.gerer", label: "Traiter les demandes de l’Espace Client (réception, messages, express)" },
  ]},
  { group: "COMPTABILITÉ", permissions: [
    { key: "compta.consulter", label: "Consulter la comptabilité" },
    { key: "compta.gerer_depenses", label: "Ajouter / modifier / supprimer une dépense" },
    { key: "compta.charges_fixes", label: "Gérer les charges fixes (salaires, loyers...)" },
    { key: "compta.marges", label: "Consulter les marges et bénéfices" },
  ]},
  { group: "STATISTIQUES", permissions: [
    { key: "stats.globales", label: "Voir les statistiques globales (toutes agences)" },
    { key: "stats.personnelles", label: "Voir ses propres statistiques" },
    { key: "stats.exporter", label: "Exporter les données (CSV / sauvegarde)" },
  ]},
  { group: "CONFIGURATION", permissions: [
    { key: "config.acceder", label: "Accéder à la configuration" },
    { key: "config.tarifs", label: "Modifier les tarifs, devises et commissions" },
    { key: "config.categories", label: "Gérer les catégories de produits" },
  ]},
  { group: "UTILISATEURS", permissions: [
    { key: "users.consulter", label: "Consulter les utilisateurs" },
    { key: "users.gerer", label: "Créer / modifier / supprimer un utilisateur" },
    { key: "users.permissions", label: "Gérer les permissions des autres comptes" },
  ]},
  { group: "ASSISTANT IA", permissions: [
    { key: "ia.utiliser", label: "Utiliser l’assistant IA" },
  ]},
];

export const ROLE_DEFAULT_PERMISSIONS = {
  "Administrateur": PERMISSIONS_SCHEMA.flatMap((g) => g.permissions.map((p) => p.key)),
  "Agent": ["colis.voir_propres", "colis.voir_tous", "colis.creer", "colis.modifier", "colis.changer_statut", "colis.enregistrer_paiement", "bordereaux.consulter", "bordereaux.creer", "bordereaux.modifier", "bordereaux.valider", "factures.consulter", "factures.creer", "factures.modifier", "paiements.voir_propres", "clients.consulter", "stats.personnelles", "ia.utiliser"],
  "Comptable": ["colis.voir_tous", "factures.consulter", "factures.creer", "factures.modifier", "clients.consulter", "bordereaux.consulter", "compta.consulter", "compta.gerer_depenses", "compta.charges_fixes", "compta.marges", "stats.globales", "stats.exporter"],
  "Chauffeur": ["colis.voir_propres", "colis.changer_statut", "stats.personnelles"],
  "Partenaire": ["stats.personnelles"],
};

export function effectivePermission(user, key) {
  if (!user) return false;
  if (user.permissionsOverride && Object.prototype.hasOwnProperty.call(user.permissionsOverride, key)) return user.permissionsOverride[key];
  return (ROLE_DEFAULT_PERMISSIONS[user.role] || []).includes(key);
}
