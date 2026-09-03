/**
 * TRANSFERT D'ARGENT — le socle serveur.
 *
 * POURQUOI TOUT LE CALCUL EST ICI, ET RIEN DANS LE NAVIGATEUR
 * -----------------------------------------------------------
 * L'écran affiche un aperçu — frais, taux, montant à recevoir — pour que l'agent puisse annoncer
 * un prix au client avant de valider. Cet aperçu est un confort, PAS une source. Le serveur
 * recalcule tout à partir du barème enregistré, et n'utilise jamais les chiffres envoyés par la
 * page : sinon il suffirait d'ouvrir les outils de développement pour s'envoyer un million de
 * francs avec zéro franc de frais. C'est la règle numéro un d'un module d'argent, et elle ne
 * souffre aucune exception « pour aller plus vite ».
 *
 * LE CODE DE RETRAIT
 * ------------------
 * C'est de l'argent au porteur : qui le connaît peut encaisser. Il n'est donc jamais écrit en
 * clair dans la base. On y range deux choses :
 *
 *   — son empreinte (SHA-256 salé), sous contrainte d'unicité : c'est par elle qu'on retrouve le
 *     transfert au comptoir, et c'est elle qui garantit que deux transferts ne portent jamais le
 *     même code ;
 *   — sa version chiffrée (AES-256-GCM), pour qu'un agent autorisé puisse le redonner au client
 *     qui a perdu son reçu — chaque relecture étant inscrite au journal.
 *
 * Le sel et la clé sont dérivés du même secret que les jetons de session : une variable
 * d'environnement de plus, c'est une variable de plus à oublier le jour du déploiement, et un
 * module d'argent à moitié configuré est pire qu'un module absent.
 *
 * HUIT CHIFFRES, ET CE QUE CELA VAUT VRAIMENT
 * -------------------------------------------
 * Cent millions de combinaisons. Ce n'est pas une clé cryptographique, et il ne faut pas le
 * présenter comme telle : c'est le format qu'un client peut lire au téléphone à sa famille, et
 * c'est ce qui le rend utilisable. Ce qui le protège n'est pas sa longueur mais le plafond
 * d'essais posé sur la recherche par code (voir api/transferts.js) : sans plafond, huit chiffres
 * se parcourent ; avec, il faudrait des années et cela se verrait dès la première heure.
 */

import crypto from "node:crypto";

/* ══════════════════════════════════════════════════════════════════════════════
   LE SECRET
   ══════════════════════════════════════════════════════════════════════════════ */

function secretRacine() {
  const explicite = process.env.SESSION_SECRET;
  if (explicite) return Buffer.from(explicite);
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return null;
  return crypto.createHmac("sha256", service).update("bde-session-v1").digest();
}

function cleDerivee(usage) {
  const racine = secretRacine();
  if (!racine) return null;
  return crypto.createHmac("sha256", racine).update(usage).digest();
}

export function secretDisponible() {
  return !!secretRacine();
}

/* ══════════════════════════════════════════════════════════════════════════════
   LE CODE DE RETRAIT
   ══════════════════════════════════════════════════════════════════════════════ */

export const PREFIXE_CODE = "TRF-";

/**
 * Huit chiffres tirés uniformément.
 *
 * `randomInt` puise dans le générateur cryptographique et corrige le biais du modulo — un
 * `Math.random()` mis à l'échelle produirait des codes prévisibles depuis un seul autre code, ce
 * qui, ici, se traduit par de l'argent retiré par quelqu'un d'autre.
 */
export function genererCode() {
  return PREFIXE_CODE + String(crypto.randomInt(0, 100000000)).padStart(8, "0");
}

/** Forme canonique : on accepte « trf 4827 3195 », « 48273195 », « TRF-48273195 ». */
export function normaliserCode(brut) {
  const chiffres = String(brut || "").replace(/\D/g, "");
  if (chiffres.length !== 8) return null;
  return PREFIXE_CODE + chiffres;
}

export function empreinteCode(code) {
  const cle = cleDerivee("bde-transfert-code-v1");
  if (!cle) return null;
  return crypto.createHmac("sha256", cle).update(String(code)).digest("hex");
}

/** Chiffrement réversible du code — sel aléatoire par message, et marque d'authenticité. */
export function chiffrerCode(code) {
  const cle = cleDerivee("bde-transfert-chiffre-v1");
  if (!cle) return null;
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv("aes-256-gcm", cle, iv);
  const corps = Buffer.concat([chiffreur.update(String(code), "utf8"), chiffreur.final()]);
  return [iv.toString("base64"), corps.toString("base64"), chiffreur.getAuthTag().toString("base64")].join(".");
}

export function dechiffrerCode(paquet) {
  const cle = cleDerivee("bde-transfert-chiffre-v1");
  if (!cle || typeof paquet !== "string") return null;
  const morceaux = paquet.split(".");
  if (morceaux.length !== 3) return null;
  try {
    const dechiffreur = crypto.createDecipheriv("aes-256-gcm", cle, Buffer.from(morceaux[0], "base64"));
    dechiffreur.setAuthTag(Buffer.from(morceaux[2], "base64"));
    return Buffer.concat([dechiffreur.update(Buffer.from(morceaux[1], "base64")), dechiffreur.final()]).toString("utf8");
  } catch (e) {
    // Paquet altéré ou clé changée : on ne rend rien plutôt qu'un code faux.
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   LE BARÈME — frais, taux, limites, commissions
   ══════════════════════════════════════════════════════════════════════════════ */

/*
 * Les réglages par défaut, appliqués tant que l'administrateur n'a rien saisi.
 *
 * Ils ne sont PAS un barème commercial : ce sont des valeurs neutres qui permettent au module de
 * fonctionner et d'être essayé sans rien casser. Un opérateur les remplace le premier jour.
 */
export const CONFIG_TRANSFERT_DEFAUT = {
  actif: true,
  validiteJours: 30,
  devisesEnvoi: ["EUR", "GNF", "USD", "XOF"],
  devisesReception: ["GNF", "EUR", "USD", "XOF"],
  /*
   * Un taux maison par couple de devises. Il l'emporte sur les taux du marché, et c'est voulu :
   * un opérateur de transfert vend sa devise à SON taux, marge comprise. Un couple absent retombe
   * sur les taux de l'application.
   */
  taux: {},
  /*
   * Le barème des frais, par devise d'envoi, en tranches sur le montant envoyé. La première
   * tranche dont le plafond n'est pas dépassé s'applique ; au-delà de la dernière, la dernière.
   * `type` vaut « fixe » (un montant) ou « pourcent » (une part du montant envoyé).
   */
  bareme: {},
  /* Un plancher et un plafond par devise d'envoi. */
  limites: {},
  /*
   * La répartition des frais, en pourcentage. Ce que l'entreprise garde est ce qui reste :
   * le réseau n'est pas un poste à saisir, il se déduit.
   */
  commissions: { agentEnvoi: 0, agentPaiement: 0, agence: 0 },
};

export function configTransfert(document) {
  const brut = document?.transfertConfig;
  if (!brut || typeof brut !== "object") return { ...CONFIG_TRANSFERT_DEFAUT };
  return {
    ...CONFIG_TRANSFERT_DEFAUT,
    ...brut,
    taux: { ...(brut.taux || {}) },
    bareme: { ...(brut.bareme || {}) },
    limites: { ...(brut.limites || {}) },
    commissions: { ...CONFIG_TRANSFERT_DEFAUT.commissions, ...(brut.commissions || {}) },
  };
}

/*
 * Les devises sans centimes. Un montant en francs guinéens ne se règle pas au centime : arrondir
 * à deux décimales produirait un « 1 080 000,37 GNF » qu'aucun caissier ne peut compter.
 */
const DEVISES_SANS_DECIMALE = new Set(["GNF", "XOF", "XAF", "JPY", "KRW"]);

export function arrondirMontant(montant, devise) {
  const n = Number(montant) || 0;
  if (DEVISES_SANS_DECIMALE.has(String(devise).toUpperCase())) return Math.round(n);
  return Math.round(n * 100) / 100;
}

/**
 * Le taux appliqué à un couple de devises.
 *
 * Priorité au taux maison ; à défaut, la table de l'application (`exchangeRates`), qui exprime
 * combien d'unités valent un euro. Rendre null plutôt qu'un 1 par défaut : un taux inventé
 * transforme cent euros en cent francs, et c'est le genre d'erreur qu'on ne rattrape pas.
 */
export function tauxApplique(config, document, deviseEnvoi, deviseReception) {
  const de = String(deviseEnvoi || "").toUpperCase();
  const vers = String(deviseReception || "").toUpperCase();
  if (!de || !vers) return null;
  if (de === vers) return 1;

  const maison = Number(config?.taux?.[`${de}>${vers}`]);
  if (maison > 0) return maison;

  const table = { EUR: 1, ...(document?.exchangeRates || {}) };
  const parEuroDe = Number(table[de]);
  const parEuroVers = Number(table[vers]);
  if (!(parEuroDe > 0) || !(parEuroVers > 0)) return null;
  return parEuroVers / parEuroDe;
}

/**
 * Les frais, lus dans le barème de la devise d'envoi.
 *
 * Une tranche mal saisie — bornes qui se chevauchent, plafond manquant — ne doit pas produire des
 * frais nuls en silence : on prend la première tranche qui couvre le montant, et à défaut la
 * dernière, qui est celle des gros montants.
 */
export function fraisPourMontant(config, deviseEnvoi, montant) {
  const tranches = config?.bareme?.[String(deviseEnvoi || "").toUpperCase()];
  if (!Array.isArray(tranches) || tranches.length === 0) return 0;
  const m = Number(montant) || 0;
  const ordonnees = [...tranches].sort((a, b) => (Number(a.min) || 0) - (Number(b.min) || 0));
  const tranche = ordonnees.find((t) => {
    const min = Number(t.min) || 0;
    const max = t.max === "" || t.max == null ? Infinity : Number(t.max);
    return m >= min && m <= max;
  }) || ordonnees[ordonnees.length - 1];
  const valeur = Number(tranche.valeur) || 0;
  const frais = tranche.type === "pourcent" ? (m * valeur) / 100 : valeur;
  return arrondirMontant(Math.max(0, frais), deviseEnvoi);
}

/**
 * Le devis complet — la seule fonction qui décide de l'argent.
 *
 * Elle rend un objet ou une raison de refus. Elle est exportée et pure : elle se vérifie sans
 * base de données ni navigateur, ce qui est le minimum pour du calcul de frais.
 */
export function calculerTransfert(config, document, { deviseEnvoi, deviseReception, montantEnvoye }) {
  const de = String(deviseEnvoi || "").toUpperCase();
  const vers = String(deviseReception || "").toUpperCase();
  const montant = Number(montantEnvoye);

  if (!de || !vers) return { erreur: "Choisissez la devise d’envoi et la devise de réception." };
  if (!(montant > 0)) return { erreur: "Le montant envoyé doit être supérieur à zéro." };

  const taux = tauxApplique(config, document, de, vers);
  if (!(taux > 0)) {
    return { erreur: `Aucun taux n’est réglé pour ${de} → ${vers}. Réglez-le avant d’envoyer.` };
  }

  const limites = config?.limites?.[de] || {};
  const min = Number(limites.min) || 0;
  const max = Number(limites.max) || 0;
  if (min > 0 && montant < min) return { erreur: `Le montant minimum d’un envoi en ${de} est de ${min}.` };
  if (max > 0 && montant > max) return { erreur: `Le montant maximum d’un envoi en ${de} est de ${max}.` };

  const montantEnvoyeArrondi = arrondirMontant(montant, de);
  const frais = fraisPourMontant(config, de, montantEnvoyeArrondi);
  const totalPaye = arrondirMontant(montantEnvoyeArrondi + frais, de);
  const montantARecevoir = arrondirMontant(montantEnvoyeArrondi * taux, vers);

  if (!(montantARecevoir > 0)) {
    return { erreur: "Le montant à recevoir tombe à zéro — vérifiez le taux appliqué." };
  }

  /*
   * Les commissions se prennent sur les FRAIS, jamais sur le principal : le principal appartient
   * au bénéficiaire, et en prélever une part reviendrait à lui remettre moins que le reçu ne
   * l'annonce. Ce que garde le réseau est le reste, pour que la somme fasse toujours exactement
   * les frais encaissés.
   */
  const c = config?.commissions || {};
  const part = (pourcent) => arrondirMontant((frais * (Number(pourcent) || 0)) / 100, de);
  const commissionAgentEnvoi = part(c.agentEnvoi);
  const commissionAgentPaiement = part(c.agentPaiement);
  const commissionAgence = part(c.agence);
  const commissionReseau = arrondirMontant(
    Math.max(0, frais - commissionAgentEnvoi - commissionAgentPaiement - commissionAgence), de,
  );

  return {
    deviseEnvoi: de,
    deviseReception: vers,
    montantEnvoye: montantEnvoyeArrondi,
    taux,
    frais,
    totalPaye,
    montantARecevoir,
    commissionAgentEnvoi,
    commissionAgentPaiement,
    commissionAgence,
    commissionReseau,
  };
}

/** La date au-delà de laquelle le code ne vaut plus rien. */
export function dateExpiration(config, maintenant = Date.now()) {
  const jours = Number(config?.validiteJours) > 0 ? Number(config.validiteJours) : 30;
  return new Date(maintenant + jours * 86400000).toISOString();
}

/* ══════════════════════════════════════════════════════════════════════════════
   QUI VOIT QUOI
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * La portée de lecture d'un compte, dans l'ordre où elle s'élargit.
 *
 * Ce n'est pas un filtre d'affichage : c'est ce que le serveur accepte de sortir de la base. Un
 * agent qui demande la liste sans portée n'obtient rien, pas « tout par défaut ».
 */
export function porteeLecture(effective, compte) {
  if (effective(compte, "transfert.voir_tous")) return { portee: "tous" };
  if (effective(compte, "transfert.voir_zone")) {
    const zone = String(compte?.zoneOperation || compte?.agence || "").trim();
    if (zone) return { portee: "zone", zone };
  }
  if (effective(compte, "transfert.voir_propres")) return { portee: "propres", id: compte?.id };
  return { portee: "aucune" };
}

/**
 * Ce qu'on montre du transfert au bénéficiaire et à l'agent payeur AVANT paiement.
 *
 * Ni le code, ni le numéro de pièce de l'expéditeur : l'agent payeur n'a pas à connaître l'un
 * (il lui est présenté, il ne le devine pas) et n'a aucun usage de l'autre. Ce qu'il lui faut,
 * c'est de quoi reconnaître le bénéficiaire et savoir combien remettre.
 */
export function vueAvantPaiement(t) {
  if (!t) return null;
  return {
    id: t.id,
    reference: t.reference,
    statut: t.statut,
    expediteur: `${t.exp_nom} ${t.exp_prenom}`.trim(),
    expediteurTelephone: t.exp_telephone,
    beneficiaire: `${t.ben_nom} ${t.ben_prenom}`.trim(),
    beneficiaireTelephone: t.ben_telephone,
    beneficiairePays: t.ben_pays,
    beneficiaireVille: t.ben_ville,
    beneficiaireAgence: t.ben_agence,
    montantARecevoir: Number(t.montant_a_recevoir),
    deviseReception: t.devise_reception,
    montantEnvoye: Number(t.montant_envoye),
    deviseEnvoi: t.devise_envoi,
    frais: Number(t.frais),
    taux: Number(t.taux),
    creeLe: t.cree_le,
    creePar: t.cree_par_nom,
    agenceEnvoi: t.agence_envoi,
    expireLe: t.expire_le,
    payeLe: t.paye_le,
    payePar: t.paye_par_nom,
    agencePaiement: t.agence_paiement,
    annuleLe: t.annule_le,
    motifAnnulation: t.motif_annulation,
  };
}

/**
 * Ce que voit le PUBLIC en suivant son transfert — l'expéditeur qui vérifie, ou le bénéficiaire
 * qui veut savoir s'il peut passer. Ni téléphone, ni pièce d'identité, ni nom complet de l'autre
 * partie : un code tapé au hasard ne doit jamais renseigner sur des inconnus.
 */
export function vuePubliqueTransfert(t) {
  if (!t) return null;
  const initiales = (nom, prenom) => `${String(nom || "").trim()} ${String(prenom || "").trim().charAt(0)}`.trim()
    + (String(prenom || "").trim() ? "." : "");
  return {
    reference: t.reference,
    statut: t.statut,
    expediteur: initiales(t.exp_nom, t.exp_prenom),
    beneficiaire: initiales(t.ben_nom, t.ben_prenom),
    destination: [t.ben_ville, t.ben_pays].filter(Boolean).join(", "),
    montantARecevoir: Number(t.montant_a_recevoir),
    deviseReception: t.devise_reception,
    creeLe: t.cree_le,
    expireLe: t.expire_le,
    payeLe: t.paye_le,
    agencePaiement: t.statut === "Payé" ? t.agence_paiement : null,
  };
}
