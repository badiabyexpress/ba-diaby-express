/**
 * TRANSFERT D'ARGENT — la porte.
 *
 * Tout ce qui touche à l'argent passe ici, et nulle part ailleurs. Le navigateur ne parle jamais
 * aux tables : il présente son jeton de session, cette fonction vérifie la permission, recalcule
 * les montants depuis le barème enregistré, puis appelle une fonction SQL qui fait le travail dans
 * une seule transaction.
 *
 * TROIS RÈGLES QUI NE SE NÉGOCIENT PAS
 *
 * 1. Les montants envoyés par la page ne sont jamais crus. On les recalcule. La page affiche un
 *    devis pour que l'agent annonce un prix ; c'est un confort d'affichage, pas une source.
 *
 * 2. Le paiement n'est pas décidé ici. Cette fonction lit, vérifie, journalise — mais c'est
 *    `payer_transfert()` en SQL qui verrouille la ligne et tranche. Deux agents qui présentent le
 *    même code au même instant sont départagés par Postgres, pas par du JavaScript qui a lu avant.
 *
 * 3. Rien ne se détruit. Une annulation est une écriture de plus, jamais un effacement, et les
 *    déclencheurs de la base refusent la suppression de ligne même à la clé de service. Un
 *    administrateur peut RETIRER un transfert de ses listes — la ligne reste, le journal garde
 *    tout, et la caisse est ajustée quand l'argent n'était pas encore sorti.
 *
 * LE PLAFOND SUR LA RECHERCHE PAR CODE
 *
 * Huit chiffres, c'est cent millions de combinaisons — parcourables par un programme si on le
 * laisse faire. Le plafond est donc la vraie protection du code, et il compte les ÉCHECS : un
 * agent qui paie dix transferts d'affilée n'est pas gêné, un programme qui tape des codes au
 * hasard est arrêté au bout de dix essais infructueux.
 */

import { sessionDeLaRequete, empreinteDuCompte } from "./_session.js";
import { effectivePermission } from "./_permissions.js";
import { lireCle } from "./_base.js";
import { passage, adresseDe, refuser } from "./_verrou.js";
import {
  secretDisponible, genererCode, normaliserCode, empreinteCode, chiffrerCode, dechiffrerCode,
  configTransfert, calculerTransfert, dateExpiration, porteeLecture, vueAvantPaiement,
} from "./_transferts.js";

function configuration() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    cle: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function entetes(cle) {
  return { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };
}

/** Appelle une fonction SQL. Les opérations d'argent passent toutes par là. */
async function rpc(nom, charge) {
  const { url, cle } = configuration();
  const reponse = await fetch(`${url}/rest/v1/rpc/${nom}`, {
    method: "POST", headers: entetes(cle), body: JSON.stringify({ p: charge }),
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(`rpc_${nom}_${reponse.status}:${JSON.stringify(corps).slice(0, 200)}`);
  return corps;
}

async function selection(chemin) {
  const { url, cle } = configuration();
  const reponse = await fetch(`${url}/rest/v1/${chemin}`, { headers: entetes(cle) });
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`select_${reponse.status}:${detail.slice(0, 200)}`);
  }
  return reponse.json();
}

/*
 * LE COMPTE DERRIÈRE LE JETON.
 *
 * Le jeton dit qui s'est connecté ; il ne dit pas ce que ce compte a le droit de faire
 * MAINTENANT. On relit donc le compte dans le document — permissions comprises — et on vérifie au
 * passage que le jeton n'a pas été révoqué depuis. Sans cette relecture, retirer à quelqu'un le
 * droit de payer un transfert ne prendrait effet qu'à l'expiration de son jeton, douze heures
 * plus tard.
 */
async function compteDeLaRequete(req) {
  const session = sessionDeLaRequete(req);
  if (!session) return { erreur: { code: 401, message: "Session absente ou expirée." } };
  if (session.role === "client" || session.role === "Partenaire") {
    return { erreur: { code: 403, message: "Le transfert d’argent est réservé à l’équipe." } };
  }
  const { valeur: document } = await lireCle("bde-data");
  const compte = (document?.users || []).find((u) => u && u.id === session.sub);
  if (!compte) return { erreur: { code: 401, message: "Ce compte n’existe plus." } };
  if (!session.emp || session.emp !== empreinteDuCompte(compte)) {
    return { erreur: { code: 401, message: "Session révoquée. Reconnectez-vous." } };
  }
  return { compte, document, session };
}

const nomDe = (c) => `${c?.prenom || ""} ${c?.nom || ""}`.trim() || c?.identifiant || "—";
const agenceDe = (c) => String(c?.zoneOperation || c?.agence || "").trim();

/** Une chaîne prête à entrer dans un filtre PostgREST, sans casser la requête. */
const litteral = (v) => encodeURIComponent(String(v ?? "").replace(/[(),]/g, " "));

export default async function handler(req, res) {
  const { url, cle } = configuration();
  if (!url || !cle) {
    return res.status(501).json({ error: "Le serveur n’est pas configuré pour la base de données." });
  }
  if (!secretDisponible()) {
    return res.status(501).json({ error: "Le serveur n’a pas de secret de signature : les codes de retrait ne peuvent pas être protégés." });
  }

  const { compte, document, erreur } = await compteDeLaRequete(req).catch((e) => ({
    erreur: { code: 502, message: `Base injoignable (${e.message}).` },
  }));
  if (erreur) return res.status(erreur.code).json({ error: erreur.message });

  const perm = (k) => effectivePermission(compte, k);
  const config = configTransfert(document);
  const ip = adresseDe(req);
  const contexteActeur = {
    acteur_role: compte.role || "",
    adresse_ip: ip,
  };

  try {
    if (req.method === "GET") return await lire(req, res, { compte, document, config, perm });
    if (req.method === "POST") return await ecrire(req, res, { compte, document, config, perm, contexteActeur, ip });
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    console.error("Transfert d’argent — erreur :", e);
    return res.status(500).json({ error: "L’opération n’a pas abouti. Rien n’a été enregistré." });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   LECTURE
   ══════════════════════════════════════════════════════════════════════════════ */

/** Le filtre PostgREST qui traduit la portée de lecture du compte. */
function filtrePortee(compte, perm) {
  const p = porteeLecture((c, k) => effectivePermission(c, k), compte);
  if (p.portee === "tous") return "";
  if (p.portee === "zone") {
    // Sa zone, c'est ce qu'elle a envoyé ET ce qu'elle a payé : les deux moitiés de son activité.
    return `&or=(agence_envoi.eq.${litteral(p.zone)},agence_paiement.eq.${litteral(p.zone)})`;
  }
  if (p.portee === "propres") {
    return `&or=(cree_par_id.eq.${litteral(p.id)},paye_par_id.eq.${litteral(p.id)})`;
  }
  return null; // aucune portée : on ne rend rien du tout
}

async function lire(req, res, { compte, document, config, perm }) {
  const q = req.query || {};

  /* ── Le barème, pour que l'écran affiche un devis identique à celui du serveur ── */
  if (q.config) {
    return res.status(200).json({ config, sites: (document?.sites || []).map((s) => ({ id: s.id, nom: s.nom, pays: s.pays })) });
  }

  /* ── Recherche par code : le geste de l'agent payeur ── */
  if (q.code) {
    if (!perm("transfert.payer") && !perm("transfert.voir_tous")) {
      return res.status(403).json({ error: "Vous n’avez pas le droit de payer un transfert." });
    }
    const code = normaliserCode(q.code);
    if (!code) return res.status(400).json({ error: "Un code de transfert compte huit chiffres." });

    const trouves = await selection(`transferts?code_hash=eq.${empreinteCode(code)}&supprime_le=is.null&select=*`);
    const t = Array.isArray(trouves) ? trouves[0] : null;

    /*
     * Le plafond ne compte QUE les échecs. Un agent qui paie vingt transferts dans la matinée ne
     * doit jamais être bloqué ; un programme qui essaie des codes au hasard échoue à chaque coup
     * et s'arrête au dixième.
     */
    if (!t) {
      const v = await passage({ nature: "transfert-code", cle: `${compte.id}|${adresseDe(req)}`, max: 10, fenetreMs: 10 * 60000 });
      if (v.bloque) return refuser(res, v.dansSecondes, "Trop de codes essayés sans succès. Réessayez dans quelques minutes.");
      return res.status(404).json({ error: "Aucun transfert ne porte ce code." });
    }
    return res.status(200).json({ transfert: vueAvantPaiement(t) });
  }

  /* ── Redonner le code au client qui a perdu son reçu — geste tracé ── */
  if (q.revoir) {
    if (!perm("transfert.revoir_code")) {
      return res.status(403).json({ error: "Vous n’avez pas le droit de réafficher un code de retrait." });
    }
    const lignes = await selection(`transferts?id=eq.${litteral(q.revoir)}&supprime_le=is.null&select=*`);
    const t = Array.isArray(lignes) ? lignes[0] : null;
    if (!t) return res.status(404).json({ error: "Transfert introuvable." });
    if (t.statut === "Payé" || t.statut === "Annulé") {
      return res.status(409).json({ error: `Ce transfert est ${t.statut.toLowerCase()} : son code ne sert plus à rien.` });
    }
    const code = dechiffrerCode(t.code_chiffre);
    if (!code) return res.status(500).json({ error: "Le code n’a pas pu être relu." });
    await journaliser({
      transfert_id: t.id, reference: t.reference, action: "code_reaffiche",
      acteur_id: compte.id, acteur_nom: nomDe(compte), acteur_role: compte.role,
      agence: agenceDe(compte), adresse_ip: adresseDe(req),
      apres: { motif: String(req.query.motif || "").slice(0, 300) },
    });
    return res.status(200).json({ code, reference: t.reference });
  }

  /* ── Le journal d'un transfert ── */
  if (q.journal) {
    if (!perm("transfert.journal") && !perm("transfert.voir_tous")) {
      return res.status(403).json({ error: "Vous n’avez pas accès au journal des transferts." });
    }
    const filtre = q.journal === "1" ? "" : `&transfert_id=eq.${litteral(q.journal)}`;
    const lignes = await selection(`transferts_audit?select=*${filtre}&order=le.desc&limit=${Math.min(Number(q.limite) || 200, 500)}`);
    return res.status(200).json({ journal: lignes });
  }

  /* ── La caisse : mouvements et soldes ── */
  if (q.caisse) {
    if (!perm("transfert.caisse") && !perm("transfert.voir_propres")) {
      return res.status(403).json({ error: "Vous n’avez pas accès à la caisse des transferts." });
    }
    /*
     * Qui ne voit que ses propres transferts ne voit que ses propres mouvements. C'est la même
     * règle que pour la liste : la caisse d'un collègue n'est pas une information d'ambiance.
     */
    let filtre = "";
    if (!perm("transfert.voir_tous")) {
      if (perm("transfert.voir_zone") && agenceDe(compte)) filtre = `&agence=eq.${litteral(agenceDe(compte))}`;
      else filtre = `&agent_id=eq.${litteral(compte.id)}`;
    }
    const mouvements = await selection(`transferts_mouvements?select=*${filtre}&order=le.desc&limit=${Math.min(Number(q.limite) || 300, 1000)}`);
    return res.status(200).json({ mouvements, soldes: soldesDepuisMouvements(mouvements) });
  }

  /* ── La liste, et les chiffres du tableau de bord ── */
  const portee = filtrePortee(compte, perm);
  if (portee === null) {
    return res.status(200).json({ transferts: [], total: 0, portee: "aucune" });
  }

  const filtres = [];
  if (q.statut) filtres.push(`&statut=eq.${litteral(q.statut)}`);
  if (q.agence) filtres.push(`&or=(agence_envoi.eq.${litteral(q.agence)},agence_paiement.eq.${litteral(q.agence)})`);
  if (q.pays) filtres.push(`&ben_pays=eq.${litteral(q.pays)}`);
  if (q.ville) filtres.push(`&ben_ville=eq.${litteral(q.ville)}`);
  if (q.agent) filtres.push(`&or=(cree_par_id.eq.${litteral(q.agent)},paye_par_id.eq.${litteral(q.agent)})`);
  if (q.depuis) filtres.push(`&cree_le=gte.${litteral(q.depuis)}`);
  if (q.jusqua) filtres.push(`&cree_le=lte.${litteral(q.jusqua)}`);

  /*
   * LA RECHERCHE GLOBALE — six façons de retrouver un transfert au comptoir.
   *
   * Le code n'en fait pas partie et ne peut pas en faire partie : il n'existe dans la base que
   * sous forme d'empreinte, donc seule l'égalité exacte le retrouve (voir plus haut). Taper un
   * code ici ne donnerait rien ; l'écran le renvoie vers la recherche par code.
   */
  if (q.recherche) {
    const r = litteral(String(q.recherche).trim());
    filtres.push(`&or=(reference.ilike.*${r}*,exp_telephone.ilike.*${r}*,ben_telephone.ilike.*${r}*,`
      + `exp_nom.ilike.*${r}*,exp_prenom.ilike.*${r}*,ben_nom.ilike.*${r}*,ben_prenom.ilike.*${r}*,`
      + `exp_piece_numero.ilike.*${r}*)`);
  }

  const limite = Math.min(Number(q.limite) || 200, 1000);
  /*
   * Un transfert supprimé ne figure plus nulle part : ni dans la liste, ni dans les totaux. Il
   * n'est pas effacé pour autant — le journal le montre encore, et c'est là qu'on va le chercher.
   */
  const lignes = await selection(`transferts?select=*&supprime_le=is.null${portee}${filtres.join("")}&order=cree_le.desc&limit=${limite}`);
  const vus = lignes.map(vueAvantPaiement);
  return res.status(200).json({
    transferts: vus,
    total: vus.length,
    portee: porteeLecture((c, k) => effectivePermission(c, k), compte).portee,
    stats: statistiques(lignes),
  });
}

/** Les soldes par agent et par agence, dans chaque devise — l'argent ne s'additionne qu'à devise égale. */
function soldesDepuisMouvements(mouvements) {
  const parAgent = new Map();
  const parAgence = new Map();
  const ajouter = (carte, cle, m) => {
    if (!carte.has(cle)) carte.set(cle, { cle, devises: {} });
    const g = carte.get(cle);
    const d = m.devise || "?";
    if (!g.devises[d]) g.devises[d] = { entrees: 0, sorties: 0, solde: 0 };
    const montant = Number(m.montant) || 0;
    if (m.sens === "entree") { g.devises[d].entrees += montant; g.devises[d].solde += montant; }
    else { g.devises[d].sorties += montant; g.devises[d].solde -= montant; }
  };
  (mouvements || []).forEach((m) => {
    ajouter(parAgent, `${m.agent_nom || m.agent_id}`, m);
    ajouter(parAgence, `${m.agence || "—"}`, m);
  });
  return { parAgent: [...parAgent.values()], parAgence: [...parAgence.values()] };
}

/** Les chiffres du tableau de bord, calculés sur ce que le compte a le droit de voir. */
function statistiques(lignes) {
  const vide = () => ({ nombre: 0, montants: {} });
  const stats = {
    total: 0,
    envoye: {}, paye: {}, frais: {}, commissions: {},
    parStatut: {},
  };
  const cumuler = (cible, devise, montant) => {
    cible[devise] = (cible[devise] || 0) + (Number(montant) || 0);
  };
  (lignes || []).forEach((t) => {
    stats.total += 1;
    if (!stats.parStatut[t.statut]) stats.parStatut[t.statut] = vide();
    stats.parStatut[t.statut].nombre += 1;
    cumuler(stats.parStatut[t.statut].montants, t.devise_envoi, t.montant_envoye);
    cumuler(stats.envoye, t.devise_envoi, t.montant_envoye);
    cumuler(stats.frais, t.devise_envoi, t.frais);
    cumuler(stats.commissions, t.devise_envoi,
      (Number(t.commission_agent_envoi) || 0) + (Number(t.commission_agent_paiement) || 0)
      + (Number(t.commission_agence) || 0) + (Number(t.commission_reseau) || 0));
    if (t.statut === "Payé") cumuler(stats.paye, t.devise_reception, t.montant_remis ?? t.montant_a_recevoir);
  });
  return stats;
}

async function journaliser(ligne) {
  const { url, cle } = configuration();
  await fetch(`${url}/rest/v1/transferts_audit`, {
    method: "POST",
    headers: { ...entetes(cle), Prefer: "return=minimal" },
    body: JSON.stringify(ligne),
  }).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════════
   ÉCRITURE
   ══════════════════════════════════════════════════════════════════════════════ */

async function ecrire(req, res, { compte, document, config, perm, contexteActeur, ip }) {
  const corps = req.body || {};
  const action = String(corps.action || "");

  if (action === "devis") {
    // Un devis ne touche à rien : il sert à l'écran, avec les chiffres du serveur.
    const devis = calculerTransfert(config, document, corps);
    if (devis.erreur) return res.status(400).json({ error: devis.erreur });
    return res.status(200).json({ devis });
  }

  if (action === "creer") return creer(req, res, { compte, document, config, perm, contexteActeur });
  if (action === "payer") return payer(req, res, { compte, perm, contexteActeur, ip });
  if (action === "annuler") return annuler(req, res, { compte, perm, contexteActeur });
  if (action === "supprimer") return supprimer(req, res, { compte, contexteActeur });
  if (action === "expirer") {
    if (!perm("transfert.voir_tous")) return res.status(403).json({ error: "Réservé à l’administration." });
    const n = await rpcSansCharge("expirer_transferts");
    return res.status(200).json({ expires: n });
  }
  return res.status(400).json({ error: "Action inconnue." });
}

async function rpcSansCharge(nom) {
  const { url, cle } = configuration();
  const reponse = await fetch(`${url}/rest/v1/rpc/${nom}`, { method: "POST", headers: entetes(cle), body: "{}" });
  if (!reponse.ok) throw new Error(`rpc_${nom}_${reponse.status}`);
  return reponse.json();
}

async function creer(req, res, { compte, document, config, perm, contexteActeur }) {
  if (!perm("transfert.creer")) {
    return res.status(403).json({ error: "Vous n’avez pas le droit de créer un transfert." });
  }
  if (config.actif === false) {
    return res.status(409).json({ error: "Le transfert d’argent est désactivé dans la configuration." });
  }
  const c = req.body || {};

  const manque = [
    [!String(c.expNom || "").trim(), "le nom de l’expéditeur"],
    [!String(c.expTelephone || "").trim(), "le téléphone de l’expéditeur"],
    [!String(c.benNom || "").trim(), "le nom du bénéficiaire"],
    [!String(c.benPays || "").trim(), "le pays du bénéficiaire"],
  ].filter(([vide]) => vide).map(([, quoi]) => quoi);
  if (manque.length) {
    return res.status(400).json({ error: `Il manque ${manque.join(", ")}.` });
  }

  /*
   * LES MONTANTS SONT RECALCULÉS, PAS REÇUS.
   *
   * La page a envoyé son devis ; on ne le regarde même pas. Seuls la devise d'envoi, la devise de
   * réception et le montant envoyé sont des saisies — tout le reste se déduit du barème.
   */
  const devis = calculerTransfert(config, document, {
    deviseEnvoi: c.deviseEnvoi, deviseReception: c.deviseReception, montantEnvoye: c.montantEnvoye,
  });
  if (devis.erreur) return res.status(400).json({ error: devis.erreur });

  /*
   * Un code déjà pris est un événement rare mais pas impossible — cent millions de codes, et
   * l'unicité est garantie par la base, pas par le tirage. On retire plutôt que d'échouer.
   */
  let code = null, empreinte = null;
  for (let essai = 0; essai < 5 && !code; essai++) {
    const candidat = genererCode();
    const h = empreinteCode(candidat);
    const dejaPris = await selection(`transferts?code_hash=eq.${h}&select=id&limit=1`);
    if (!Array.isArray(dejaPris) || dejaPris.length === 0) { code = candidat; empreinte = h; }
  }
  if (!code) return res.status(503).json({ error: "Impossible de tirer un code libre. Réessayez." });

  const agence = agenceDe(compte) || String(c.agenceEnvoi || "").trim() || "—";
  const resultat = await rpc("creer_transfert", {
    ...contexteActeur,
    code_hash: empreinte,
    code_chiffre: chiffrerCode(code),
    exp_nom: String(c.expNom).trim(), exp_prenom: String(c.expPrenom || "").trim(),
    exp_telephone: String(c.expTelephone).trim(),
    exp_piece_type: c.expPieceType || null, exp_piece_numero: c.expPieceNumero || null,
    exp_adresse: c.expAdresse || null, exp_pays: c.expPays || null,
    ben_nom: String(c.benNom).trim(), ben_prenom: String(c.benPrenom || "").trim(),
    ben_telephone: c.benTelephone || null,
    ben_pays: String(c.benPays).trim(), ben_ville: c.benVille || null, ben_agence: c.benAgence || null,
    devise_envoi: devis.deviseEnvoi, devise_reception: devis.deviseReception,
    montant_envoye: devis.montantEnvoye, taux: devis.taux, frais: devis.frais,
    total_paye: devis.totalPaye, montant_a_recevoir: devis.montantARecevoir,
    commission_agent_envoi: devis.commissionAgentEnvoi,
    commission_agent_paiement: devis.commissionAgentPaiement,
    commission_agence: devis.commissionAgence,
    commission_reseau: devis.commissionReseau,
    cree_par_id: compte.id, cree_par_nom: nomDe(compte),
    agence_envoi: agence, pays_envoi: c.paysEnvoi || null, zone_envoi: agenceDe(compte) || null,
    expire_le: dateExpiration(config),
    note: c.note || null,
  });

  if (!resultat?.ok) return res.status(400).json({ error: "La création n’a pas abouti." });

  /*
   * Le code n'est rendu QU'ICI, une seule fois, à celui qui vient de créer le transfert. Il ne
   * repassera plus par aucune liste : le redemander est un geste séparé, tracé.
   */
  return res.status(200).json({ transfert: resultat.transfert, code });
}

async function payer(req, res, { compte, perm, contexteActeur, ip }) {
  if (!perm("transfert.payer")) {
    return res.status(403).json({ error: "Vous n’avez pas le droit de payer un transfert." });
  }
  const c = req.body || {};
  const code = normaliserCode(c.code);
  if (!code) return res.status(400).json({ error: "Un code de transfert compte huit chiffres." });

  /*
   * L'IDENTITÉ DU BÉNÉFICIAIRE EST EXIGÉE PAR LE SERVEUR, PAS SEULEMENT PAR L'ÉCRAN.
   *
   * C'est la seule vérification qui protège l'expéditeur : sans elle, quiconque connaît le code
   * repart avec l'argent, et rien dans le dossier ne dit à qui il a été remis.
   */
  const manque = [
    [!String(c.benNomVerifie || "").trim(), "le nom relevé sur la pièce"],
    [!String(c.benPieceType || "").trim(), "le type de pièce"],
    [!String(c.benPieceNumero || "").trim(), "le numéro de la pièce"],
  ].filter(([vide]) => vide).map(([, quoi]) => quoi);
  if (manque.length) {
    return res.status(400).json({ error: `Avant de payer, renseignez ${manque.join(", ")}.` });
  }

  const resultat = await rpc("payer_transfert", {
    ...contexteActeur,
    code_hash: empreinteCode(code),
    agent_id: compte.id, agent_nom: nomDe(compte), agence: agenceDe(compte) || "—",
    ben_piece_type: String(c.benPieceType).trim(),
    ben_piece_numero: String(c.benPieceNumero).trim(),
    ben_nom_verifie: String(c.benNomVerifie).trim(),
    ben_telephone_verifie: c.benTelephoneVerifie || null,
    montant_remis: c.montantRemis != null && c.montantRemis !== "" ? Number(c.montantRemis) : null,
  });

  if (resultat?.ok) {
    return res.status(200).json({ transfert: resultat.transfert });
  }

  /*
   * Les refus sont nommés, parce que l'agent a quelqu'un devant lui et doit pouvoir lui dire
   * exactement pourquoi il ne peut pas payer.
   */
  const messages = {
    introuvable: "Aucun transfert ne porte ce code.",
    deja_paye: "Ce transfert a déjà été payé.",
    annule: "Ce transfert a été annulé.",
    expire: "Ce transfert a expiré : le code ne vaut plus. L’expéditeur doit se rapprocher de son agence.",
    supprime: "Ce transfert a été retiré par l’administration : ne remettez pas d’argent. L’expéditeur doit se rapprocher de son agence.",
  };
  const raison = resultat?.raison || "introuvable";
  if (raison === "introuvable") {
    const v = await passage({ nature: "transfert-code", cle: `${compte.id}|${ip}`, max: 10, fenetreMs: 10 * 60000 });
    if (v.bloque) return refuser(res, v.dansSecondes, "Trop de codes essayés sans succès. Réessayez dans quelques minutes.");
  }
  return res.status(raison === "introuvable" ? 404 : 409).json({
    error: messages[raison] || "Ce transfert ne peut pas être payé.",
    raison,
    detail: {
      payeLe: resultat?.paye_le || null,
      payePar: resultat?.paye_par || null,
      agencePaiement: resultat?.agence_paiement || null,
      expireLe: resultat?.expire_le || null,
      motif: resultat?.motif || null,
    },
  });
}

/*
 * SUPPRIMER — le seul geste du module qui ne s'accorde pas par permission.
 *
 * Toutes les autres actions passent par une clé qu'on peut donner nommément à quelqu'un. Pas
 * celle-ci : elle retire une opération financière des listes de l'entreprise, et elle est
 * réservée à l'administrateur, point. Une permission « supprimer un transfert » se donnerait un
 * jour à quelqu'un pour dépanner, et resterait.
 *
 * Elle ne détruit rien : la ligne demeure en base, le journal garde tout, et la caisse reste
 * juste — l'encaissement d'un transfert non payé est rendu, celui d'un transfert payé ne l'est
 * pas, parce que l'argent est réellement sorti du tiroir.
 */
async function supprimer(req, res, { compte, contexteActeur }) {
  if (compte.role !== "Administrateur") {
    return res.status(403).json({ error: "Seul un administrateur peut supprimer un transfert." });
  }
  const c = req.body || {};
  const motif = String(c.motif || "").trim();
  if (motif.length < 3) {
    return res.status(400).json({ error: "Une suppression se motive : dites pourquoi, en quelques mots." });
  }
  const resultat = await rpc("supprimer_transfert", {
    ...contexteActeur,
    id: c.id,
    acteur_id: compte.id, acteur_nom: nomDe(compte), agence: agenceDe(compte) || null,
    motif,
  });
  if (resultat?.ok) return res.status(200).json({ transfert: resultat.transfert });
  const messages = {
    introuvable: "Transfert introuvable.",
    deja_supprime: "Ce transfert a déjà été supprimé.",
  };
  return res.status(409).json({ error: messages[resultat?.raison] || "La suppression n’a pas abouti." });
}

async function annuler(req, res, { compte, perm, contexteActeur }) {
  if (!perm("transfert.annuler")) {
    return res.status(403).json({ error: "Vous n’avez pas le droit d’annuler un transfert." });
  }
  const c = req.body || {};
  const motif = String(c.motif || "").trim();
  if (motif.length < 3) {
    return res.status(400).json({ error: "Une annulation se motive : dites pourquoi, en quelques mots." });
  }
  const resultat = await rpc("annuler_transfert", {
    ...contexteActeur,
    id: c.id,
    acteur_id: compte.id, acteur_nom: nomDe(compte), agence: agenceDe(compte) || null,
    motif,
  });
  if (resultat?.ok) return res.status(200).json({ transfert: resultat.transfert });
  const messages = {
    introuvable: "Transfert introuvable.",
    deja_paye: "Ce transfert a déjà été payé : il ne peut plus être annulé.",
    deja_annule: "Ce transfert est déjà annulé.",
    supprime: "Ce transfert a été retiré des listes : il n’y a plus rien à annuler.",
  };
  return res.status(409).json({ error: messages[resultat?.raison] || "L’annulation n’a pas abouti." });
}
