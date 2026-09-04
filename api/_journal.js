/*
 * LE JOURNAL D'ACTIVITÉ NE JETTE PLUS RIEN — IL ARCHIVE.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce qui existait déjà, et qui est bon : le journal ne se réécrit pas depuis un navigateur. Le
 * serveur n'accepte que des lignes NOUVELLES, réinscrit lui-même leur auteur depuis la session, et
 * remet en place toute ligne que la page aurait omise (voir api/_cloisonnement.js). Une personne
 * ne peut donc ni forger une entrée à un autre nom, ni retirer celle qui la gêne.
 *
 * CE QUI NE L'ÉTAIT PAS : le journal était coupé à cinq cents lignes, et la coupe jetait.
 *
 * Au 4 septembre 2026 il en comptait quatre cent soixante-quinze. Vingt-cinq de plus, et les plus
 * anciennes commençaient à disparaître — sans un mot, et sans que personne l'ait demandé. Or c'est
 * le journal qui dit qui a encaissé, qui a annulé, qui a supprimé : il n'a de valeur que s'il
 * remonte plus loin que le souvenir des gens.
 *
 * Et cette coupe était une porte : le serveur accepte vingt lignes par enregistrement, donc
 * vingt-cinq enregistrements de suite suffisaient à repousser dehors tout ce qui précédait. Celui
 * qui voulait effacer la trace d'un geste n'avait pas à la modifier — il lui suffisait de
 * travailler un moment.
 *
 * D'OÙ CE FICHIER. Ce qui sort de la liste vivante n'est plus jeté : il est déposé dans une clé par
 * mois, `bde-journal-2026-09`. La liste que l'application affiche reste courte — le document entier
 * repart à chaque enregistrement, sur la 4G d'un dépôt, et l'alourdir se paierait à chaque geste
 * d'agent. L'histoire, elle, est intégralement conservée.
 *
 * L'ORDRE DES DEUX ÉCRITURES EST LA SEULE CHOSE QUI COMPTE ICI.
 *
 * On archive D'ABORD, on raccourcit ENSUITE. Si le dépôt échoue, la liste vivante n'est pas
 * touchée et l'on réessaiera demain. L'inverse — raccourcir puis déposer — perdrait tout le jour
 * où l'écriture d'archive échoue, c'est-à-dire précisément le jour où l'on n'y prête pas
 * attention.
 */

import { lireCle, ecrireCle, modifierDocument } from "./_base.js";

/** Au-delà, on archive. En deçà, on ne touche à rien : archiver coûte deux écritures. */
export const SEUIL_ARCHIVAGE = 1200;

/**
 * Ce qui reste consultable dans l'application après l'archivage.
 *
 * Assez pour couvrir plusieurs mois de travail à l'écran — au rythme actuel, environ quatre cent
 * soixante-quinze lignes depuis l'ouverture — et assez peu pour ne pas alourdir chaque
 * enregistrement.
 */
export const GARDE_EN_LIGNE = 800;

const PREFIXE = "bde-journal-";

function liste(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

/**
 * Le mois d'une entrée, « 2026-09 ».
 *
 * Une entrée sans date lisible va dans « inconnu » plutôt que dans le mois courant : la ranger au
 * mauvais endroit serait pire que d'avouer qu'on ne sait pas.
 */
export function moisDe(entree) {
  const brut = entree?.date;
  if (typeof brut !== "string" || brut.length < 7) return "inconnu";
  const mois = brut.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(mois) ? mois : "inconnu";
}

/** Regroupe des entrées par mois d'archive. */
export function repartirParMois(entrees) {
  const parMois = new Map();
  liste(entrees).forEach((e) => {
    const mois = moisDe(e);
    if (!parMois.has(mois)) parMois.set(mois, []);
    parMois.get(mois).push(e);
  });
  return parMois;
}

/**
 * Réunit une archive existante et de nouvelles entrées, sans doublon.
 *
 * Une même ligne peut se présenter deux fois — deux nuits qui se chevauchent, un archivage relancé
 * à la main. L'identifiant tranche ; à défaut, la ligne est gardée telle quelle plutôt que perdue.
 */
export function reunirArchive(existantes, ajouts) {
  const parId = new Map();
  const sansId = [];
  [...liste(existantes), ...liste(ajouts)].forEach((e) => {
    if (e && e.id) parId.set(e.id, e);
    else if (e) sansId.push(e);
  });
  return [...parId.values(), ...sansId]
    .sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
}

/**
 * Dépose hors du document tout ce qui dépasse, puis raccourcit la liste vivante.
 *
 * Rend toujours un compte rendu, réussite comme échec : un archivage dont on ne sait pas s'il a eu
 * lieu ne protège de rien — on croit l'histoire gardée.
 */
export async function archiverJournal({ simulation = false } = {}) {
  let document;
  try {
    const lu = await lireCle("bde-data");
    document = lu?.valeur;
  } catch (e) {
    return { fait: false, raison: "lecture", detail: String(e?.message || e).slice(0, 160) };
  }
  if (!document || typeof document !== "object") return { fait: false, raison: "document-absent" };

  const journal = liste(document.activityLog);
  if (journal.length <= SEUIL_ARCHIVAGE) {
    return { fait: true, archivees: 0, enLigne: journal.length, seuil: SEUIL_ARCHIVAGE };
  }

  const aGarder = journal.slice(0, GARDE_EN_LIGNE);
  const aArchiver = journal.slice(GARDE_EN_LIGNE);
  const parMois = repartirParMois(aArchiver);
  if (simulation) {
    return {
      fait: true, simulation: true, archivees: 0,
      candidates: aArchiver.length,
      mois: [...parMois.keys()].sort(),
      enLigne: journal.length,
    };
  }

  /*
   * PREMIER TEMPS — DÉPOSER. Rien n'est retiré de la liste vivante tant que tout n'est pas déposé.
   */
  const deposees = {};
  for (const [mois, entrees] of parMois) {
    const cle = `${PREFIXE}${mois}`;
    try {
      const existant = await lireCle(cle).then((r) => r?.valeur).catch(() => null);
      const reunies = reunirArchive(liste(existant?.entrees), entrees);
      await ecrireCle(cle, { mois, entrees: reunies, majLe: new Date().toISOString() });
      deposees[mois] = entrees.length;
    } catch (e) {
      /*
       * Un mois qui échoue arrête tout. Raccourcir la liste vivante alors qu'une partie n'est pas
       * déposée, ce serait perdre exactement ce qu'on essaie de garder.
       */
      return {
        fait: false, raison: "depot", mois,
        detail: String(e?.message || e).slice(0, 160),
        deposeesAvantEchec: deposees,
      };
    }
  }

  /*
   * SECOND TEMPS — RACCOURCIR. On relit le document plutôt que de réécrire celui qu'on avait :
   * la tâche tourne à deux heures du matin, mais rien n'interdit à quelqu'un de travailler.
   */
  try {
    const restees = await modifierDocument((actuel) => {
      const vivant = liste(actuel.activityLog);
      const gardes = new Set(aGarder.map((e) => e && e.id).filter(Boolean));
      const archivees = new Set(aArchiver.map((e) => e && e.id).filter(Boolean));
      /*
       * On ne repose pas `aGarder` tel quel : des lignes ont pu s'ajouter depuis la lecture, et les
       * écraser reviendrait à effacer le travail de la nuit. On retire de la liste ACTUELLE celles
       * qu'on vient de déposer, et rien d'autre.
       */
      const suite = vivant.filter((e) => !(e && e.id && archivees.has(e.id) && !gardes.has(e.id)));
      return { document: { ...actuel, activityLog: suite }, retour: suite.length };
    });
    return { fait: true, archivees: aArchiver.length, parMois: deposees, enLigne: restees };
  } catch (e) {
    /*
     * Les archives sont écrites : rien n'est perdu. La liste vivante reste simplement longue une
     * nuit de plus, et le prochain passage la raccourcira.
     */
    return {
      fait: false, raison: "raccourcissement",
      detail: String(e?.message || e).slice(0, 160),
      parMois: deposees, note: "les archives sont déposées, rien n’est perdu",
    };
  }
}
