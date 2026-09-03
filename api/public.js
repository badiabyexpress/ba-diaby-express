/**
 * Fonction serverless Vercel — ce que les pages publiques ont le droit de savoir.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Jusqu'ici, la page de suivi et la vitrine recevaient la base entière. Un visiteur qui suivait
 * un colis repartait, sans le savoir, avec tous les colis de l'entreprise, tous ses clients et
 * leurs numéros, tous les comptes utilisateurs — empreintes de mots de passe comprises — les
 * contrats des partenaires, les factures et la caisse. Il suffisait d'ouvrir la console du
 * navigateur pour les lire.
 *
 * La lecture se fait désormais ici, côté serveur, et cette fonction ne renvoie que le strict
 * nécessaire à ce qui est affiché : un seul colis pour une recherche de suivi, l'identité de
 * l'entreprise et les prochains départs pour la vitrine. Le reste ne quitte plus la base.
 *
 * VARIABLES D'ENVIRONNEMENT
 * -------------------------
 *   SUPABASE_URL                 adresse du projet
 *   SUPABASE_SERVICE_ROLE_KEY    clé de service — SECRET (« Secret key » dans l'interface Supabase)
 *
 * À défaut, la fonction retombe sur VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY : elle fonctionne
 * donc dès sa mise en ligne, avant même que la clé de service soit configurée. La clé de service
 * deviendra indispensable le jour où la base sera fermée au public — c'est le but de la manœuvre.
 */

import { passage, adresseDe, refuser } from "./_verrou.js";
import { normaliserCode, empreinteCode, vuePubliqueTransfert, secretDisponible } from "./_transferts.js";

const CLE_DONNEES = "bde-data";

/**
 * Retrouve un transfert pour le suivi public — par son code de retrait, ou par sa référence.
 *
 * Le code n'existe dans la base que sous forme d'empreinte : seule l'égalité exacte le retrouve,
 * ce qui interdit toute recherche approchante et donc tout balayage par proximité.
 */
async function chercherTransfertPublic(saisie, parCode) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  let filtre = null;
  if (parCode) {
    const code = normaliserCode(saisie);
    const empreinte = code ? empreinteCode(code) : null;
    if (!empreinte) return null;
    filtre = `code_hash=eq.${empreinte}`;
  } else {
    filtre = `reference=eq.${encodeURIComponent(saisie.toUpperCase())}`;
  }
  /*
   * Un transfert retiré par l'administration ne se vérifie plus en ligne. Le QR d'un reçu déjà
   * imprimé continue d'exister — on ne rappelle pas un papier — mais il ne doit pas confirmer
   * une opération que l'entreprise a sortie de ses livres : ce serait donner du crédit à un reçu
   * qui n'en a plus. La page répond alors comme pour une référence inconnue.
   */
  const reponse = await fetch(`${url}/rest/v1/transferts?${filtre}&supprime_le=is.null&select=*&limit=1`, {
    headers: { apikey: cle, Authorization: `Bearer ${cle}` },
  }).catch(() => null);
  if (!reponse || !reponse.ok) return null;
  const lignes = await reponse.json().catch(() => null);
  const t = Array.isArray(lignes) ? lignes[0] : null;
  return t ? vuePubliqueTransfert(t) : null;
}

/** Les étapes visibles d'un colis, sans les commentaires internes des agents. */
function historiquePublic(historique) {
  return (Array.isArray(historique) ? historique : []).map((h) => ({
    statut: h.statut, date: h.date, lieu: h.lieu || "",
  }));
}

/*
 * Le colis, tel qu'un porteur du numéro de suivi peut le voir.
 *
 * On garde ce que la page affiche — et rien d'autre. Pas de téléphone, pas d'adresse, pas de
 * détail du contenu, pas de prix d'achat : celui qui a le numéro n'est pas forcément le
 * destinataire, et un numéro de suivi se devine.
 */
function colisPublic(c) {
  return {
    tracking: c.tracking,
    status: c.status,
    createdAt: c.createdAt,
    expediteur: c.expediteur || "",
    destinataire: c.destinataire || "",
    expediteurPays: c.expediteurPays || "GN",
    destinatairePays: c.destinatairePays || c.pays,
    pays: c.pays,
    direction: c.direction || "export",
    mode: c.mode || "air",
    poids: c.poids || 0,
    paye: c.paye || 0,
    reste: c.reste || 0,
    clientAccountId: c.clientAccountId || null,
    partenaireId: c.partenaireId || null,
    historique: historiquePublic(c.historique),
  };
}

/*
 * Le partenaire réduit à sa devanture.
 *
 * Un colis de partenaire se suit sous SA marque : son client a acheté chez lui, pas chez nous.
 * La page a donc besoin de son nom commercial et de son logo — et de rien d'autre. Ni ses tarifs,
 * ni ses destinations, ni son correspondant, ni ses coordonnées privées ne sortent d'ici.
 */
function partenairePublic(u) {
  const p = u?.partenaire || {};
  if (!p.nomCommercial) return null;
  return {
    id: u.id,
    role: "Partenaire",
    partenaire: {
      nomCommercial: p.nomCommercial,
      logo: p.logo || null,
      siteWeb: p.siteWeb || "",
    },
  };
}

async function lireBase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !cle) return { erreur: "storage_non_configure" };
  const reponse = await fetch(
    `${url}/rest/v1/${encodeURIComponent("bde_data")}?key=eq.${CLE_DONNEES}&select=value`,
    { headers: { apikey: cle, Authorization: `Bearer ${cle}` } },
  );
  if (!reponse.ok) return { erreur: `base_${reponse.status}` };
  const lignes = await reponse.json();
  const valeur = Array.isArray(lignes) && lignes[0] ? lignes[0].value : null;
  if (!valeur) return { erreur: "base_vide" };
  return { donnees: valeur };
}

/*
 * Les plafonds du suivi public.
 *
 * Une personne qui suit ses colis en consulte quelques-uns, revient plus tard, en consulte
 * quelques autres : trente recherches en dix minutes lui laissent une marge très large. Un
 * programme qui compte de un en un fait cela en trois secondes.
 *
 * Le second plafond vise l'aspiration elle-même. Chercher un numéro qui n'existe pas est normal
 * (une faute de frappe, un colis pas encore saisi) ; en chercher dix qui n'existent pas d'affilée
 * ne l'est pas — c'est ce que fait exactement un compteur qui balaie les numéros. On coupe donc
 * plus tôt sur les recherches infructueuses que sur les autres, car un aspirateur en produit
 * beaucoup et un client presque aucune.
 */
const SUIVIS_PAR_FENETRE = 30;
const FENETRE_SUIVI_MS = 10 * 60 * 1000;
const INTROUVABLES_PAR_FENETRE = 10;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée" });

  const { suivi, vitrine, cgu, logo } = req.query || {};

  /*
   * LE LOGO, À UNE VRAIE ADRESSE.
   *
   * Il est enregistré dans les données sous forme de `data:image/...;base64,…`, et c'est
   * délibéré : les PDF le dessinent à l'impression, et jsPDF ne sait pas aller chercher une image
   * distante. Mais AUCUN CLIENT DE MESSAGERIE N'AFFICHE UNE IMAGE `data:` — Gmail les retire, et
   * l'on obtiendrait un carré vide en tête de chaque bilan.
   *
   * On le sert donc ici, décodé, sous une adresse ordinaire que n'importe quel client sait
   * charger. C'est déjà ce que la vitrine publie de l'entreprise : rien de nouveau n'est exposé.
   *
   * Sans logo enregistré, on répond 404 plutôt qu'une image vide : l'appelant sait alors ne rien
   * afficher, au lieu de montrer une icône cassée.
   */
  if (logo !== undefined) {
    try {
      const { donnees } = await lireBase();
      const brut = String(donnees?.branding?.logo || "");
      const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(brut);
      if (!m) return res.status(404).end();
      const octets = Buffer.from(m[2], "base64");
      res.setHeader("Content-Type", m[1]);
      res.setHeader("Content-Length", String(octets.length));
      /*
       * Une heure de cache, et pas davantage : un logo change rarement, mais le jour où il change
       * on ne veut pas que les courriels de la semaine gardent l'ancien. Les relais de messagerie
       * recopient l'image de leur côté, ce délai leur suffit largement.
       */
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(200).send(octets);
    } catch (e) {
      return res.status(404).end();
    }
  }

  /*
   * Le verrou est posé AVANT la lecture de la base : un refus doit coûter moins cher qu'une
   * réponse, sinon limiter les appels revient à s'infliger la charge qu'on voulait éviter.
   */
  if (suivi !== undefined) {
    const compte = await passage({
      nature: "suivi-public", cle: adresseDe(req),
      max: SUIVIS_PAR_FENETRE, fenetreMs: FENETRE_SUIVI_MS,
    });
    if (compte.bloque) {
      return refuser(res, compte.dansSecondes,
        "Trop de recherches de suivi depuis cette connexion. Réessayez dans quelques minutes.");
    }
  }

  try {
    const { donnees, erreur } = await lireBase();
    if (erreur) {
      console.error("Lecture publique impossible", erreur);
      return res.status(502).json({ error: "Données momentanément indisponibles." });
    }

    if (vitrine !== undefined) {
      /*
       * La vitrine n'a besoin que de ce qu'elle montre : l'identité de l'entreprise et les
       * prochains départs. Les départs déjà passés ne sont d'aucune utilité et allongent la
       * réponse — le tri final reste à la charge de la page, qui connaît le pays choisi.
       */
      const maintenant = Date.now();
      /*
       * L'annonce en cours part avec la vitrine — c'est ce que le bouton « Voir l'offre » des
       * messages vient chercher. Son échéance est vérifiée ICI et pas seulement dans la page :
       * une offre périmée ne doit pas quitter le serveur, sinon elle reste affichée chez qui a
       * gardé la page ouverte.
       */
      const annonce = donnees.annoncePublique;
      const finAnnonce = annonce?.jusquAu ? new Date(`${annonce.jusquAu}T23:59:59`).getTime() : 0;
      return res.status(200).json({
        branding: donnees.branding || {},
        siteVitrine: donnees.siteVitrine || {},
        departs: (donnees.departs || []).filter((d) => d.dateLimite && new Date(d.dateLimite).getTime() >= maintenant),
        ...(annonce?.texte && finAnnonce >= maintenant ? { annoncePublique: annonce } : {}),
      });
    }

    if (cgu !== undefined) {
      return res.status(200).json({ entreprise: donnees.entreprise || {}, branding: donnees.branding || {} });
    }

    if (suivi !== undefined) {
      const code = String(suivi || "").trim().toUpperCase();
      // Une recherche vide ne renvoie pas « tous les colis » : elle ne renvoie rien.
      if (!code) return res.status(200).json({ colis: [], users: [] });

      /*
       * UN TRANSFERT D'ARGENT SE SUIT AU MÊME ENDROIT QU'UN COLIS.
       *
       * Le client ne sait pas qu'il y a deux systèmes derrière : il tape ce qu'on lui a donné.
       * On reconnaît donc un code de retrait — deux lettres et six chiffres depuis septembre,
       * huit chiffres pour ceux émis avant, avec ou sans le préfixe — et une
       * référence (TX-…), et on répond avec ce qu'un inconnu peut voir sans nuire à personne :
       * l'état, la destination, le montant à recevoir, et des initiales. Ni téléphone, ni pièce
       * d'identité, ni nom complet de l'autre partie — un code tapé au hasard ne doit jamais
       * renseigner sur des gens qu'on ne connaît pas.
       */
      const sansSeparateurs = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^TRF/, "");
      const estCodeTransfert = /^[A-Z]{2}\d{6}$/.test(sansSeparateurs) || /^\d{8}$/.test(sansSeparateurs);
      const estReferenceTransfert = /^TX-\d{8}-\d{6}$/i.test(code);
      if ((estCodeTransfert || estReferenceTransfert) && secretDisponible()) {
        const trouve = await chercherTransfertPublic(code, estCodeTransfert);
        if (trouve) return res.status(200).json({ transfert: trouve, branding: donnees.branding || {} });
        if (estReferenceTransfert) {
          const balayage = await passage({
            nature: "suivi-introuvable", cle: adresseDe(req),
            max: INTROUVABLES_PAR_FENETRE, fenetreMs: FENETRE_SUIVI_MS,
          });
          if (balayage.bloque) {
            return refuser(res, balayage.dansSecondes,
              "Trop de références inconnues depuis cette connexion. Réessayez dans quelques minutes.");
          }
          return res.status(200).json({ colis: [], users: [] });
        }
        // Un code de huit caractères qui ne correspond à rien peut aussi être un numéro de colis :
        // on continue la recherche plus bas plutôt que de refuser tout de suite.
      }
      const trouve = (donnees.colis || []).find((c) => String(c.tracking || "").toUpperCase() === code);
      if (!trouve) {
        /*
         * Un numéro introuvable ne coûte rien à celui qui s'est trompé, et beaucoup à celui qui
         * balaie. On le compte donc à part, avec un plafond plus bas — et la réponse reste la
         * même (une liste vide) pour ne pas apprendre à l'automate ce qui existe et ce qui n'existe
         * pas.
         */
        const balayage = await passage({
          nature: "suivi-introuvable", cle: adresseDe(req),
          max: INTROUVABLES_PAR_FENETRE, fenetreMs: FENETRE_SUIVI_MS,
        });
        if (balayage.bloque) {
          return refuser(res, balayage.dansSecondes,
            "Trop de numéros de suivi inconnus depuis cette connexion. Réessayez dans quelques minutes.");
        }
        return res.status(200).json({ colis: [], users: [] });
      }
      const partenaire = trouve.partenaireId
        ? partenairePublic((donnees.users || []).find((u) => u.id === trouve.partenaireId))
        : null;
      return res.status(200).json({
        colis: [colisPublic(trouve)],
        users: partenaire ? [partenaire] : [],
        branding: donnees.branding || {},
      });
    }

    return res.status(400).json({ error: "Précisez ce que vous demandez : suivi, vitrine ou cgu." });
  } catch (e) {
    console.error("Échec de la lecture publique", e);
    return res.status(502).json({ error: "Données momentanément indisponibles." });
  }
}
