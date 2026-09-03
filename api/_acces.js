/*
 * LE JOURNAL DES ACCÈS — savoir qui est entré, et être prévenu quand ce n'est pas habituel
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Le journal d'activité consigne ce qu'on FAIT une fois entré : un colis créé, un paiement
 * encaissé, un compte modifié. Il ne dit rien de l'entrée elle-même. Quelqu'un qui obtient un mot
 * de passe — noté sur un carnet, réutilisé ailleurs, deviné — entre, regarde tout, et repart sans
 * laisser la moindre trace : il n'a rien modifié.
 *
 * Ce fichier consigne donc les entrées, réussies comme refusées, et prévient quand l'une d'elles
 * ne ressemble pas aux précédentes.
 *
 * CE QU'ON GARDE, ET CE QU'ON NE GARDE PAS
 *
 * On garde de quoi reconnaître un appareil et une provenance : l'adresse de connexion, et une
 * empreinte courte calculée sur ce que le navigateur annonce de lui-même. On ne garde NI le
 * navigateur en clair, ni la moindre donnée qui suivrait la personne ailleurs : ce journal sert à
 * repérer une entrée anormale, pas à surveiller le travail de l'équipe.
 *
 * POURQUOI L'ALERTE EST UN COURRIEL
 *
 * Comme pour l'alerte d'écrasement : hors de la fenêtre de vingt-quatre heures, Meta n'autorise
 * que les modèles approuvés. Une connexion inhabituelle est par nature imprévisible, donc presque
 * toujours hors fenêtre. Écrire du code qui « enverrait un WhatsApp » promettrait une alerte qui
 * n'arriverait jamais.
 */

import crypto from "node:crypto";
import { destinataireAlerte } from "./_alerte.js";
import { expediteurCourriel, enteteCourriel } from "./_expediteur.js";

const RESEND = "https://api.resend.com/emails";

/**
 * Ce qu'on garde du journal.
 *
 * Assez pour couvrir plusieurs semaines d'une petite équipe, assez peu pour ne pas gonfler un
 * document que chaque page recharge. Au-delà, les plus anciennes sortent.
 */
export const MAX_ENTREES_ACCES = 400;

/** Le champ, dans le document. */
export const CHAMP_JOURNAL = "journalAcces";

/**
 * L'empreinte de l'appareil, courte et non réversible.
 *
 * Le navigateur annonce son nom, sa version et ses langues. Pris ensemble, ils suffisent à
 * distinguer « le téléphone habituel » de « autre chose », sans rien conserver de lisible. Deux
 * appareils identiques donneront la même empreinte, et c'est très bien : on cherche l'inhabituel,
 * pas l'identité.
 */
export function empreinteAppareil(req) {
  const entetes = req?.headers || {};
  const matiere = [
    entetes["user-agent"] || "",
    entetes["accept-language"] || "",
  ].join("|");
  if (!matiere.replace(/\|/g, "")) return "inconnu";
  return crypto.createHash("sha256").update(`bde-app-v1|${matiere}`).digest("hex").slice(0, 12);
}

/**
 * Le nom lisible de l'appareil, pour que l'alerte dise quelque chose à un humain.
 *
 * « Un appareil Android, navigateur Chrome » se comprend ; une empreinte hexadécimale, non. On ne
 * garde que ces deux mots-là, jamais la chaîne complète — elle est longue, précise, et n'apporte
 * rien de plus à qui lit une alerte.
 */
export function appareilLisible(req) {
  const ua = String(req?.headers?.["user-agent"] || "");
  if (!ua) return "appareil inconnu";
  const systeme = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iPhone ou iPad"
      : /Windows/i.test(ua) ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua) ? "Mac"
          : /Linux/i.test(ua) ? "Linux" : "système inconnu";
  const navigateur = /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
      : /Chrome\//i.test(ua) ? "Chrome"
        : /Firefox\//i.test(ua) ? "Firefox"
          : /Safari\//i.test(ua) ? "Safari" : "navigateur inconnu";
  return `${systeme}, ${navigateur}`;
}

const liste = (x) => (Array.isArray(x) ? x : []);

/**
 * Cette entrée ressemble-t-elle à ce que ce compte fait d'habitude ?
 *
 * Trois cas, et le premier compte autant que les autres :
 *
 *   — AUCUNE ENTRÉE RÉUSSIE ANTÉRIEURE : c'est la première fois qu'on note ce compte. Ce n'est
 *     pas « inhabituel », c'est « on ne sait pas encore ». Alerter ici enverrait un courriel à
 *     chaque compte le jour de la mise en service, et la première chose qu'on apprend d'une
 *     alerte qui crie tout le temps, c'est à ne plus la lire.
 *   — MÊME APPAREIL, ou MÊME ADRESSE : habituel. On accepte l'un OU l'autre parce qu'une adresse
 *     mobile change à chaque reconnexion en Guinée, et qu'un même appareil garde son empreinte ;
 *     à l'inverse, quelqu'un qui change de téléphone au bureau garde l'adresse.
 *   — NI L'UN NI L'AUTRE : nouvel appareil depuis une adresse jamais vue. C'est cela qu'on
 *     signale.
 */
export function connexionInhabituelle(document, compteId, entree) {
  const anterieures = liste(document?.[CHAMP_JOURNAL])
    .filter((e) => e && e.compteId === compteId && e.resultat === "reussie");
  if (anterieures.length === 0) return false;
  const memeAppareil = anterieures.some((e) => e.appareil && e.appareil === entree.appareil);
  const memeAdresse = anterieures.some((e) => e.adresse && e.adresse === entree.adresse);
  return !memeAppareil && !memeAdresse;
}

/**
 * Ajoute une entrée, en gardant les plus récentes.
 *
 * Le journal ne se réécrit jamais : on n'y ajoute qu'en tête, et l'on coupe la queue. Un journal
 * qu'on peut réécrire ne prouve rien.
 */
export function inscrireAcces(document, entree) {
  const base = document && typeof document === "object" ? document : {};
  return {
    ...base,
    [CHAMP_JOURNAL]: [entree, ...liste(base[CHAMP_JOURNAL])].slice(0, MAX_ENTREES_ACCES),
  };
}

/** L'entrée telle qu'elle est consignée. */
export function entreeAcces({ compte, identifiantSaisi, resultat, adresse, req, espace }) {
  return {
    id: `ac${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    le: new Date().toISOString(),
    resultat,                                   // "reussie" | "refusee"
    compteId: compte?.id || null,
    /* Le nom du compte est figé ici : renommer quelqu'un ne doit pas réécrire l'histoire. */
    qui: compte ? (`${compte.prenom || ""} ${compte.nom || ""}`.trim() || compte.identifiant || "") : "",
    identifiant: compte?.identifiant || String(identifiantSaisi || "").trim(),
    espace: espace === "client" ? "client" : "equipe",
    adresse: adresse || "inconnue",
    appareil: empreinteAppareil(req),
    appareilLisible: appareilLisible(req),
  };
}

const echapper = (texte) => String(texte == null ? "" : texte)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Le message d'alerte.
 *
 * Il dit d'abord ce qui s'est passé, ensuite quoi faire. Une alerte qui décrit un risque sans
 * dire quel geste le referme laisse son lecteur inquiet et sans prise.
 */
export function corpsAlerteConnexion(entree, document) {
  const nom = document?.branding?.nom || document?.siteVitrine?.nomPublic || "Ba-Diaby Express";
  const quand = new Date(entree.le).toLocaleString("fr-FR", { timeZone: "Africa/Conakry" });
  return {
    sujet: `${nom} — connexion depuis un appareil inhabituel (${entree.identifiant})`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0A2647;line-height:1.6">
        ${enteteCourriel(document)}
        <p><strong>Une connexion vient d’être faite depuis un appareil et une adresse jamais vus pour ce compte.</strong></p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 14px 4px 0;color:#666">Compte</td><td><strong>${echapper(entree.identifiant)}</strong>${entree.qui ? ` — ${echapper(entree.qui)}` : ""}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#666">Espace</td><td>${entree.espace === "client" ? "Espace Client" : "Application de l’équipe"}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#666">Quand</td><td>${echapper(quand)} (heure de Conakry)</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#666">Appareil</td><td>${echapper(entree.appareilLisible)}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#666">Adresse</td><td>${echapper(entree.adresse)}</td></tr>
        </table>
        <p style="color:#666;font-size:13.5px">
          Si c’est vous — un téléphone neuf, un autre réseau, un déplacement — il n’y a rien à faire :
          cet appareil sera reconnu la prochaine fois.
        </p>
        <p style="font-size:13.5px">
          <strong>Si ce n’est pas vous :</strong> ouvrez Configuration → Gestion Utilisateurs,
          réinitialisez le mot de passe de ce compte et déconnectez-le de tous ses appareils.
          Les deux gestes sont sur la même ligne. La déconnexion coupe immédiatement la session en
          cours, où qu’elle soit.
        </p>
        <p style="color:#999;font-size:12px;margin-top:22px">
          Message automatique. Toutes les entrées, réussies et refusées, sont consultables dans
          Configuration → Journal des accès.
        </p>
      </div>`,
  };
}

export async function envoyerAlerteConnexion(document, entree) {
  const cle = process.env.RESEND_API_KEY;
  /* Jamais la variable brute : voir api/_expediteur.js — c'est ce qui a fait refuser
   * chaque courriel automatique par Resend pendant des semaines. */
  const expediteur = expediteurCourriel();
  if (!cle || !expediteur) return { envoye: false, raison: "courriel-non-configure" };
  const destinataire = destinataireAlerte(document);
  if (!destinataire) return { envoye: false, raison: "aucun-destinataire" };

  const { sujet, html } = corpsAlerteConnexion(entree, document);
  try {
    const reponse = await fetch(RESEND, {
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
