/**
 * Fonction serverless Vercel — création d'un compte client.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * C'est l'un des deux derniers gestes qui écrivaient encore dans la base depuis le navigateur, et
 * pour cause : celui qui crée son compte n'a, par définition, pas encore de jeton. Tant que ce
 * geste passe par la clé publique, la base ne peut pas lui être fermée — sinon plus personne ne
 * pourrait s'inscrire.
 *
 * Le compte se crée donc ici. Le mot de passe est haché sur le serveur, avec exactement les mêmes
 * paramètres que le navigateur, et le client repart identifié : il reçoit le même jeton de session
 * que s'il venait de se connecter.
 *
 * CE QUE LE SERVEUR VÉRIFIE, ET QUE LE NAVIGATEUR NE POUVAIT PAS GARANTIR
 * ----------------------------------------------------------------------
 * Que l'identifiant est libre — la vérification côté navigateur se faisait sur une copie des
 * données qui pouvait avoir plusieurs minutes de retard, et rien n'empêchait de la contourner.
 * Que les champs obligatoires sont là, que le mot de passe tient debout, et qu'une même adresse
 * ne fabrique pas des comptes en rafale.
 */

import { baseConfiguree, modifierDocument } from "./_base.js";
import { identifiantsMotDePasse } from "./_motdepasse.js";
import { signerSession } from "./_session.js";

const LONGUEUR_MOT_DE_PASSE = 8;

/*
 * Un compteur par adresse. Comme dans api/login.js, ce n'est pas une protection absolue — une
 * fonction serverless peut être recréée — mais un ralentisseur : il suffit à empêcher qu'on
 * remplisse la base de comptes en quelques secondes.
 */
const creations = new Map();
function tropDeCreations(adresse) {
  const maintenant = Date.now();
  const e = creations.get(adresse);
  if (!e || maintenant - e.debut > 60 * 60 * 1000) { creations.set(adresse, { debut: maintenant, n: 1 }); return false; }
  e.n += 1;
  return e.n > 5;
}

/** Retire les espaces de bord et coupe : un nom de 10 000 caractères n'est pas un nom. */
function propre(valeur, maximum = 120) {
  return String(valeur ?? "").trim().slice(0, maximum);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!baseConfiguree()) {
    return res.status(501).json({ error: "Création de compte côté serveur non configurée" });
  }

  const adresse = String(req.headers["x-forwarded-for"] || "?");
  if (tropDeCreations(adresse)) {
    return res.status(429).json({ error: "Trop de comptes créés depuis cet appareil. Réessayez plus tard." });
  }

  try {
    const corps = req.body || {};
    const identifiant = propre(corps.identifiant, 60);
    const motdepasse = String(corps.motdepasse ?? "");
    const nom = propre(corps.nom);
    const prenom = propre(corps.prenom);
    const telephone = propre(corps.telephone, 30);

    if (!identifiant || !motdepasse || !nom || !prenom || !telephone) {
      return res.status(400).json({ error: "Nom, prénom, identifiant, mot de passe et téléphone sont obligatoires." });
    }
    if (motdepasse.length < LONGUEUR_MOT_DE_PASSE) {
      return res.status(400).json({ error: `Choisissez un mot de passe d’au moins ${LONGUEUR_MOT_DE_PASSE} caractères.` });
    }

    let conflit = false;
    const compte = await modifierDocument((document) => {
      const comptes = document.clientAccounts || [];
      if (comptes.some((c) => String(c.identifiant || "").toLowerCase() === identifiant.toLowerCase())) {
        conflit = true;
        return null; // rien n'est écrit
      }
      /*
       * L'identifiant se construit de l'horodatage ET d'un tirage : deux inscriptions dans la même
       * milliseconde — deux personnes au comptoir, un double clic — se seraient sinon vu attribuer
       * le même identifiant, et la seconde aurait écrasé la première.
       */
      const nouveau = {
        id: `cli${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        nom, prenom, identifiant,
        telephone,
        adresse: propre(corps.adresse, 200),
        email: propre(corps.email, 120),
        createdAt: new Date().toISOString(),
        ...identifiantsMotDePasse(motdepasse),
      };
      return {
        document: { ...document, clientAccounts: [...comptes, nouveau] },
        retour: nouveau,
      };
    });

    if (conflit) {
      return res.status(409).json({ error: "Cet identifiant est déjà utilisé. Choisissez-en un autre." });
    }
    if (!compte) return res.status(502).json({ error: "Création impossible pour le moment." });

    const session = signerSession({ userId: compte.id, identifiant: compte.identifiant, role: "client" }) || {};
    const {
      motdepasseSecure: _s, motdepasseSalt: _sel, motdepasseIter: _i, motdepasseAlgo: _a, ...compteSur
    } = compte;

    return res.status(200).json({ ...session, utilisateur: compteSur });
  } catch (e) {
    console.error("Échec de la création du compte client", e);
    return res.status(502).json({ error: "Création impossible pour le moment." });
  }
}
