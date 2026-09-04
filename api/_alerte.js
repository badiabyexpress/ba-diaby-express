/*
 * L'ALERTE D'ÉCRASEMENT — prévenir quelqu'un pendant que ça arrive
 * ─────────────────────────────────────────────────────────────────────────────
 * Le garde-fou de `_cloisonnement.js` empêche une page périmée d'effacer la base, et consigne son
 * refus. Mais un refus consigné n'est vu que par celui qui va le chercher : le 26 août, la perte a
 * été découverte le lendemain matin.
 *
 * Ce fichier sert à ce que quelqu'un l'apprenne tout de suite. Deux voies, et seulement deux :
 *
 *   1. le COURRIEL, envoyé d'ici par le serveur. C'est la voie fiable : elle ne dépend d'aucune
 *      fenêtre de temps, d'aucun modèle à faire approuver, et part même si personne n'a l'appli
 *      ouverte ;
 *   2. le BANDEAU dans l'application, alimenté par `alertesEcrasement` dans le document.
 *
 * Pas de WhatsApp ici, et ce n'est pas un oubli. Hors de la fenêtre de vingt-quatre heures, Meta
 * n'autorise QUE les modèles approuvés : une alerte d'incident, par définition imprévisible,
 * tomberait presque toujours hors fenêtre. Il faudrait donc faire approuver un modèle « alerte »
 * chez Meta d'abord. Tant que ce modèle n'existe pas, écrire du code qui « enverrait un WhatsApp »
 * reviendrait à promettre une alerte qui n'arriverait jamais.
 */

import { expediteurCourriel, reponseCourriel } from "./_expediteur.js";

const RESEND = "https://api.resend.com/emails";

/**
 * À qui l'on écrit.
 *
 * `ALERTE_EMAIL` dans Vercel a le dernier mot — c'est ce qui permet de prévenir le responsable même
 * si son compte n'a pas d'adresse renseignée. Sinon on prend la première adresse d'administrateur
 * trouvée dans le document : c'est la personne à qui appartiennent les données.
 */
export function destinataireAlerte(document) {
  const configure = String(process.env.ALERTE_EMAIL || "").trim();
  if (configure) return configure;
  const equipe = Array.isArray(document?.users) ? document.users : [];
  const admin = equipe.find(
    (u) => u && u.role === "Administrateur" && typeof u.email === "string" && u.email.includes("@"),
  );
  return admin ? admin.email.trim() : null;
}

const echapper = (texte) => String(texte == null ? "" : texte)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Le message. Il dit trois choses, dans cet ordre : rien n'est perdu, voici ce qui a été retenu,
 * voici l'appareil à aller fermer. Un message d'alerte qui commence par faire peur sans dire que
 * la base est intacte fait perdre une heure à celui qui le lit.
 */
export function corpsAlerte(alerte, document) {
  const collections = Array.isArray(alerte?.collections) ? alerte.collections : [];
  const lignes = collections
    .map(({ cle, avant, apres }) => `<li><strong>${echapper(cle)}</strong> : ${Number(avant) || 0} → ${Number(apres) || 0}</li>`)
    .join("");
  const total = collections.reduce((n, c) => n + Math.max(0, (Number(c.avant) || 0) - (Number(c.apres) || 0)), 0);
  const quand = new Date(alerte?.le || Date.now()).toLocaleString("fr-FR", { timeZone: "Africa/Conakry" });
  const nom = document?.company?.name || "Ba-Diaby Express";

  return {
    sujet: `${nom} — enregistrement refusé : une page périmée a tenté d’effacer ${total} entrées`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#12202F">
  <p style="background:#E9F7EF;border:1px solid #9BD9B6;border-radius:8px;padding:12px 14px;margin:0 0 16px">
    <strong>Vos données sont intactes.</strong> Le serveur a refusé l’enregistrement et remis en
    place ce qu’il allait effacer. Ce message est là pour que l’appareil fautif soit fermé.
  </p>
  <p style="margin:0 0 8px">Le <strong>${echapper(quand)}</strong>, un enregistrement venu du compte
    <strong>${echapper(alerte?.compte || "inconnu")}</strong> (${echapper(alerte?.role || "rôle inconnu")})
    aurait fait disparaître :</p>
  <ul style="margin:0 0 16px">${lignes || "<li>—</li>"}</ul>
  <p style="margin:0 0 8px"><strong>Que faire :</strong> sur l’appareil de cette personne, fermer
    l’onglet Ba-Diaby Express, puis le rouvrir. Une page laissée ouverte plusieurs heures renvoie le
    monde tel qu’elle l’a connu, et réessaiera à chaque geste tant qu’elle n’est pas rechargée.</p>
  <p style="margin:0 0 4px;color:#5A6B7F;font-size:13px">Appareil : ${echapper(alerte?.appareil || "non transmis")}</p>
  <p style="margin:0;color:#5A6B7F;font-size:13px">Connexion : ${echapper(alerte?.adresse || "non transmise")}</p>
</div>`.trim(),
  };
}

/**
 * Envoie l'alerte. Ne lève jamais : une écriture réussie ne doit pas être signalée en erreur
 * parce que le courriel n'est pas parti. Le résultat dit ce qui s'est passé, et l'appelant le
 * consigne.
 */
export async function envoyerAlerteEcrasement(document, alerte) {
  const cle = process.env.RESEND_API_KEY;
  /* Jamais la variable brute : voir api/_expediteur.js — c'est ce qui a fait refuser
   * chaque courriel automatique par Resend pendant des semaines. */
  const expediteur = expediteurCourriel();
  if (!cle || !expediteur) return { envoye: false, raison: "courriel-non-configure" };
  const destinataire = destinataireAlerte(document);
  if (!destinataire) return { envoye: false, raison: "aucun-destinataire" };

  const { sujet, html } = corpsAlerte(alerte, document);
  try {
    const reponse = await fetch(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: expediteur, to: [destinataire], subject: sujet, html,
        /* Sans elle, répondre à ce message écrit dans le vide : voir reponseCourriel(). */
        ...(reponseCourriel() ? { reply_to: reponseCourriel() } : {}),
      }),
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
