/**
 * Fonction serverless Vercel — mot de passe oublié, pour un compte client.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Deux raisons, et la seconde est la plus grave.
 *
 * 1. C'est le dernier geste qui écrivait dans la base sans jeton — celui qui a oublié son mot de
 *    passe ne peut pas se connecter pour le changer. Tant qu'il passe par la clé publique, la base
 *    ne peut pas lui être fermée.
 *
 * 2. LE CODE ÉTAIT FABRIQUÉ ET VÉRIFIÉ DANS LE NAVIGATEUR. Il était tiré au sort par la page,
 *    gardé dans son état, envoyé sur WhatsApp, puis comparé à ce que la personne saisissait — le
 *    tout du même côté. N'importe qui pouvait le lire dans les outils de développement et changer
 *    le mot de passe de n'importe quel compte dont il connaissait l'identifiant. L'envoi WhatsApp
 *    donnait l'apparence d'une protection sans en être une.
 *
 * Ici, le code est tiré au sort par le serveur, ne redescend jamais au navigateur, et c'est le
 * serveur qui le compare. La page ne peut plus rien en savoir.
 *
 * OÙ EST RANGÉ LE CODE EN ATTENTE
 * -------------------------------
 * Sous une clé à part, `bde-reinit`, et non sur la fiche du client. Le document principal est
 * servi en entier à toute personne connectée : y déposer un code de réinitialisation reviendrait à
 * le montrer à tous les clients de l'entreprise. api/donnees.js refuse cette clé — elle
 * n'appartient qu'à cette fonction.
 *
 * Le code y est haché, jamais en clair : si la ligne fuitait, elle ne donnerait pas les codes.
 */

import { baseConfiguree, lireCle, ecrireCle, modifierDocument } from "./_base.js";
import { hashPBKDF2, identifiantsMotDePasse, egaliteSure, genererCode, genererSel } from "./_motdepasse.js";

export const CLE_REINIT = "bde-reinit";

const MINUTES_VALIDITE = 10;
const ESSAIS_MAX = 5;
const LONGUEUR_MOT_DE_PASSE = 8;

/*
 * Le code ne fait que six chiffres : mille fois moins d'essais qu'un mot de passe. On le hache
 * donc avec le même PBKDF2 que les mots de passe — 150 000 tours — pour que même quelqu'un qui
 * mettrait la main sur la ligne ne puisse pas les parcourir tous à moindre frais.
 */
function empreinteCode(code, sel) {
  return hashPBKDF2(code, sel);
}

/** Affiche 62•••••99 : assez pour se reconnaître, pas assez pour deviner le numéro. */
function masquerNumero(tel) {
  const n = String(tel || "").replace(/\D/g, "");
  if (n.length < 4) return "votre numéro";
  return n.slice(0, 2) + "•".repeat(Math.max(n.length - 4, 3)) + n.slice(-2);
}

async function lireDemandes() {
  const { valeur } = await lireCle(CLE_REINIT);
  return valeur && typeof valeur === "object" ? valeur : {};
}

/** Écrit les demandes en cours, débarrassées de celles qui ont expiré. */
async function ecrireDemandes(demandes) {
  const maintenant = Date.now();
  const vivantes = {};
  for (const [id, d] of Object.entries(demandes)) {
    if (d && d.expireA > maintenant) vivantes[id] = d;
  }
  await ecrireCle(CLE_REINIT, vivantes);
}

/*
 * L'envoi WhatsApp réutilise api/whatsapp.js plutôt que d'en refaire une copie : le jour où
 * l'entreprise passera de Twilio à Meta, il n'y aura qu'un fichier à changer.
 */
async function envoyerCodeWhatsApp(req, telephone, code) {
  const hote = req.headers["x-forwarded-host"] || req.headers.host;
  const protocole = req.headers["x-forwarded-proto"] || "https";
  if (!hote) return false;
  try {
    const reponse = await fetch(`${protocole}://${hote}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: telephone,
        message: `Ba-Diaby Express — votre code de réinitialisation est ${code}. Il expire dans ${MINUTES_VALIDITE} minutes. Si vous n’avez rien demandé, ignorez ce message.`,
      }),
    });
    return reponse.ok;
  } catch (e) {
    console.error("Envoi du code impossible", e);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!baseConfiguree()) {
    return res.status(501).json({ error: "Réinitialisation côté serveur non configurée" });
  }

  const { etape, identifiant, code, motdepasse } = req.body || {};
  const cherche = String(identifiant || "").trim().toLowerCase();

  try {
    if (etape === "demande") {
      const { valeur: document } = await lireCle("bde-data");
      const compte = (document?.clientAccounts || [])
        .find((c) => String(c.identifiant || "").toLowerCase() === cherche);

      /*
       * Réponse identique que le compte existe ou non, et qu'il ait un numéro ou pas : dire
       * « ce compte n'existe pas » permettrait de découvrir quels identifiants sont valides, et
       * donc de savoir qui est client de l'entreprise.
       */
      const reponseNeutre = {
        envoye: true,
        masque: compte?.telephone ? masquerNumero(compte.telephone) : "votre numéro",
        minutes: MINUTES_VALIDITE,
      };
      if (!compte || !compte.telephone) return res.status(200).json(reponseNeutre);

      const genere = genererCode();
      const envoye = await envoyerCodeWhatsApp(req, compte.telephone, genere);
      if (!envoye) {
        /*
         * L'envoi a échoué : on ne montre PAS le code à l'écran. Ce serait annuler la protection
         * pour la commodité — et c'est exactement l'erreur que cette fonction corrige.
         */
        return res.status(502).json({
          error: "Nous ne parvenons pas à envoyer le code pour le moment. Contactez notre agence, qui pourra réinitialiser votre mot de passe.",
        });
      }

      const sel = genererSel();
      const demandes = await lireDemandes();
      demandes[compte.id] = {
        sel,
        empreinte: empreinteCode(genere, sel),
        expireA: Date.now() + MINUTES_VALIDITE * 60000,
        essais: 0,
      };
      await ecrireDemandes(demandes);
      return res.status(200).json(reponseNeutre);
    }

    if (etape === "valider") {
      if (!motdepasse || String(motdepasse).length < LONGUEUR_MOT_DE_PASSE) {
        return res.status(400).json({ error: `Choisissez un mot de passe d’au moins ${LONGUEUR_MOT_DE_PASSE} caractères.` });
      }
      const { valeur: document } = await lireCle("bde-data");
      const compte = (document?.clientAccounts || [])
        .find((c) => String(c.identifiant || "").toLowerCase() === cherche);
      const demandes = await lireDemandes();
      const demande = compte ? demandes[compte.id] : null;

      if (!demande || demande.expireA < Date.now()) {
        return res.status(400).json({ error: "Ce code a expiré. Recommencez la demande.", recommencer: true });
      }
      if (demande.essais >= ESSAIS_MAX) {
        return res.status(429).json({ error: "Trop d’essais. Recommencez la demande.", recommencer: true });
      }

      const propose = String(code || "").trim();
      if (!egaliteSure(empreinteCode(propose, demande.sel), demande.empreinte)) {
        demande.essais += 1;
        await ecrireDemandes(demandes);
        return res.status(400).json({ error: "Code incorrect." });
      }

      await modifierDocument((doc) => ({
        document: {
          ...doc,
          clientAccounts: (doc.clientAccounts || []).map((c) => (
            c.id === compte.id ? { ...c, ...identifiantsMotDePasse(String(motdepasse)), motdepasse: undefined } : c
          )),
        },
      }));

      // Le code a servi : il ne doit pas pouvoir resservir.
      delete demandes[compte.id];
      await ecrireDemandes(demandes);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Étape inconnue." });
  } catch (e) {
    console.error("Échec de la réinitialisation", e);
    return res.status(502).json({ error: "Réinitialisation impossible pour le moment." });
  }
}
