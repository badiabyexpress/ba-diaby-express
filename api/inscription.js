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
import { signerSession, empreinteDuCompte } from "./_session.js";
import { passage, adresseDe, refuser } from "./_verrou.js";

/**
 * Le numéro de téléphone réduit à ce qui l'identifie, pour rapprocher deux écritures du même
 * numéro : « +224 612 47 93 39 », « 00224612479339 » et « 612479339 » désignent une seule personne.
 * On garde les huit derniers chiffres — assez pour ne pas confondre deux clients, assez peu pour
 * ignorer l'indicatif, qui est tantôt écrit et tantôt non.
 */
function clefTelephone(numero) {
  const chiffres = String(numero || "").replace(/\D/g, "");
  return chiffres.length >= 8 ? chiffres.slice(-8) : "";
}

const LONGUEUR_MOT_DE_PASSE = 8;

/*
 * Un compteur par adresse — dans la base, et non en mémoire.
 *
 * Il l'était : « ce n'est pas une protection absolue, une fonction serverless peut être recréée ».
 * C'était pire que cela. Il n'en existe pas une qu'on recrée : il s'en allume autant qu'il en
 * faut, chacune avec sa mémoire vide, et appeler vite suffisait à en faire naître d'autres —
 * chacune offrant cinq créations neuves. Le plafond ralentissait un client maladroit ; il
 * n'arrêtait pas celui qui remplit la base de comptes, c'est-à-dire ce contre quoi il était écrit.
 *
 * Le verrou de `_verrou.js` compte dans la base : il est le même pour toutes les instances.
 */
const CREATIONS_PAR_ADRESSE = 5;
const FENETRE_CREATIONS_MS = 60 * 60 * 1000;

/** Retire les espaces de bord et coupe : un nom de 10 000 caractères n'est pas un nom. */
function propre(valeur, maximum = 120) {
  return String(valeur ?? "").trim().slice(0, maximum);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!baseConfiguree()) {
    return res.status(501).json({ error: "Création de compte côté serveur non configurée" });
  }

  const limite = await passage({
    nature: "inscription", cle: adresseDe(req),
    max: CREATIONS_PAR_ADRESSE, fenetreMs: FENETRE_CREATIONS_MS,
  });
  if (limite.bloque) {
    return refuser(res, limite.dansSecondes,
      "Trop de comptes créés depuis cet appareil. Réessayez plus tard.");
  }

  try {
    const corps = req.body || {};
    const identifiant = propre(corps.identifiant, 60);
    const motdepasse = String(corps.motdepasse ?? "");
    const nom = propre(corps.nom);
    const prenom = propre(corps.prenom);
    const telephone = propre(corps.telephone, 30);

    const email = propre(corps.email, 120);
    if (!identifiant || !motdepasse || !nom || !prenom || !telephone || !email) {
      return res.status(400).json({ error: "Nom, prénom, identifiant, mot de passe, téléphone et e-mail sont obligatoires." });
    }
    /*
     * L'e-mail devient obligatoire, et ce n'est pas une formalité administrative.
     *
     * C'est la seconde voie par laquelle un client peut récupérer son compte : le code de
     * réinitialisation part sur son WhatsApp ET sur son adresse (voir api/motdepasse.js). Un
     * compte sans adresse ne tient donc qu'à un numéro — celui-là même qui change, se perd, ou
     * tombe hors de la fenêtre de vingt-quatre heures de WhatsApp. Il n'a alors plus aucune sortie
     * de secours, et il faut appeler l'agence.
     */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Cette adresse e-mail n’a pas une forme valide." });
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
      /*
       * LA FICHE OUVERTE AU COMPTOIR EST REPRISE, ELLE N'EST PAS DOUBLÉE.
       *
       * Un client qui refuse d'ouvrir un compte pendant qu'on tient son colis reçoit tout de même
       * une fiche : c'est elle qui porte ses colis. Sa facture l'invite ensuite à ouvrir son compte
       * lui-même. S'il le fait et qu'on lui crée une SECONDE fiche, il se connecte à un espace
       * vide — ses colis sont restés sur la première — et il conclut que le suivi ne marche pas.
       * C'est précisément le geste qu'on lui a demandé de faire qui le mènerait dans le mur.
       *
       * On rapproche donc sur le numéro de téléphone, seul repère commun aux deux moments. Une
       * fiche déjà pourvue d'identifiants n'est jamais reprise : ce serait s'emparer d'un compte
       * existant en connaissant un simple numéro.
       */
      const clef = clefTelephone(telephone);
      const aReprendre = clef
        ? comptes.find((c) => c && !c.identifiant && !c.motdepasseSecure && !c.motdepasse
            && clefTelephone(c.telephone) === clef)
        : null;
      if (aReprendre) {
        const repris = {
          ...aReprendre, nom, prenom, identifiant,
          telephone,
          adresse: propre(corps.adresse, 200) || aReprendre.adresse || "",
          email: propre(corps.email, 160) || aReprendre.email || "",
          compteOuvert: true,
          ouvertLe: new Date().toISOString(),
          ...identifiantsMotDePasse(motdepasse),
        };
        return {
          document: { ...document, clientAccounts: comptes.map((c) => (c.id === aReprendre.id ? repris : c)) },
          retour: repris,
        };
      }

      const nouveau = {
        id: `cli${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        nom, prenom, identifiant,
        telephone,
        adresse: propre(corps.adresse, 200),
        email,
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

    const session = signerSession({
      userId: compte.id, identifiant: compte.identifiant, role: "client",
      empreinte: empreinteDuCompte(compte),
    }) || {};
    const {
      motdepasseSecure: _s, motdepasseSalt: _sel, motdepasseIter: _i, motdepasseAlgo: _a, ...compteSur
    } = compte;

    return res.status(200).json({ ...session, utilisateur: compteSur });
  } catch (e) {
    console.error("Échec de la création du compte client", e);
    return res.status(502).json({ error: "Création impossible pour le moment." });
  }
}
