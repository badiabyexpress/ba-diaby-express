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

export const ROLES = ["Administrateur", "Responsable de zone", "Agent", "Comptable", "Chauffeur", "Partenaire"];

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
    /*
     * UN COLIS D'ACHAT EN LIGNE SE CORRIGE LÀ OÙ IL A ÉTÉ PESÉ.
     *
     * Ces colis-là naissent au site de départ — Paris : c'est là qu'arrivent les commandes, là
     * qu'on les pèse, et le poids EST le prix. L'équipe de Conakry les voit, les cherche au
     * comptoir, les remet et les encaisse : c'est son métier. Mais corriger un poids depuis
     * Conakry, c'est refaire le prix d'un colis qu'on n'a jamais eu sur la balance — et le refaire
     * après que le client a reçu sa facture.
     *
     * L'équipe du site de départ n'a pas besoin de ce droit : il lui vient de son site. Celui-ci
     * sert à l'administrateur pour désigner nommément quelqu'un d'ailleurs — un responsable à
     * Conakry qui doit pouvoir rattraper une saisie sans attendre Paris.
     */
    { key: "colis.enligne_modifier", label: "Modifier un colis d’achat en ligne depuis un autre site que celui de départ" },
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
    /*
     * Sa propre caisse — ce qu'il a encaissé lui-même, et ce qu'il doit reverser.
     *
     * Cette permission était accordée à l'Agent et lue par le menu, mais elle ne figurait dans
     * AUCUNE liste de droits : impossible de la voir, impossible de la retirer, et
     * l'administrateur ne l'avait même pas (sa liste se déduit de ce tableau). Le menu « Caisse »
     * ne s'ouvrait donc à lui que par un autre chemin — la comptabilité — et un rôle sur mesure
     * qui aurait dû l'avoir ne pouvait pas l'obtenir.
     */
    { key: "paiements.voir_propres", label: "Voir sa propre caisse (ce qu’on a encaissé, ce qu’on doit reverser)" },
  ]},
  { group: "CLIENTS", permissions: [
    { key: "clients.consulter", label: "Consulter les clients" },
    /*
     * Écrire à toute la base d'un coup n'est pas une consultation : c'est un geste commercial qui
     * engage la marque, coûte de l'argent à chaque message, et qu'on ne peut pas rattraper une
     * fois parti. Il reste donc à l'administrateur, sauf désignation expresse.
     */
    { key: "clients.campagnes", label: "Envoyer des campagnes marketing aux clients" },
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
  { group: "ÉQUIPE", permissions: [
    /*
     * La fiche de pointage est tenue par le responsable, à la main : elle dit qui était là, et à
     * quelles heures. C'est une pièce sociale — elle justifie un salaire, et elle peut être
     * demandée. Elle n'est donc pas ouverte à tous par défaut : un agent n'a pas à savoir qui de
     * ses collègues était absent, ni à corriger sa propre journée.
     */
    { key: "equipe.pointage", label: "Tenir la fiche de pointage" },
  ]},
  { group: "UTILISATEURS", permissions: [
    { key: "users.consulter", label: "Consulter les utilisateurs" },
    { key: "users.gerer", label: "Créer / modifier / supprimer un utilisateur" },
    { key: "users.permissions", label: "Gérer les permissions des autres comptes" },
  ]},
  /*
   * LE TRANSFERT D'ARGENT — le module où une permission de trop coûte de l'argent liquide.
   *
   * Aucune de ces clés n'est accordée à l'Agent par défaut, et c'est délibéré. Créer un transfert,
   * c'est encaisser ; en payer un, c'est sortir des billets d'un tiroir sur présentation d'un
   * code. Ce sont les deux gestes les plus sensibles de toute l'application, et ils ne doivent pas
   * arriver à quelqu'un parce qu'on lui a créé un compte : c'est à l'administrateur de désigner
   * nommément qui envoie et qui paie — les deux ne sont d'ailleurs pas forcément la même personne,
   * ni la même agence.
   *
   * « Revoir le code » existe parce qu'un client perd son reçu. Le code n'est pas conservé en clair
   * dans la base ; le redonner est possible, mais c'est un geste tracé, séparé du reste.
   */
  { group: "TRANSFERT D’ARGENT", permissions: [
    { key: "transfert.creer", label: "Créer un transfert et encaisser l’expéditeur" },
    { key: "transfert.payer", label: "Payer un transfert au bénéficiaire" },
    { key: "transfert.voir_propres", label: "Voir ses propres transferts" },
    { key: "transfert.voir_zone", label: "Voir les transferts de son agence / sa zone" },
    { key: "transfert.voir_tous", label: "Voir tous les transferts (toutes agences)" },
    { key: "transfert.annuler", label: "Annuler un transfert non payé" },
    { key: "transfert.revoir_code", label: "Réafficher le code d’un transfert (geste tracé)" },
    { key: "transfert.caisse", label: "Consulter la caisse des transferts" },
    { key: "transfert.journal", label: "Consulter le journal des transferts" },
    { key: "transfert.config", label: "Régler les frais, les taux, les limites et les commissions" },
  ]},
  { group: "ASSISTANT IA", permissions: [
    { key: "ia.utiliser", label: "Utiliser l’assistant IA" },
  ]},
];

export const ROLE_DEFAULT_PERMISSIONS = {
  "Administrateur": PERMISSIONS_SCHEMA.flatMap((g) => g.permissions.map((p) => p.key)),
  /*
   * LE RESPONSABLE DE ZONE VOIT SA ZONE — c'est le sens même du rôle.
   *
   * Il portait « Voir tous les colis » par défaut. Or c'est cette permission qui commande le
   * cloisonnement : la lui donner d'office revenait à créer un rôle « responsable de zone » qui
   * n'était responsable d'aucune zone en particulier, et le filtrage ne s'appliquait à personne.
   * L'administrateur peut toujours la lui accorder nommément s'il veut qu'il voie tout.
   *
   * « Consulter les utilisateurs » lui manquait, alors qu'il a le droit d'en créer et d'en
   * modifier : l'écran qui sert à cela ne s'ouvrait donc pas pour lui. Un droit accordé qu'aucune
   * porte n'honore est un droit qui n'existe pas.
   */
  "Responsable de zone": ["colis.voir_propres", "colis.creer", "colis.modifier", "colis.changer_statut", "colis.enregistrer_paiement", "colis.importer_excel", "colis.bordereau_reception", "colis.reglement_groupe", "bordereaux.consulter", "bordereaux.creer", "bordereaux.modifier", "bordereaux.valider", "factures.consulter", "factures.creer", "factures.modifier", "paiements.voir_propres", "clients.consulter", "espaceclient.gerer", "stats.personnelles", "equipe.pointage", "users.consulter", "users.gerer", "ia.utiliser",
    /*
     * Le responsable de zone opère les transferts de sa zone : c'est son métier, et il est le
     * recours quand un agent n'est pas là. Il ne règle ni les frais ni les taux — cela reste à
     * l'administrateur, sinon la marge de l'entreprise se décide en agence.
     */
    "transfert.creer", "transfert.payer", "transfert.voir_propres", "transfert.voir_zone", "transfert.caisse"],
  "Agent": ["colis.voir_propres", "colis.voir_tous", "colis.creer", "colis.modifier", "colis.changer_statut", "colis.enregistrer_paiement", "bordereaux.consulter", "bordereaux.creer", "bordereaux.modifier", "bordereaux.valider", "factures.consulter", "factures.creer", "factures.modifier", "paiements.voir_propres", "clients.consulter", "stats.personnelles", "ia.utiliser"],
  /*
   * Le comptable LIT les transferts — il en a besoin pour arrêter les comptes — et n'en opère
   * aucun. Voir tout et ne rien pouvoir déplacer, c'est exactement son rôle.
   */
  "Comptable": ["colis.voir_tous", "factures.consulter", "factures.creer", "factures.modifier", "clients.consulter", "bordereaux.consulter", "compta.consulter", "compta.gerer_depenses", "compta.charges_fixes", "compta.marges", "stats.globales", "stats.exporter", "transfert.voir_tous", "transfert.caisse", "transfert.journal"],
  "Chauffeur": ["colis.voir_propres", "colis.changer_statut", "stats.personnelles"],
  "Partenaire": ["stats.personnelles"],
};

export function effectivePermission(user, key) {
  if (!user) return false;
  if (user.permissionsOverride && Object.prototype.hasOwnProperty.call(user.permissionsOverride, key)) return user.permissionsOverride[key];
  return (ROLE_DEFAULT_PERMISSIONS[user.role] || []).includes(key);
}
