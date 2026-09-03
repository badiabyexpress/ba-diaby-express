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
import { releveDeFraude, signauxDeFraude, corpsAlerteFraude } from "./_fraude.js";
import { destinataireAlerte } from "./_alerte.js";
import { purgerDocumentsDevinables } from "./_documents.js";
import crypto from "node:crypto";

const PREFIXE = "bde-backup-";
/*
 * TRENTE JOURS, ET NON QUATORZE.
 *
 * Ce n'est pas un chiffre de confort. Trois factures partenaire ont disparu entre le 26 et le
 * 31 août ; personne ne s'en est aperçu avant le 3 septembre — huit jours. La seule copie qui
 * contenait encore les colis facturés datait du 24 août, et la fenêtre de quatorze jours allait
 * l'effacer la nuit suivante. À deux jours près, ces données étaient perdues pour de bon.
 *
 * Une perte silencieuse ne se découvre pas le lendemain : elle se découvre quand quelqu'un
 * cherche une pièce précise, souvent des semaines plus tard. La fenêtre doit donc couvrir le
 * délai de DÉCOUVERTE, pas le délai de l'incident.
 */
const JOURS_CONSERVES = 30;
const TABLE = "bde_data";

/*
 * Une sauvegarde quotidienne porte exactement « bde-backup-AAAA-MM-JJ ». Les copies prises à la
 * main avant une opération délicate portent un suffixe : « …-avant-restauration-cat ».
 *
 * La distinction n'est pas cosmétique. La purge gardait les N dernières clés, toutes confondues :
 * chaque copie de précaution occupait donc un emplacement et raccourcissait d'un jour l'historique
 * récupérable. Prendre une précaution réduisait la protection — exactement l'inverse du but.
 */
const QUOTIDIENNE = /^bde-backup-\d{4}-\d{2}-\d{2}$/;

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
  const quotidiennes = (Array.isArray(cles) ? cles : [])
    .filter((k) => typeof k === "string" && QUOTIDIENNE.test(k))
    .sort();
  /*
   * Les copies prises à la main ne sont jamais rendues : ce n'est pas un oubli.
   *
   * On les prend avant une opération risquée, précisément parce qu'on n'est pas sûr de soi. Les
   * effacer au bout de trente jours parce que le calendrier a tourné reviendrait à retirer le
   * filet une fois le funambule engagé. Elles sont peu nombreuses, elles portent un nom qui dit
   * pourquoi elles existent, et c'est à une personne de décider qu'on n'en a plus besoin.
   */
  return quotidiennes.slice(0, Math.max(0, quotidiennes.length - aGarder));
}

/**
 * Combien de lignes porte chaque registre du document.
 *
 * On compte tout ce qui est une liste, sans en nommer aucune : une collection ajoutée l'an
 * prochain sera surveillée le soir même, sans que personne ait à y penser. Une liste qui n'existe
 * pas encore n'est pas comptée à zéro — elle est simplement absente, et une absence ne se compare
 * pas à une chute.
 */
export function effectifsDuDocument(document) {
  const compte = {};
  Object.entries(document || {}).forEach(([cle, valeur]) => {
    if (Array.isArray(valeur)) compte[cle] = valeur.length;
  });
  return compte;
}

/*
 * CE QUI A FONDU DEPUIS HIER SOIR.
 *
 * Le seuil n'est pas un pourcentage unique, et c'est délibéré. Sur une liste de dix lignes,
 * perdre le quart n'est souvent qu'un ménage ; sur une liste de trois cents, c'est un accident.
 * On retient donc ce qui perd À LA FOIS plus de deux lignes et plus du dixième de sa hauteur :
 * les suppressions ordinaires d'une journée de travail passent, une collection qui s'effondre
 * ne passe pas.
 *
 * Ce n'est pas un verrou — la sauvegarde est déjà écrite quand on arrive ici, et c'est très bien
 * ainsi : refuser de sauvegarder parce qu'un chiffre a baissé priverait de copie le jour où l'on
 * en a le plus besoin. C'est un signal, et il n'a qu'un seul destinataire : quelqu'un qui pourra
 * regarder pendant que la copie de la veille existe encore.
 */
export function chutesDepuis(avant, apres) {
  if (!avant || typeof avant !== "object") return [];
  return Object.entries(apres || {})
    .map(([cle, maintenant]) => {
      const hier = avant[cle];
      if (typeof hier !== "number") return null;   // collection nouvelle : rien à comparer
      const perdus = hier - maintenant;
      if (perdus <= 2 || perdus < hier / 10) return null;
      return { cle, hier, maintenant, perdus };
    })
    .filter(Boolean);
}

/** Appelle une fonction SQL avec la clé de service. */
async function rpcServeur(nom) {
  const { url, cle } = configurationBase();
  if (!url || !cle) return null;
  const reponse = await fetch(`${url}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return reponse.ok ? reponse.json().catch(() => null) : null;
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
 * LE COURRIEL DE FRAUDE — envoyé seulement quand il y a quelque chose de grave à dire.
 *
 * Le seuil est volontairement haut : seuls les signaux « graves » déclenchent un envoi. Une rafale
 * d'essais arrêtée par le plafond mérite d'apparaître dans la cloche le matin ; elle ne mérite pas
 * de réveiller quelqu'un. Ce qui le mérite, c'est une réussite au bout d'une rafale, ou un
 * balayage en cours — les deux cas où attendre le lendemain coûte quelque chose.
 *
 * Comme toutes les alertes du site, elle part par courriel et non par WhatsApp : hors de la
 * fenêtre de vingt-quatre heures, Meta n'autorise que ses modèles approuvés, et une intrusion est
 * par nature imprévisible. Promettre un WhatsApp reviendrait à promettre une alerte qui
 * n'arriverait jamais.
 */
const RESEND_URL = "https://api.resend.com/emails";

async function envoyerAlerteFraude(document, signaux) {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EMAIL_FROM;
  if (!cle || !expediteur) return { envoye: false, raison: "courriel-non-configure" };
  const destinataire = destinataireAlerte(document);
  if (!destinataire) return { envoye: false, raison: "aucun-destinataire" };

  const { sujet, html } = corpsAlerteFraude(signaux, document);
  try {
    const reponse = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: expediteur, to: [destinataire], subject: sujet, html }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      return { envoye: false, raison: `refus-resend-${reponse.status}`, detail: detail.slice(0, 200) };
    }
    return { envoye: true, destinataire };
  } catch (e) {
    return { envoye: false, raison: "reseau", detail: String(e?.message || e).slice(0, 200) };
  }
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

  /*
   * LE MÉNAGE DES DOCUMENTS DONT L'ADRESSE SE DEVINE — avant tout le reste.
   *
   * Les factures et les étiquettes déposées avant le correctif portaient le numéro de suivi pour
   * seul nom, dans un espace public en lecture : qui en connaissait un pouvait deviner les autres
   * et lire nom, téléphone, adresse et contenu du colis. Les nouvelles portent un jeton tiré au
   * sort, mais les anciennes ne partiront pas d'elles-mêmes — un colis déjà remis ne fait plus
   * repasser personne dessus.
   *
   * Il tourne AVANT la sauvegarde, et donc aussi les jours où la copie du jour existe déjà : sans
   * cela, un membre de l'équipe qui déclenche la tâche à midi pour refermer la fuite repartirait
   * avec « déjà faite » et rien d'effacé.
   *
   * Rien n'est perdu : une facture se regénère depuis la fiche du colis, et la pièce déjà envoyée
   * vit dans la conversation WhatsApp, qui en garde sa propre copie.
   */
  let documents = null;
  try {
    documents = await purgerDocumentsDevinables();
  } catch (e) {
    documents = { fait: false, raison: "exception", detail: String(e?.message || e).slice(0, 160) };
  }

  /*
   * Les compteurs d'essais périmés. Une ligne dont la fenêtre s'est refermée hier n'apprend plus
   * rien à personne, et laisser grandir cette table indéfiniment finirait par coûter en lecture
   * ce qu'elle fait gagner en protection.
   */
  try { await rpcServeur("purger_verrous"); } catch (e) { /* réessayée demain */ }

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
      /*
       * LA SAUVEGARDE EST FAITE, MAIS LA COPIE HORS SITE PEUT ENCORE MANQUER.
       *
       * On s'arrêtait ici, et c'était un défaut : une copie qui rate à deux heures du matin
       * n'avait plus aucune seconde chance de la journée. Elle échouait alors chaque nuit, et
       * l'écran de Configuration montrait un motif vieux de vingt-quatre heures — personne ne
       * pouvait vérifier une correction avant le lendemain.
       *
       * On ne refait pas la sauvegarde : la première copie de la journée précède les fausses
       * manœuvres de la journée, et la réécrire reviendrait à sauvegarder l'accident. Mais on
       * réessaie ce qui a échoué, et lui seul.
       */
      const veillePrecedente = (await lireCle("bde-data")).valeur?.veille || null;
      if (veillePrecedente?.horsBase?.envoyee === true) {
        await noterVeille({ etat: "deja-faite", clef });
        return res.status(200).json({ ok: true, etat: "deja-faite", clef, ecrite: false, documents });
      }

      let reprise = null;
      try {
        reprise = await envoyerCopieHorsBase(dejaLa.valeur, clef.replace(PREFIXE, ""));
      } catch (e) {
        reprise = { envoye: false, raison: "exception", detail: String(e?.message || e).slice(0, 160) };
      }
      await noterVeille({
        etat: "deja-faite",
        clef,
        horsBase: reprise?.envoye
          ? { envoyee: true, octets: reprise.octets, le: new Date().toISOString() }
          : {
            envoyee: false,
            raison: reprise?.raison || "inconnue",
            detail: reprise?.detail || null,
            dernierSucces: veillePrecedente?.horsBase?.dernierSucces || null,
          },
      });
      return res.status(200).json({
        ok: true, etat: "deja-faite", clef, ecrite: false, documents, copieHorsBase: reprise,
      });
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

    /*
     * Le relevé de la nuit d'avant, lu AVANT d'écrire celui de cette nuit — sans quoi on
     * comparerait les effectifs à eux-mêmes et aucune chute ne se verrait jamais.
     */
    const veillePrecedente = vivant.valeur?.veille || null;
    const effectifs = effectifsDuDocument(vivant.valeur);

    /*
     * CE QUI RESSEMBLE À UNE ATTAQUE, RELEVÉ EN MÊME TEMPS QUE LE RESTE.
     *
     * Le site savait déjà se défendre — les essais sont plafonnés, les mots de passe coûtent
     * 150 000 tours à vérifier — mais rien ne RACONTAIT ce qui avait été tenté. Un automate arrêté
     * par le plafond revenait le lendemain avec une liste plus longue, et le jour où il trouvait,
     * la connexion réussie ressemblait à toutes les autres.
     *
     * Le relevé est écrit dans tous les cas : c'est lui que la cloche lit le matin. Le courriel,
     * lui, ne part que pour les signaux graves — une réussite au bout d'une rafale, un balayage en
     * cours. Une alerte qui crie tous les jours n'est plus lue le jour où elle a raison.
     */
    let fraude = null;
    try {
      fraude = releveDeFraude(vivant.valeur);
      const graves = signauxDeFraude(vivant.valeur).filter((s) => s.gravite === "grave");
      if (graves.length > 0) {
        const envoi = await envoyerAlerteFraude(vivant.valeur, graves);
        fraude = { ...fraude, alerte: envoi.envoye ? { envoyee: true } : { envoyee: false, raison: envoi.raison } };
      }
    } catch (e) {
      fraude = { erreur: String(e?.message || e).slice(0, 160) };
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
      /*
       * Une copie hors site dont on ne sait pas si elle est partie ne protège de rien — et une
       * dont on sait qu'elle échoue sans savoir POURQUOI ne se répare pas.
       *
       * Le refus de Resend porte son motif dans le corps de la réponse ; envoyerCopieHorsBase le
       * récupère fidèlement dans `detail`, et ce relevé le jetait. Résultat : « refus-resend-422 »
       * toutes les nuits depuis le 31 août, sans que rien ne dise que le domaine d'envoi n'est
       * pas vérifié, que le destinataire est refusé, ou autre chose encore. On garde donc le
       * motif, et la date du dernier succès — c'est elle qui dit depuis combien de temps
       * l'entreprise n'a plus aucune copie ailleurs que chez son hébergeur.
       */
      horsBase: copieHorsBase?.envoye
        ? { envoyee: true, octets: copieHorsBase.octets, le: new Date().toISOString() }
        : {
          envoyee: false,
          raison: copieHorsBase?.raison || "inconnue",
          detail: copieHorsBase?.detail || null,
          /* Conservée d'une nuit sur l'autre : sans elle, on ne saurait pas depuis quand. */
          dernierSucces: veillePrecedente?.horsBase?.envoyee
            ? veillePrecedente.horsBase.le || veillePrecedente.le || null
            : veillePrecedente?.horsBase?.dernierSucces || null,
        },
      /*
       * LES EFFECTIFS DE LA NUIT, ET CE QU'ILS ONT PERDU DEPUIS LA VEILLE.
       *
       * Les deux pertes de cet été — cinquante-huit catégories devenues quarante-deux, trois
       * factures partenaire devenues zéro — n'ont déclenché aucune alerte. Elles ont été
       * découvertes parce qu'un humain a cherché une pièce précise, huit jours plus tard.
       *
       * Compter chaque collection prend une milliseconde et se compare à la nuit d'avant. Ce
       * n'est pas un garde-fou — il est trop tard pour empêcher quoi que ce soit — c'est un
       * détecteur : il transforme « on s'en apercevra peut-être un jour » en « on le sait demain
       * matin », pendant que la sauvegarde de la veille existe encore.
       */
      effectifs,
      chutes: chutesDepuis(veillePrecedente?.effectifs, effectifs),
      /* Ce que le journal des accès raconte de la nuit — voir api/_fraude.js. */
      fraude,
      /* Un ménage dont on ne sait pas s'il a eu lieu ne referme rien : on croit la fuite fermée. */
      documents: documents?.fait
        ? { effaces: documents.effaces }
        : { effaces: 0, raison: documents?.raison || "inconnue" },
      /*
       * L'ÉTAT DU BILAN, AVEC SES MOTIFS — pas seulement deux booléens.
       *
       * On gardait « email: false, whatsapp: false » et rien d'autre : impossible de distinguer
       * « la variable n'est pas posée » de « Meta refuse le modèle » ou de « le numéro est faux ».
       * C'est la même erreur que celle qui a laissé la copie hors site échouer huit nuits de suite
       * sous un « refus-resend-422 » que personne ne pouvait interpréter. Un motif qu'on ne garde
       * pas est une panne qu'on ne répare pas.
       */
      bilan: bilan && bilan.chiffres
        ? {
          jour: bilan.chiffres.jour,
          email: !!bilan.parEmail?.envoye,
          raisonEmail: bilan.parEmail?.envoye ? null : bilan.parEmail?.raison || null,
          whatsapp: !!bilan.parWhatsApp?.envoye,
          raisonWhatsApp: bilan.parWhatsApp?.envoye ? null : bilan.parWhatsApp?.raison || null,
          detailWhatsApp: bilan.parWhatsApp?.envoye ? null : bilan.parWhatsApp?.detail || null,
          modele: bilan.parWhatsApp?.modele || null,
        }
        : bilan,
    };
    await noterVeille(compte);
    return res.status(200).json({ ok: true, ...compte, ecrite: true, bilan, copieHorsBase, documents });
  } catch (e) {
    await noterVeille({ etat: "echec", clef, raison: String(e?.message || e).slice(0, 120) });
    return res.status(502).json({ ok: false, etat: "echec", error: "Sauvegarde impossible.", detail: String(e?.message || e).slice(0, 200) });
  }
}
