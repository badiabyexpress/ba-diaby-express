/*
 * LE MÉNAGE DES DOCUMENTS DONT L'ADRESSE SE DEVINE
 * ────────────────────────────────────────────────
 * L'espace de stockage `colis-documents` est public en lecture, et il doit l'être : Meta va
 * chercher la facture lui-même, sans identifiant, pour la joindre au message WhatsApp. Un espace
 * fermé ferait échouer l'envoi entier — le client ne recevrait rien.
 *
 * Ce n'est donc pas l'ouverture qui posait problème, c'est le NOM. Les factures s'appelaient
 * `factures/BDE270808.pdf`, les étiquettes `etiquettes/BDE240806.pdf` : le numéro de suivi, tout
 * simplement. Or ces numéros se suivent — BDE270801, BDE270802, BDE270803… — et ils sont imprimés
 * sur le carton, écrits dans chaque message au client, lus par tous ceux qui manipulent le colis.
 * Quiconque en connaissait UN pouvait deviner les autres et télécharger la pièce correspondante :
 * nom, téléphone, adresse, contenu du colis, valeur déclarée. Aucune effraction, aucune trace —
 * deux chiffres à changer dans une adresse.
 *
 * L'application ne fabrique plus de tels noms : chaque facture porte désormais un jeton tiré au
 * sort. Restent celles déposées avant, qui ne disparaîtront d'elles-mêmes que si l'on repasse un
 * jour sur le colis — ce qui n'arrivera jamais pour un colis déjà remis. Ce fichier les efface.
 *
 * POURQUOI DEPUIS LE SERVEUR. La suppression demande la clé de service : le navigateur ne l'a pas,
 * et ne doit pas l'avoir. La tâche de nuit, elle, l'a déjà.
 *
 * POURQUOI ON PEUT EFFACER SANS RIEN CASSER. Une pièce jointe partie n'a plus besoin de sa source :
 * WhatsApp garde sa propre copie du document dès qu'il l'a récupéré, et c'est celle-là que le
 * client rouvre dans sa conversation. Et rien n'est perdu : une facture se regénère à tout moment
 * depuis la fiche du colis — ce n'est pas une archive, c'est un tirage.
 */

import { configurationBase } from "./_base.js";

const SEAU = "colis-documents";

/* Les deux dossiers qui ont porté des noms devinables. Les images ont toujours eu un nom au hasard. */
export const DOSSIERS_A_SURVEILLER = ["factures", "etiquettes"];

/*
 * Un nom est protégé s'il porte un jeton : « BDE270808-3f9a…c1.pdf ».
 *
 * Tout le reste — « BDE270808.pdf » — se déduit du seul numéro de suivi, et part.
 */
const JETON = /-[0-9a-f]{12,}\.[a-z0-9]+$/i;

export function nomDevinable(nom) {
  if (typeof nom !== "string" || !nom) return false;
  return !JETON.test(nom);
}

async function appelStockage(chemin, options = {}) {
  const { url, cle } = configurationBase();
  const reponse = await fetch(`${url}/storage/v1/${chemin}`, {
    ...options,
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`stockage_${reponse.status}:${detail.slice(0, 160)}`);
  }
  return reponse.json().catch(() => null);
}

/** Ce que contient un dossier du stockage, page par page — un dossier peut compter des milliers de pièces. */
export async function listerEntrees(dossier, plafond = 1000) {
  const trouves = [];
  const parPage = 100;
  for (let page = 0; page * parPage < plafond; page++) {
    const lot = await appelStockage(`object/list/${SEAU}`, {
      method: "POST",
      body: JSON.stringify({ prefix: `${dossier}/`, limit: parPage, offset: page * parPage, sortBy: { column: "name", order: "asc" } }),
    });
    const entrees = (Array.isArray(lot) ? lot : []).filter((f) => f?.name);
    trouves.push(...entrees.map((f) => ({ nom: f.name, creeLe: f.created_at || f.updated_at || null })));
    if (entrees.length < parPage) break;
  }
  return trouves;
}

/** Les seuls noms, pour qui n'a pas besoin des dates. */
export async function listerDossier(dossier, plafond = 1000) {
  return (await listerEntrees(dossier, plafond)).map((e) => e.nom);
}

/*
 * CE QUE LE NAVIGATEUR NE PEUT PLUS FAIRE, ET QUE LE SERVEUR REPREND.
 * ─────────────────────────────────────────────────────────────────────────────
 * Le seau des documents était ouvert au public en lecture ET en suppression : la clé « anon » est
 * dans le JavaScript du site, et cette clé permettait de lister toutes les factures, de les
 * remplacer, ou de tout effacer. La porte est refermée — le navigateur ne peut plus que déposer.
 *
 * Mais il se servait de ce droit pour deux ménages légitimes : effacer la facture remplacée quand
 * on en réédite une, et effacer les photos de pièces d'identité des colis remis depuis longtemps.
 * Le second compte : ce sont des documents d'identité, et ne plus les effacer serait les garder
 * indéfiniment.
 *
 * Ces deux ménages passent donc ici, dans la tâche de nuit, qui détient la clé de service.
 */

/** Le tronc commun d'un document : « factures/BDE030906-fca10586.pdf » → « BDE030906 ». */
function trackingDuNom(nom) {
  const base = String(nom).replace(/\.[a-z0-9]+$/i, "");
  const tiret = base.lastIndexOf("-");
  return tiret > 0 ? base.slice(0, tiret) : base;
}

/**
 * Les factures et étiquettes REMPLACÉES — on ne garde que la dernière de chaque colis.
 *
 * Rééditer une facture en dépose une nouvelle sans retirer l'ancienne. Or l'ancienne annonçait
 * peut-être un autre montant, et son adresse reste valable pour qui l'a relevée : c'est la version
 * fausse qui resterait consultable pour toujours.
 */
function perimeesDansDossier(entrees, dossier) {
  const parTracking = new Map();
  entrees.forEach((e) => {
    const clef = trackingDuNom(e.nom);
    if (!parTracking.has(clef)) parTracking.set(clef, []);
    parTracking.get(clef).push(e);
  });
  const aEffacer = [];
  parTracking.forEach((lot) => {
    if (lot.length < 2) return;
    /* La plus récente reste ; une entrée sans date est traitée comme la plus ancienne. */
    const trie = [...lot].sort((a, b) => new Date(b.creeLe || 0) - new Date(a.creeLe || 0));
    trie.slice(1).forEach((e) => aEffacer.push(`${dossier}/${e.nom}`));
  });
  return aEffacer;
}

/*
 * Une image déposée il y a trente secondes n'a pas encore sa référence enregistrée : l'agent est
 * encore en train de remplir la fiche. Sans ce délai, la tâche de nuit effacerait la photo qu'il
 * vient de prendre.
 */
const JOURS_AVANT_ORPHELINE = 7;

/**
 * Les images que plus aucune fiche ne cite.
 *
 * On cherche le nom du fichier dans le document entier, pas dans les champs qu'on croit connaître :
 * une photo peut être citée par un colis, un contrat, une pièce d'identité, un logo de partenaire.
 * Se fier à une liste de champs, c'est effacer le jour où quelqu'un en ajoute un. Le nom porte un
 * jeton tiré au sort — le chercher dans le texte ne peut pas se tromper de fichier.
 *
 * Et l'erreur ne va que dans un sens : un fichier encore cité est gardé. On ne supprime que ce dont
 * on est certain.
 */
function orphelinesDansDossier(entrees, texteDuDocument, dossier, maintenant = Date.now()) {
  const limite = maintenant - JOURS_AVANT_ORPHELINE * 86400000;
  return entrees
    .filter((e) => {
      const date = e.creeLe ? new Date(e.creeLe).getTime() : 0;
      /* Sans date connue, on s'abstient : mieux vaut un fichier de trop qu'une photo perdue. */
      if (!date || date > limite) return false;
      return !texteDuDocument.includes(e.nom);
    })
    .map((e) => `${dossier}/${e.nom}`);
}

/**
 * Efface les documents dont l'adresse se devine.
 *
 * Rend toujours un compte rendu lisible, réussite comme échec : un ménage dont on ne sait pas s'il
 * a eu lieu ne protège de rien — on croit la fuite refermée. Un échec n'interrompt jamais la
 * sauvegarde de nuit, qui compte davantage.
 */
export async function purgerDocumentsDevinables({ simulation = false, document = null } = {}) {
  const { url, cle } = configurationBase();
  if (!url || !cle) return { fait: false, raison: "base-non-configuree" };

  const aEffacer = [];
  const parDossier = {};
  for (const dossier of DOSSIERS_A_SURVEILLER) {
    try {
      const entrees = await listerEntrees(dossier);
      const devinables = entrees.filter((e) => nomDevinable(e.nom)).map((e) => `${dossier}/${e.nom}`);
      const perimees = perimeesDansDossier(entrees, dossier);
      parDossier[dossier] = { total: entrees.length, devinables: devinables.length, perimees: perimees.length };
      aEffacer.push(...devinables, ...perimees);
    } catch (e) {
      parDossier[dossier] = { erreur: String(e?.message || e).slice(0, 120) };
    }
  }

  /*
   * LES PHOTOS QUE PLUS AUCUNE FICHE NE CITE.
   *
   * Sans le document, on ne sait pas ce qui est cité : on ne touche alors à rien. Effacer sur un
   * document vide reviendrait à vider le dossier des images d'un seul coup — exactement le geste
   * qu'on ne peut pas rattraper.
   */
  if (document && typeof document === "object") {
    try {
      const texte = JSON.stringify(document);
      const entrees = await listerEntrees("images");
      const orphelines = orphelinesDansDossier(entrees, texte, "images");
      parDossier.images = { total: entrees.length, orphelines: orphelines.length };
      aEffacer.push(...orphelines);
    } catch (e) {
      parDossier.images = { erreur: String(e?.message || e).slice(0, 120) };
    }
  } else {
    parDossier.images = { ignore: "document-absent" };
  }

  if (aEffacer.length === 0) return { fait: true, effaces: 0, parDossier };
  if (simulation) return { fait: true, simulation: true, effaces: 0, aEffacer, parDossier };

  try {
    /* Par paquets : une liste de plusieurs centaines de chemins se fait refuser d'un bloc. */
    let effaces = 0;
    for (let i = 0; i < aEffacer.length; i += 50) {
      const paquet = aEffacer.slice(i, i + 50);
      await appelStockage(`object/${SEAU}`, { method: "DELETE", body: JSON.stringify({ prefixes: paquet }) });
      effaces += paquet.length;
    }
    return { fait: true, effaces, parDossier };
  } catch (e) {
    return { fait: false, raison: "suppression", detail: String(e?.message || e).slice(0, 160), candidats: aEffacer.length, parDossier };
  }
}
