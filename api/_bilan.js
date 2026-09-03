/*
 * LE BILAN QUOTIDIEN — ce que la journée a donné, sans avoir à ouvrir l'application
 * ─────────────────────────────────────────────────────────────────────────────────
 * Pour savoir combien de colis sont partis hier et combien d'argent est entré, il faut aujourd'hui
 * ouvrir l'application, aller à la Caisse, choisir la bonne période, puis à la Comptabilité, puis
 * aux Colis. Quatre écrans, tous les matins, pour cinq chiffres. Résultat : on ne le fait pas, et
 * l'on découvre au bout d'une semaine qu'une agence n'a rien versé.
 *
 * Ce fichier calcule ces chiffres et les envoie, une fois par jour, depuis le serveur. Il ne
 * dépend d'aucune page ouverte : c'est la tâche de nuit qui l'appelle, après la sauvegarde.
 *
 * DEUX VOIES, ET UNE HONNÊTETÉ À TENIR
 *
 * Le COURRIEL part toujours : il ne dépend d'aucune fenêtre de temps ni d'aucun modèle à faire
 * approuver, et il porte le détail complet.
 *
 * Le WHATSAPP est tenté, et voilà ce qu'il faut savoir : hors de la fenêtre de vingt-quatre heures,
 * Meta n'autorise QUE les modèles approuvés. Un bilan quotidien tombe par définition hors fenêtre.
 * Il faut donc un modèle déposé et validé — `bde_bilan_quotidien`, quatre variables. Tant qu'il
 * n'existe pas, l'envoi est refusé par Meta et le refus est RAPPORTÉ TEL QUEL, jamais masqué :
 * un bilan qu'on croit recevoir et qui n'arrive pas est pire que pas de bilan du tout.
 */

import { expediteurCourriel } from "./_expediteur.js";

const RESEND = "https://api.resend.com/emails";
const VERSION_GRAPH = "v21.0";

/** Le nom du modèle à faire approuver chez Meta pour recevoir le bilan par WhatsApp. */
export const MODELE_BILAN = "bde_bilan_quotidien";

const liste = (x) => (Array.isArray(x) ? x : []);
const nombre = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * Le numéro sous la forme que Meta attend : indicatif du pays, puis le numéro. Rien devant.
 *
 * Meta refuse « 00224… » avec « (#131009) Parameter value is not valid » — un message qui ne dit
 * ni quel paramètre, ni pourquoi. Or « 00 » est exactement la façon dont un numéro international
 * s'écrit en Guinée, et sur un clavier de téléphone c'est ce que l'on tape. On retire donc ce
 * préfixe de composition, comme on retire déjà le « + » et les espaces : ce sont trois manières
 * d'écrire le même numéro, et aucune n'est une faute de la part de qui la saisit.
 *
 * On ne retire jamais un « 0 » seul : dans un numéro national il fait partie du numéro.
 */
export function numeroPourMeta(valeur) {
  const chiffres = String(valeur || "").replace(/\D/g, "");
  return chiffres.startsWith("00") ? chiffres.slice(2) : chiffres;
}

/** Le jour visé, en heure de Conakry — qui est l'heure universelle, sans décalage ni été. */
export function jourPrecedent(maintenant = new Date()) {
  return new Date(maintenant.getTime() - 86400000).toISOString().slice(0, 10);
}

const memeJour = (valeur, jour) => typeof valeur === "string" && valeur.slice(0, 10) === jour;

/**
 * Les chiffres de la journée.
 *
 * On ne calcule que ce sur quoi on peut agir le lendemain matin. « Combien de colis en base » ne
 * sert à rien ; « combien attendent depuis plus d'une semaine que quelqu'un vienne les chercher »
 * fait décrocher un téléphone.
 */
export function chiffresDuJour(document, jour = jourPrecedent()) {
  const colis = liste(document?.colis);

  const enregistres = colis.filter((c) => memeJour(c?.createdAt, jour));
  const livres = colis.filter((c) => liste(c?.historique).some((h) => h?.status === "Livré" && memeJour(h?.date, jour)));

  /* L'argent réellement entré ce jour-là, ligne de paiement par ligne de paiement. */
  let encaisse = 0;
  const parAgent = new Map();
  colis.forEach((c) => {
    liste(c?.paiements).forEach((p) => {
      if (!memeJour(p?.date, jour)) return;
      const montant = nombre(p.montant);
      encaisse += montant;
      const qui = String(p.par || "").trim() || "non attribué";
      parAgent.set(qui, (parAgent.get(qui) || 0) + montant);
    });
  });

  const enAttente = colis.filter((c) => c?.status === "Disponible au retrait");
  const resteAEncaisser = colis
    .filter((c) => c?.status !== "Annulé" && c?.status !== "Refusé")
    .reduce((somme, c) => somme + Math.max(0, nombre(c.reste)), 0);

  /* Ce qui appelle un geste : un dépôt de partenaire à vérifier, une demande de l'Espace Client. */
  const aVerifier = colis.filter((c) => c?.partenaireId && c?.validationPartenaire?.statut === "En attente").length;
  const demandesClients = liste(document?.preAlertes).filter((p) => !p?.traitee).length;

  return {
    jour,
    enregistres: enregistres.length,
    livres: livres.length,
    encaisse: +encaisse.toFixed(2),
    resteAEncaisser: +resteAEncaisser.toFixed(2),
    enAttente: enAttente.length,
    aVerifier,
    demandesClients,
    parAgent: [...parAgent.entries()]
      .map(([qui, montant]) => ({ qui, montant: +montant.toFixed(2) }))
      .sort((a, b) => b.montant - a.montant),
  };
}

const euros = (n) => `${nombre(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;

const echapper = (texte) => String(texte == null ? "" : texte)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Le message court, celui qui tient dans une notification de téléphone.
 *
 * C'est aussi ce qui remplit les variables du modèle WhatsApp : Meta refuse un paramètre qui
 * contient un retour à la ligne, une tabulation ou quatre espaces d'affilée — et le refus revient
 * pour chaque envoi, sans qu'on sache pourquoi. Chaque variable est donc une seule ligne.
 */
export function variablesBilan(chiffres) {
  const jourLisible = new Date(`${chiffres.jour}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const aFaire = [
    chiffres.enAttente > 0 ? `${chiffres.enAttente} colis attendent d’être retirés` : "",
    chiffres.aVerifier > 0 ? `${chiffres.aVerifier} dépôt(s) partenaire à vérifier` : "",
    chiffres.demandesClients > 0 ? `${chiffres.demandesClients} demande(s) de l’Espace Client` : "",
  ].filter(Boolean).join(" · ") || "rien en attente";
  return [
    jourLisible,
    `${chiffres.enregistres} enregistré(s), ${chiffres.livres} livré(s)`,
    `${euros(chiffres.encaisse)} encaissés, ${euros(chiffres.resteAEncaisser)} restant dus`,
    aFaire,
  ];
}

export function corpsBilan(chiffres, document) {
  const nom = document?.branding?.nom || document?.siteVitrine?.nomPublic || "Ba-Diaby Express";
  const jourLisible = new Date(`${chiffres.jour}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const ligne = (libelle, valeur, accent) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666">${echapper(libelle)}</td>
     <td style="font-weight:700${accent ? `;color:${accent}` : ""}">${echapper(valeur)}</td></tr>`;

  const agents = chiffres.parAgent.length
    ? `<p style="margin-top:20px;font-size:13.5px"><strong>Encaissé par</strong><br>${
      chiffres.parAgent.map((a) => `${echapper(a.qui)} — ${euros(a.montant)}`).join("<br>")}</p>`
    : "";

  return {
    sujet: `${nom} — bilan du ${jourLisible}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0A2647;line-height:1.6">
        <p style="margin:0 0 4px;font-size:13px;color:#666">Bilan de la journée</p>
        <p style="margin:0 0 18px;font-size:19px;font-weight:700">${echapper(jourLisible)}</p>
        <table style="border-collapse:collapse">
          ${ligne("Colis enregistrés", String(chiffres.enregistres))}
          ${ligne("Colis livrés", String(chiffres.livres))}
          ${ligne("Encaissé", euros(chiffres.encaisse), "#16A163")}
          ${ligne("Reste à encaisser", euros(chiffres.resteAEncaisser), chiffres.resteAEncaisser > 0 ? "#E23F52" : null)}
        </table>
        ${agents}
        <p style="margin-top:22px;font-size:13.5px"><strong>Ce qui attend un geste</strong></p>
        <ul style="font-size:13.5px;color:#444;margin-top:4px">
          <li>${chiffres.enAttente} colis disponible(s) au retrait, pas encore récupéré(s)</li>
          <li>${chiffres.aVerifier} dépôt(s) de partenaire à vérifier</li>
          <li>${chiffres.demandesClients} demande(s) de l’Espace Client non traitée(s)</li>
        </ul>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Message automatique, envoyé chaque nuit après la sauvegarde. Les montants sont en euros,
          convertis au taux enregistré dans l’application.
        </p>
      </div>`,
  };
}

export async function envoyerBilanEmail(document, chiffres) {
  const cle = process.env.RESEND_API_KEY;
  /* Jamais la variable brute : voir api/_expediteur.js — c'est ce qui a fait refuser
   * chaque courriel automatique par Resend pendant des semaines. */
  const expediteur = expediteurCourriel();
  if (!cle || !expediteur) return { envoye: false, raison: "courriel-non-configure" };
  const destinataire = String(process.env.ALERTE_EMAIL || "").trim()
    || liste(document?.users).find((u) => u?.role === "Administrateur" && String(u.email || "").includes("@"))?.email;
  if (!destinataire) return { envoye: false, raison: "aucun-destinataire" };

  const { sujet, html } = corpsBilan(chiffres, document);
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

/**
 * Le bilan par WhatsApp — tenté pour de bon, et jamais maquillé.
 *
 * Il faut trois choses : le jeton et le numéro d'envoi dans Vercel, un destinataire
 * (`BILAN_WHATSAPP` — le numéro qui doit recevoir), et le modèle `bde_bilan_quotidien` approuvé
 * chez Meta. Il manque l'une des trois, on le dit et l'on s'arrête là : le courriel, lui, est déjà
 * parti avec le détail complet.
 */
export async function envoyerBilanWhatsApp(chiffres, destinataireEssai = null) {
  const jeton = process.env.WHATSAPP_TOKEN;
  /*
   * LE NOM DE LA VARIABLE, ET LA PANNE QU'IL A CAUSÉE.
   *
   * Ce fichier lisait `WHATSAPP_PHONE_NUMBER_ID`. Tout le reste de l'application — api/whatsapp.js,
   * qui envoie réellement les messages aux clients depuis des mois — lit `WHATSAPP_PHONE_ID`. La
   * variable au nom long n'a jamais existé nulle part.
   *
   * Conséquence : le bilan WhatsApp répondait « whatsapp-non-configure » quoi qu'on fasse. On
   * pouvait poser BILAN_WHATSAPP, faire approuver le modèle chez Meta, redéployer — rien n'y
   * changeait, et le message accusait une configuration manquante qui, elle, était en place.
   *
   * On lit donc le nom réellement utilisé, et l'on accepte l'ancien en second : si quelqu'un a posé
   * la variable au nom long entre-temps en suivant l'ancien message, elle continue de servir plutôt
   * que d'être ignorée en silence.
   */
  const numeroId = process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  /*
   * UN NUMÉRO D'ESSAI, POUR SAVOIR LEQUEL DES DEUX EST FAUTIF.
   *
   * « Meta a accepté » et « le téléphone a reçu » sont deux choses différentes : l'API rend un
   * identifiant de message dès qu'elle accepte la demande, sans rien promettre de la livraison. Un
   * numéro qui n'est pas sur WhatsApp, un chiffre de travers, une ligne qui a changé de main —
   * l'envoi est « réussi » et personne ne reçoit rien.
   *
   * Tant qu'on ne pouvait essayer que le numéro de la variable d'environnement, chaque hypothèse
   * coûtait une modification dans Vercel et un redéploiement. On accepte donc un destinataire pour
   * l'essai, sans rien changer à l'envoi de nuit, qui garde le sien.
   */
  const destinataire = numeroPourMeta(destinataireEssai || process.env.BILAN_WHATSAPP);
  if (!jeton || !numeroId) return { envoye: false, raison: "whatsapp-non-configure" };
  if (!destinataire) return { envoye: false, raison: "aucun-numero-de-bilan", modele: MODELE_BILAN };

  try {
    const reponse = await fetch(
      `https://graph.facebook.com/${VERSION_GRAPH}/${encodeURIComponent(numeroId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destinataire,
          type: "template",
          template: {
            name: MODELE_BILAN,
            /*
             * Même faute que pour le numéro : `WHATSAPP_LANG` n'existe nulle part, la variable
             * s'appelle `WHATSAPP_TEMPLATE_LANG` partout ailleurs. Une langue qui ne correspond pas
             * à celle du modèle déposé fait répondre à Meta « le modèle n'existe pas dans cette
             * traduction » — un refus qu'on aurait mis sur le compte du modèle, et non de la langue.
             */
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || process.env.WHATSAPP_LANG || "fr" },
            components: [{
              type: "body",
              parameters: variablesBilan(chiffres).map((v) => ({ type: "text", text: String(v) })),
            }],
          },
        }),
      },
    );
    const data = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      const erreur = data?.error || {};
      /*
       * Le cas de loin le plus fréquent tant que le modèle n'est pas déposé. On le nomme, plutôt
       * que de rendre un code d'erreur que personne n'ira chercher.
       */
      const manquant = /template/i.test(erreur.message || "") || erreur.code === 132001;
      return {
        envoye: false,
        raison: manquant ? "modele-absent-ou-non-approuve" : `refus-meta-${reponse.status}`,
        modele: MODELE_BILAN,
        detail: String(erreur.error_user_msg || erreur.message || "").slice(0, 200),
      };
    }
    return { envoye: true, id: data?.messages?.[0]?.id || null, destinataire };
  } catch (e) {
    return { envoye: false, raison: "reseau", detail: String(e?.message || e).slice(0, 200) };
  }
}
