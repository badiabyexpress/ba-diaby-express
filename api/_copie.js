/*
 * LA COPIE HORS DE SUPABASE — la seule qui survive à la perte du projet
 * ─────────────────────────────────────────────────────────────────────
 * La sauvegarde de nuit écrit une copie du document dans la table `bde_data`, à côté de l'original.
 * C'est ce qu'il faut contre une fausse manœuvre : on restaure la veille, on reprend le travail.
 *
 * Ce n'est rien du tout contre la perte du projet lui-même. Les quinze copies et le document
 * vivant sont dans la même base, du même compte, chez le même hébergeur : une facture impayée, un
 * compte fermé, une suppression de projet, et l'on perd les données ET leurs sauvegardes du même
 * geste. Le compte est en formule gratuite, donc sans restauration dans le temps côté Supabase :
 * il n'existe aujourd'hui AUCUNE copie ailleurs.
 *
 * Ce fichier en fabrique une, et l'envoie par courriel en pièce jointe. Le choix du courriel n'est
 * pas un pis-aller :
 *
 *   — il ne demande aucun compte de plus, aucun secret de plus, aucune facture de plus — donc
 *     rien qui puisse expirer sans qu'on s'en aperçoive ;
 *   — la boîte du destinataire est chez un autre fournisseur, ce qui est exactement le but ;
 *   — le fichier est un JSON que l'application sait relire telle quelle, par
 *     Configuration → Sauvegarde des données → Restaurer. Une copie qu'on ne sait pas restaurer
 *     n'est pas une copie.
 *
 * CE QUE CETTE PIÈCE JOINTE CONTIENT, ET POURQUOI ON NE L'ALLÈGE PAS
 *
 * Tout : les colis, les clients, la caisse, les comptes de l'équipe et l'empreinte de leurs mots
 * de passe. On pourrait en retirer les empreintes pour rendre le fichier moins sensible — et l'on
 * obtiendrait une copie qui, une fois restaurée, enfermerait toute l'équipe dehors. Une sauvegarde
 * dont la restauration laisse l'entreprise à la porte n'est pas une sauvegarde.
 *
 * Le fichier est donc à traiter comme le coffre : il part à UNE adresse, choisie
 * (`SAUVEGARDE_EMAIL`), et le message le dit en toutes lettres plutôt que de le laisser croire
 * anodin.
 */

import { expediteurCourriel, reponseCourriel } from "./_expediteur.js";

const RESEND = "https://api.resend.com/emails";

/*
 * Au-delà, on n'envoie pas et on le dit.
 *
 * Resend refuse au-delà d'une quarantaine de mégaoctets, et un envoi refusé sans message laisserait
 * croire à une copie qui n'existe pas. Le document pèse aujourd'hui un quart de mégaoctet ; ce
 * plafond n'est pas là pour aujourd'hui, il est là pour le jour où quelqu'un déposera cinq cents
 * photos de colis dans la base.
 */
export const OCTETS_MAX = 20 * 1024 * 1024;

export function nomFichierCopie(jour) {
  return `sauvegarde-ba-diaby-express-${jour}.json`;
}

/**
 * À qui la copie est envoyée.
 *
 * `SAUVEGARDE_EMAIL` d'abord, pour qu'on puisse la diriger vers une adresse dédiée sans mêler ces
 * pièces jointes aux alertes du quotidien. À défaut l'adresse des alertes, à défaut celle du
 * premier administrateur : le fichier appartient à qui appartiennent les données.
 */
export function destinataireCopie(document) {
  const dediee = String(process.env.SAUVEGARDE_EMAIL || "").trim();
  if (dediee) return dediee;
  const alertes = String(process.env.ALERTE_EMAIL || "").trim();
  if (alertes) return alertes;
  const equipe = Array.isArray(document?.users) ? document.users : [];
  const admin = equipe.find((u) => u?.role === "Administrateur" && String(u.email || "").includes("@"));
  return admin ? String(admin.email).trim() : null;
}

const echapper = (texte) => String(texte == null ? "" : texte)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const poids = (octets) => (octets < 1024 * 1024
  ? `${Math.round(octets / 1024)} ko`
  : `${(octets / (1024 * 1024)).toFixed(1)} Mo`);

/**
 * Le message qui accompagne la pièce jointe.
 *
 * Il dit trois choses : ce que contient le fichier, comment s'en servir le jour où il faut, et
 * qu'il n'y a rien à faire aujourd'hui. Une copie de sauvegarde qu'on reçoit sans savoir comment
 * la restaurer se classe et s'oublie.
 */
export function corpsCopie({ jour, octets, colis, comptes }, document) {
  const nom = document?.branding?.nom || document?.siteVitrine?.nomPublic || "Ba-Diaby Express";
  return {
    sujet: `${nom} — copie de sauvegarde du ${jour} (${poids(octets)})`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0A2647;line-height:1.6">
        <p style="margin:0 0 16px"><strong>La copie de sauvegarde du ${echapper(jour)} est en pièce jointe.</strong>
        Il n’y a rien à faire : gardez simplement ce message.</p>

        <p style="font-size:13.5px;margin:0 0 6px"><strong>Ce qu’elle contient</strong></p>
        <p style="font-size:13.5px;color:#444;margin:0 0 16px">
          L’intégralité de la plateforme au moment de la copie : ${Number(colis) || 0} colis,
          ${Number(comptes) || 0} compte(s), les clients, la caisse, les factures et les réglages.
        </p>

        <p style="font-size:13.5px;margin:0 0 6px"><strong>Le jour où il faut s’en servir</strong></p>
        <p style="font-size:13.5px;color:#444;margin:0 0 16px">
          Téléchargez la pièce jointe, puis dans l’application :
          Configuration → Sauvegarde des données → Restaurer, et choisissez ce fichier.
          Il se relit tel quel, sans rien installer.
        </p>

        <div style="background:#FFF4E5;border:1px solid #F0C48A;border-radius:8px;padding:12px 14px;font-size:13px;color:#6B4A12">
          <strong>Ce fichier vaut l’accès à toute la plateforme.</strong> Il porte les coordonnées de
          vos clients et les empreintes des mots de passe de l’équipe — on ne les retire pas, sans
          quoi la restauration enfermerait tout le monde dehors. Ne le transférez pas, et ne le
          déposez pas sur un espace partagé.
        </div>

        <p style="color:#999;font-size:12px;margin-top:22px">
          Envoi automatique, chaque nuit, après la sauvegarde interne. Cette copie-ci est la seule
          qui survive à la perte du projet Supabase : les autres y sont enfermées avec les données.
        </p>
      </div>`,
  };
}

/**
 * Envoie la copie. Rend toujours une raison lisible en cas d'échec — jamais un simple `false`.
 *
 * Une sauvegarde hors site dont on ne sait pas si elle est partie ne protège de rien : on croit
 * être couvert. C'est pourquoi le relevé de la tâche de nuit porte le résultat, réussite comme
 * échec, avec le motif.
 */
export async function envoyerCopieHorsBase(document, jour) {
  const cle = process.env.RESEND_API_KEY;
  /* Jamais la variable brute : voir api/_expediteur.js — c'est ce qui a fait refuser
   * chaque courriel automatique par Resend pendant des semaines. */
  const expediteur = expediteurCourriel();
  if (!cle || !expediteur) return { envoye: false, raison: "courriel-non-configure" };

  const destinataire = destinataireCopie(document);
  if (!destinataire) return { envoye: false, raison: "aucun-destinataire" };

  const texte = JSON.stringify(document);
  const octets = Buffer.byteLength(texte, "utf8");
  if (octets > OCTETS_MAX) {
    return { envoye: false, raison: "document-trop-lourd", octets, plafond: OCTETS_MAX };
  }

  const details = {
    jour, octets,
    colis: Array.isArray(document?.colis) ? document.colis.length : 0,
    comptes: Array.isArray(document?.users) ? document.users.length : 0,
  };
  const { sujet, html } = corpsCopie(details, document);

  try {
    const reponse = await fetch(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: expediteur,
        /* Sans elle, répondre à ce message écrit dans le vide : voir reponseCourriel(). */
        ...(reponseCourriel() ? { reply_to: reponseCourriel() } : {}),
        to: [destinataire],
        subject: sujet,
        html,
        attachments: [{
          filename: nomFichierCopie(jour),
          content: Buffer.from(texte, "utf8").toString("base64"),
        }],
      }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      return { envoye: false, raison: `refus-resend-${reponse.status}`, detail: detail.slice(0, 200), octets };
    }
    return { envoye: true, destinataire, octets, fichier: nomFichierCopie(jour) };
  } catch (e) {
    return { envoye: false, raison: "reseau", detail: String(e?.message || e).slice(0, 200), octets };
  }
}
