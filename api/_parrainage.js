/*
 * LE PARRAINAGE — LES RÈGLES, ET RIEN QUE LES RÈGLES.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier ne parle ni au réseau, ni à la base, ni au navigateur. Il ne lit AUCUNE variable
 * d'environnement — `process` n'existe pas dans un navigateur, et src/App.jsx l'importe. C'est la
 * même discipline que api/_permissions.js et api/_fraude.js : une seule table de règles, lue par
 * l'écran ET par le serveur.
 *
 * En recopier une moitié dans le serveur aurait marché le premier jour et divergé le second — et
 * une divergence, ici, s'appelle « une récompense que l'écran affiche et que le serveur refuse ».
 *
 * POURQUOI PAS DE TABLES SQL.
 *
 * Toute l'entreprise tient dans un seul document JSON : les colis, les clients, les factures, la
 * caisse. Il n'existe aucune table relationnelle pour eux. Fabriquer des tables `parrainages` avec
 * clés étrangères aurait créé une seconde base à côté de la première, avec deux vérités à tenir
 * d'accord — exactement l'architecture parallèle qu'il fallait éviter. Les parrainages vivent donc
 * dans le document, comme le reste.
 *
 * CE QUI LES PROTÈGE, PUISQU'IL N'Y A PAS DE CONTRAINTE SQL.
 *
 * Une écriture venue d'un espace client repart toujours de la base et n'y superpose que des listes
 * nommées (voir api/_cloisonnement.js) : une liste que le client ne connaît pas ne peut pas être
 * écrite par lui. C'est plus fort qu'une contrainte d'intégrité — le client ne peut pas même
 * proposer la ligne.
 */

/** La récompense, en francs guinéens. Un seul endroit, pour que personne ne la recopie ailleurs. */
export const MONTANT_RECOMPENSE_GNF = 50000;

/**
 * Les états d'un parrainage, dans l'ordre où on les traverse.
 *
 * `en_attente` — le filleul s'est inscrit avec le code, rien n'est encore gagné.
 * `reception_faite` — l'agent a enregistré sa réception sur un bordereau. C'est le fait, daté et
 *                     signé, qui déclenche tout le reste.
 * `recompense_validee` — le crédit est disponible.
 * `reduction_utilisee` — il a servi sur une commande. Fin du chemin.
 * `annule` — écarté par l'administration, fraude constatée. Un parrainage annulé ne redevient
 *            jamais valide : on en recrée un plutôt que de rouvrir celui-là.
 */
export const ETATS = ["en_attente", "reception_faite", "recompense_validee", "reduction_utilisee", "annule"];

/*
 * L'alphabet des codes : ni I, ni O, ni 0, ni 1.
 *
 * Un code de parrainage se dicte au téléphone et se recopie d'une capture d'écran. « I » lu pour
 * « 1 » sur un code qui vaut 50 000 GNF, c'est un filleul qui n'est rattaché à personne et un
 * parrain qui réclame.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function propre(valeur) {
  return String(valeur ?? "").trim();
}

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

/**
 * Le code tel qu'on l'accepte à la saisie.
 *
 * Majuscules, sans espaces ni tirets : « bde-ab3 k9 » et « BDEAB3K9 » sont le même code. On refuse
 * ce qui n'a pas la bonne forme plutôt que de chercher un rattachement approximatif — rattacher au
 * mauvais parrain coûte plus cher que de redemander le code.
 */
export function normaliserCodeParrainage(saisi) {
  const brut = propre(saisi).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (brut.length < 6 || brut.length > 14) return null;
  return brut;
}

/**
 * Fabrique un code pour un client, unique parmi ceux déjà attribués.
 *
 * Il porte les premières lettres de son prénom : un code qu'on reconnaît comme le sien se partage
 * plus volontiers qu'une suite de caractères. Le reste est tiré au sort — sans quoi deux clients
 * du même prénom se marcheraient dessus, et surtout on devinerait le code des autres.
 *
 * `hasard` est injecté pour que le banc d'essai puisse rejouer exactement la même suite.
 */
export function genererCodeParrainage(prenom, codesExistants = [], hasard = Math.random) {
  const pris = new Set(liste(codesExistants).map((c) => normaliserCodeParrainage(c)).filter(Boolean));
  const racine = propre(prenom).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "BDE";
  for (let essai = 0; essai < 200; essai++) {
    let suffixe = "";
    for (let i = 0; i < 5; i++) suffixe += ALPHABET[Math.floor(hasard() * ALPHABET.length) % ALPHABET.length];
    const code = `${racine}${suffixe}`;
    if (!pris.has(code)) return code;
  }
  /*
   * Deux cents tirages sans trouver de place libre ne peut pas arriver avec trente millions de
   * combinaisons — sauf si `hasard` est cassé. On rend alors un code plus long plutôt que null :
   * un client sans code ne peut plus parrainer, et il ne saurait pas pourquoi.
   */
  return `${racine}${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

/** Le compte client qui porte ce code, ou null. */
export function parrainDuCode(clients, code) {
  const cherche = normaliserCodeParrainage(code);
  if (!cherche) return null;
  return liste(clients).find((c) => c && normaliserCodeParrainage(c.codeParrainage) === cherche) || null;
}

/**
 * PEUT-ON RATTACHER CE FILLEUL À CE PARRAIN ?
 *
 * Rend `{ ok: true }` ou `{ ok: false, raison }`. La raison est faite pour être montrée : un refus
 * qui ne dit pas pourquoi envoie le client appeler l'agence.
 *
 * LES QUATRE REFUS, ET CE QU'ILS ARRÊTENT :
 *
 *   — le code n'existe pas. Dit tel quel : c'est le cas honnête, une faute de frappe.
 *   — AUTO-PARRAINAGE. Se parrainer soi-même, c'est 50 000 GNF pour avoir ouvert un compte.
 *   — le filleul est DÉJÀ rattaché. Un code ne s'associe qu'une fois à un compte ; sans cela, on
 *     change de parrain à chaque visite et l'on collectionne les récompenses avec un seul compte.
 *   — le parrain est lui-même filleul de ce compte. Deux comptes qui se parrainent l'un l'autre,
 *     c'est 100 000 GNF fabriqués à partir de rien.
 */
export function peutRattacher({ clients, parrainages, code, filleulId }) {
  const parrain = parrainDuCode(clients, code);
  if (!parrain) return { ok: false, raison: "Ce code de parrainage n’existe pas. Vérifiez la saisie." };
  if (!filleulId) return { ok: false, raison: "Compte du filleul inconnu." };
  if (parrain.id === filleulId) {
    return { ok: false, raison: "Vous ne pouvez pas utiliser votre propre code de parrainage." };
  }

  const vivants = liste(parrainages).filter((p) => p && p.statut !== "annule");
  if (vivants.some((p) => p.filleulId === filleulId)) {
    return { ok: false, raison: "Ce compte a déjà été rattaché à un parrain. Un seul parrainage par compte." };
  }
  if (vivants.some((p) => p.filleulId === parrain.id && p.parrainId === filleulId)) {
    return { ok: false, raison: "Ces deux comptes se parrainent mutuellement : le parrainage est refusé." };
  }
  return { ok: true, parrain };
}

/** Le parrainage tel qu'il naît : rattaché, et rien de gagné. */
export function creerParrainage({ parrainId, filleulId, code, maintenant = new Date() }) {
  const quand = maintenant instanceof Date ? maintenant.toISOString() : String(maintenant);
  return {
    id: `par${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    code: normaliserCodeParrainage(code),
    parrainId,
    filleulId,
    creeLe: quand,
    statut: "en_attente",
    receptionLe: null,
    receptionTracking: null,
    receptionBordereau: null,
    /*
     * UNE SEULE RÉCOMPENSE, ET ELLE EST POUR CELUI QUI PARRAINE.
     *
     * La personne parrainée ne reçoit rien : c'est elle qu'on cherche à faire venir, pas elle
     * qu'on récompense. La récompense vit dans la ligne du parrainage et nulle part ailleurs —
     * c'est ce qui rend la double attribution impossible : il n'y a qu'un seul endroit à marquer,
     * et il est marqué une fois.
     */
    recompense: { montant: 0, crediteeLe: null, utiliseeLe: null, utiliseeSur: null },
  };
}

/**
 * LA RÉCEPTION QUI DÉCLENCHE TOUT.
 *
 * Elle n'est pas déduite d'un statut ni d'une date : elle vient du bordereau de réception, c'est-
 * à-dire du moment où un agent enregistre qu'un client emporte ses colis. C'est le seul événement
 * de l'application qu'une personne a signé.
 *
 * On ne crédite qu'une fois — `crediteeLe` fait foi. Le cahier des charges nomme la double
 * attribution pour une même première réception comme une fraude à empêcher : la garde est ici, et
 * elle ne dépend pas de l'écran qui appelle.
 */
export function crediterSurReception(parrainages, { clientId, tracking, bordereau, maintenant = new Date() }) {
  const quand = maintenant instanceof Date ? maintenant.toISOString() : String(maintenant);
  let credite = null;
  const suite = liste(parrainages).map((p) => {
    if (credite || !p || p.statut === "annule") return p;
    if (p.statut !== "en_attente") return p;
    /*
     * C'EST LA RÉCEPTION DE LA PERSONNE PARRAINÉE QUI DÉCLENCHE, JAMAIS CELLE DU PARRAIN.
     *
     * Sa première réception est la preuve qu'elle est devenue une vraie cliente — pas seulement un
     * compte ouvert pour faire tomber une prime. Si le parrain pouvait déclencher en retirant ses
     * propres colis, il lui suffirait d'inscrire un proche et de passer au comptoir : on paierait
     * pour un client qui n'est jamais venu.
     */
    if (p.filleulId !== clientId) return p;
    credite = {
      ...p,
      statut: "recompense_validee",
      receptionLe: quand,
      receptionTracking: tracking || null,
      receptionBordereau: bordereau || null,
      recompense: { ...p.recompense, montant: MONTANT_RECOMPENSE_GNF, crediteeLe: quand },
    };
    return credite;
  });
  return { parrainages: suite, credite };
}

/**
 * Le crédit encore disponible pour celui qui parraine, en francs.
 *
 * On additionne les récompenses créditées et non encore utilisées. Un même compte peut avoir
 * parrainé plusieurs personnes : les récompenses s'accumulent, sans plafond.
 */
export function creditDisponible(parrainages, clientId) {
  if (!clientId) return 0;
  return liste(parrainages).reduce((total, p) => {
    if (!p || p.statut === "annule" || p.parrainId !== clientId) return total;
    if (!p.recompense?.crediteeLe || p.recompense?.utiliseeLe) return total;
    return total + (Number(p.recompense.montant) || 0);
  }, 0);
}

/**
 * CONSOMME LE CRÉDIT SUR UNE SOMME À PAYER.
 *
 * Rend ce qu'il reste à régler, ce qui a été déduit, et les parrainages marqués. On ne déduit
 * jamais plus que la somme due : une réduction plus grande que la commande ne rend pas de monnaie,
 * et le reliquat demeure disponible pour la fois suivante.
 *
 * Les récompenses sont consommées de la plus ancienne à la plus récente — celle qui attend depuis
 * le plus longtemps sert d'abord.
 */
export function consommerCredit(parrainages, { clientId, montantDu, reference, maintenant = new Date() }) {
  const quand = maintenant instanceof Date ? maintenant.toISOString() : String(maintenant);
  const du = Number(montantDu) || 0;
  const suite = [...liste(parrainages)];
  if (!clientId || du <= 0) {
    return { parrainages: suite, deduit: 0, reste: Math.max(0, du), utilises: [] };
  }

  const candidats = suite
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p && p.statut !== "annule" && p.parrainId === clientId
      && p.recompense?.crediteeLe && !p.recompense?.utiliseeLe)
    .sort((a, b) => String(a.p.recompense.crediteeLe).localeCompare(String(b.p.recompense.crediteeLe)));

  let restant = du;
  let deduit = 0;
  const utilises = [];

  candidats.forEach(({ p, index }) => {
    const montant = Number(p.recompense.montant) || 0;
    /*
     * UNE RÉCOMPENSE NE SE COUPE PAS EN DEUX.
     *
     * La partager laisserait des restes de quelques francs impossibles à expliquer au comptoir, et
     * rendrait « utilisée » un état à moitié vrai. Si elle ne tient pas dans la somme due, elle
     * attend la prochaine fois — entière.
     */
    if (montant <= 0 || montant > restant) return;
    suite[index] = {
      ...p,
      statut: "reduction_utilisee",
      recompense: { ...p.recompense, utiliseeLe: quand, utiliseeSur: reference || null },
    };
    restant -= montant;
    deduit += montant;
    utilises.push({ parrainageId: p.id, montant });
  });

  return { parrainages: suite, deduit, reste: Math.max(0, du - deduit), utilises };
}

/**
 * Le compte rendu d'un parrain : combien il a invité, combien ont abouti, ce qu'il a gagné.
 *
 * Les chiffres que l'écran affiche viennent d'ici et non de filtres recopiés dans la page :
 * plusieurs calculs séparés finissent toujours par ne plus dire la même chose.
 */
export function bilanParrainage(parrainages, clientId) {
  const miens = liste(parrainages).filter((p) => p && p.parrainId === clientId);
  const vivants = miens.filter((p) => p.statut !== "annule");
  return {
    invites: vivants.length,
    enAttente: vivants.filter((p) => p.statut === "en_attente").length,
    valides: vivants.filter((p) => p.statut === "recompense_validee" || p.statut === "reduction_utilisee").length,
    annules: miens.filter((p) => p.statut === "annule").length,
    creditDisponible: creditDisponible(parrainages, clientId),
    creditUtilise: vivants.reduce((t, p) => t + (p.recompense?.utiliseeLe ? Number(p.recompense.montant) || 0 : 0), 0),
  };
}

/**
 * Annule un parrainage — fraude constatée.
 *
 * Un parrainage annulé ne redevient jamais valide, et son crédit cesse de compter : `creditDisponible`
 * et `consommerCredit` écartent tout ce qui porte ce statut. Si la réduction avait DÉJÀ été
 * utilisée, l'annulation ne la reprend pas — l'argent est parti, et le prétendre récupéré serait
 * plus faux encore. Le motif et l'auteur sont conservés : une annulation sans raison écrite est
 * une décision que personne ne peut plus expliquer six mois plus tard.
 */
export function annulerParrainage(parrainages, { id, par, motif, maintenant = new Date() }) {
  const quand = maintenant instanceof Date ? maintenant.toISOString() : String(maintenant);
  return liste(parrainages).map((p) => (p && p.id === id
    ? { ...p, statut: "annule", annuleLe: quand, annulePar: par || null, motifAnnulation: String(motif || "").slice(0, 300) }
    : p));
}
