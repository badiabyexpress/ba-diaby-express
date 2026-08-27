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
export async function listerDossier(dossier, plafond = 1000) {
  const trouves = [];
  const parPage = 100;
  for (let page = 0; page * parPage < plafond; page++) {
    const lot = await appelStockage(`object/list/${SEAU}`, {
      method: "POST",
      body: JSON.stringify({ prefix: `${dossier}/`, limit: parPage, offset: page * parPage, sortBy: { column: "name", order: "asc" } }),
    });
    const noms = (Array.isArray(lot) ? lot : []).map((f) => f?.name).filter(Boolean);
    trouves.push(...noms);
    if (noms.length < parPage) break;
  }
  return trouves;
}

/**
 * Efface les documents dont l'adresse se devine.
 *
 * Rend toujours un compte rendu lisible, réussite comme échec : un ménage dont on ne sait pas s'il
 * a eu lieu ne protège de rien — on croit la fuite refermée. Un échec n'interrompt jamais la
 * sauvegarde de nuit, qui compte davantage.
 */
export async function purgerDocumentsDevinables({ simulation = false } = {}) {
  const { url, cle } = configurationBase();
  if (!url || !cle) return { fait: false, raison: "base-non-configuree" };

  const aEffacer = [];
  const parDossier = {};
  for (const dossier of DOSSIERS_A_SURVEILLER) {
    try {
      const noms = await listerDossier(dossier);
      const devinables = noms.filter(nomDevinable).map((nom) => `${dossier}/${nom}`);
      parDossier[dossier] = { total: noms.length, devinables: devinables.length };
      aEffacer.push(...devinables);
    } catch (e) {
      parDossier[dossier] = { erreur: String(e?.message || e).slice(0, 120) };
    }
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
