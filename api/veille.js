/**
 * Fonction serverless Vercel — la sauvegarde de nuit, qui ne dépend de personne.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Toute l'entreprise tient dans un seul document JSON : les colis, les clients, la caisse, les
 * factures, les comptes. Il existait bien une sauvegarde quotidienne — mais elle se déclenchait
 * depuis le NAVIGATEUR, au chargement de l'application, et seulement là. Autrement dit : elle
 * supposait que quelqu'un ouvre l'application ce jour-là.
 *
 * C'est précisément la supposition qui tombe quand on en a le plus besoin. L'agence ferme une
 * semaine, personne ne se connecte, et il n'existe aucune copie de cette semaine. Une fausse
 * manœuvre le lundi matin efface alors un travail vieux de huit jours. Pire : l'écran de
 * Configuration annonçait « la première sera créée à la prochaine ouverture » — une promesse que
 * rien ne tenait tant que cette ouverture n'avait pas lieu.
 *
 * Cette fonction fait le même geste, mais depuis le serveur, à heure fixe, que quelqu'un ouvre
 * l'application ou non. Elle est appelée par la tâche planifiée déclarée dans vercel.json.
 *
 * CE QU'ELLE REFUSE DE FAIRE
 * --------------------------
 * Elle ne sauvegarde pas n'importe quoi. Un document vide ou tronqué — une lecture partielle, une
 * base en cours de migration — recopié tel quel occuperait la place du jour ET pousserait une
 * bonne copie hors de la fenêtre de conservation. Une sauvegarde qui chasse les bonnes est pire
 * que pas de sauvegarde du tout : on croit être protégé. Elle vérifie donc que ce qu'elle tient
 * ressemble au document de l'entreprise avant d'en garder une copie, et ne purge jamais rien tant
 * que la copie du jour n'est pas écrite.
 */
import { configurationBase, baseConfiguree, lireCle, ecrireCle, modifierDocument } from "./_base.js";
import { ENTETE_INTERNE, jetonInterne, refusSaufEquipe } from "./_session.js";
import { chiffresDuJour, envoyerBilanEmail, envoyerBilanWhatsApp } from "./_bilan.js";
import { envoyerCopieHorsBase } from "./_copie.js";
import crypto from "node:crypto";

const PREFIXE = "bde-backup-";
/* La même fenêtre que la sauvegarde du navigateur : deux règles différentes se contrediraient. */
const JOURS_CONSERVES = 14;
const TABLE = "bde_data";

/** La clé du jour, en heure de Conakry — qui est l'heure universelle, sans décalage ni été. */
export function cleDuJour(maintenant = new Date()) {
  return `${PREFIXE}${maintenant.toISOString().slice(0, 10)}`;
}

/**
 * Ce document ressemble-t-il à celui de l'entreprise ?
 *
 * On ne cherche pas à le valider entièrement — ce serait une deuxième définition du format, qui
 * dériverait de la première. On vérifie ce qui ne peut pas manquer : c'est un objet, il porte une
 * équipe, et cette équipe n'est pas vide. Un document sans un seul compte n'est pas un document
 * de travail : c'est une lecture qui a mal tourné.
 */
export function documentPlausible(valeur) {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return false;
  if (!Array.isArray(valeur.users) || valeur.users.length === 0) return false;
  /* Les colis peuvent légitimement être absents le premier jour, mais pas d'un autre type. */
  if (valeur.colis !== undefined && !Array.isArray(valeur.colis)) return false;
  return true;
}

/**
 * Les clés à effacer : les plus anciennes au-delà de la fenêtre.
 *
 * Le tri est alphabétique, ce qui suffit puisque les dates sont écrites AAAA-MM-JJ. On ne rend
 * que ce qui dépasse — jamais la liste entière, même si elle paraît absurde.
 */
export function clesAPurger(cles, aGarder = JOURS_CONSERVES) {
  const propres = (Array.isArray(cles) ? cles : []).filter((k) => typeof k === "string" && k.startsWith(PREFIXE)).sort();
  return propres.slice(0, Math.max(0, propres.length - aGarder));
}

/** Les sauvegardes existantes, par leur nom seul — jamais leur contenu. */
async function listerSauvegardes() {
  const { url, cle } = configurationBase();
  const reponse = await fetch(
    `${url}/rest/v1/${TABLE}?select=key&key=like.${encodeURIComponent(`${PREFIXE}%`)}`,
    { headers: { apikey: cle, Authorization: `Bearer ${cle}` } },
  );
  if (!reponse.ok) throw new Error(`liste_${reponse.status}`);
  const lignes = await reponse.json();
  return (Array.isArray(lignes) ? lignes : []).map((r) => r.key);
}

async function supprimerCle(clef) {
  const { url, cle } = configurationBase();
  const reponse = await fetch(`${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}`, {
    method: "DELETE",
    headers: { apikey: cle, Authorization: `Bearer ${cle}` },
  });
  if (!reponse.ok) throw new Error(`suppression_${reponse.status}`);
}

/**
 * L'appel vient-il de la tâche planifiée de Vercel ?
 *
 * Vercel ajoute `Authorization: Bearer <CRON_SECRET>` aux appels de ses tâches, mais seulement si
 * la variable existe. Sans elle, la tâche appellerait sans rien présenter — et cette adresse
 * serait ouverte à qui la devine. On exige donc le secret : à défaut, la porte reste fermée et le
 * dit, plutôt que de s'ouvrir à tout le monde par commodité.
 */
function estAppelPlanifie(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const recu = String(req.headers?.authorization || "");
  const attendu = `Bearer ${secret}`;
  if (recu.length !== attendu.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu, "utf8"), Buffer.from(attendu, "utf8"));
}

function estAppelInterne(req) {
  const attendu = jetonInterne();
  const recu = req.headers?.[ENTETE_INTERNE];
  if (!attendu || typeof recu !== "string" || recu.length !== attendu.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu, "utf8"), Buffer.from(attendu, "utf8"));
}

/**
 * Le compte rendu de la nuit, gardé DANS le document.
 *
 * Une tâche planifiée qui travaille en silence est une tâche dont on ne sait rien : elle peut
 * n'avoir jamais tourné, et rien ne le dirait — c'est exactement ce qui rendait un webhook muet
 * indétectable. L'écran de Configuration lit ce relevé et peut donc affirmer, ou non, que la
 * sauvegarde de cette nuit a bien eu lieu.
 *
 * L'échec s'y inscrit aussi : c'est le cas qu'on a besoin de voir.
 */
async function noterVeille(compte) {
  try {
    /* `modifierDocument` attend { document } : lui rendre le document nu écrirait `undefined`. */
    await modifierDocument((document) => ({
      document: {
        ...document,
        veille: {
          ...(document?.veille || {}),
          ...compte,
          le: new Date().toISOString(),
        },
      },
    }));
  } catch (e) {
    /* Le relevé est un confort ; il ne doit pas faire échouer une sauvegarde réussie. */
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  /*
   * Trois façons légitimes d'appeler : la tâche planifiée, une autre fonction du déploiement, ou
   * un membre de l'équipe qui veut une sauvegarde tout de suite. Le secret de la tâche est
   * éprouvé EN PREMIER : il voyage dans l'en-tête `Authorization`, où `refusSaufEquipe` chercherait
   * un jeton de session et n'en trouverait pas.
   */
  if (!estAppelPlanifie(req) && !estAppelInterne(req)) {
    const refus = refusSaufEquipe(req);
    if (refus) return res.status(refus.code).json(refus.corps);
  }

  if (!baseConfiguree()) {
    return res.status(501).json({
      error: "Accès serveur aux données non configuré",
      manquantes: [!process.env.SUPABASE_URL && "SUPABASE_URL",
        !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
    });
  }

  const clef = cleDuJour();

  try {
    /*
     * La copie du jour existe déjà : on ne la refait pas.
     *
     * Ce n'est pas une économie, c'est une protection. La première copie de la journée précède
     * les fausses manœuvres de la journée ; la réécrire par-dessus reviendrait à sauvegarder
     * l'accident.
     */
    const dejaLa = await lireCle(clef);
    if (dejaLa.valeur !== null && dejaLa.valeur !== undefined) {
      await noterVeille({ etat: "deja-faite", clef });
      return res.status(200).json({ ok: true, etat: "deja-faite", clef, ecrite: false });
    }

    const vivant = await lireCle("bde-data");
    if (!documentPlausible(vivant.valeur)) {
      /*
       * On s'arrête net, et on ne purge rien. Garder les anciennes copies est ici la seule chose
       * utile qui reste à faire.
       */
      await noterVeille({ etat: "document-suspect", clef });
      return res.status(409).json({
        ok: false,
        etat: "document-suspect",
        message: "Le document ne ressemble pas à celui de l’entreprise : aucune sauvegarde écrite, aucune ancienne effacée.",
      });
    }

    await ecrireCle(clef, vivant.valeur);

    /* La purge seulement maintenant : tant que la copie du jour n'existe pas, rien ne s'efface. */
    let purgees = [];
    try {
      const cles = await listerSauvegardes();
      purgees = clesAPurger(cles);
      for (const vieille of purgees) {
        try { await supprimerCle(vieille); } catch (e) { /* réessayée demain */ }
      }
    } catch (e) {
      /* Une purge manquée ne compromet rien : la sauvegarde, elle, est faite. */
    }

    /*
     * LE BILAN DE LA JOURNÉE, une fois la sauvegarde faite.
     *
     * Dans cet ordre, et pas l'inverse : la sauvegarde est ce qui protège l'entreprise, le bilan
     * est un confort. Un envoi de courriel qui échoue ne doit jamais faire échouer la copie de la
     * nuit — c'est pourquoi il est tenté ici, après, et sous `try`.
     */
    /*
     * LA COPIE HORS DE SUPABASE.
     *
     * Celle qu'on vient d'écrire est dans la même base que le document vivant : elle protège d'une
     * fausse manœuvre, pas de la perte du projet. Un compte fermé, une facture impayée, une
     * suppression, et les quinze copies s'en vont avec les données. Celle-ci part ailleurs.
     *
     * Elle est tentée APRÈS la copie interne, et sous `try` : un courriel qui échoue ne doit
     * jamais faire échouer la sauvegarde, qui est ce qui protège vraiment.
     */
    let copieHorsBase = null;
    try {
      copieHorsBase = await envoyerCopieHorsBase(vivant.valeur, clef.replace(PREFIXE, ""));
    } catch (e) {
      copieHorsBase = { envoye: false, raison: "exception", detail: String(e?.message || e).slice(0, 160) };
    }

    let bilan = null;
    try {
      const chiffres = chiffresDuJour(vivant.valeur);
      const parEmail = await envoyerBilanEmail(vivant.valeur, chiffres);
      const parWhatsApp = await envoyerBilanWhatsApp(chiffres);
      bilan = { chiffres, parEmail, parWhatsApp };
    } catch (e) {
      bilan = { erreur: String(e?.message || e).slice(0, 160) };
    }

    const compte = {
      etat: "ok",
      clef,
      colis: Array.isArray(vivant.valeur.colis) ? vivant.valeur.colis.length : 0,
      comptes: vivant.valeur.users.length,
      purgees: purgees.length,
      /* Une copie hors site dont on ne sait pas si elle est partie ne protège de rien. */
      horsBase: copieHorsBase?.envoye
        ? { envoyee: true, octets: copieHorsBase.octets }
        : { envoyee: false, raison: copieHorsBase?.raison || "inconnue" },
      bilan: bilan && bilan.chiffres
        ? { jour: bilan.chiffres.jour, email: !!bilan.parEmail?.envoye, whatsapp: !!bilan.parWhatsApp?.envoye,
          raisonWhatsApp: bilan.parWhatsApp?.envoye ? null : bilan.parWhatsApp?.raison || null }
        : bilan,
    };
    await noterVeille(compte);
    return res.status(200).json({ ok: true, ...compte, ecrite: true, bilan, copieHorsBase });
  } catch (e) {
    await noterVeille({ etat: "echec", clef, raison: String(e?.message || e).slice(0, 120) });
    return res.status(502).json({ ok: false, etat: "echec", error: "Sauvegarde impossible.", detail: String(e?.message || e).slice(0, 200) });
  }
}
