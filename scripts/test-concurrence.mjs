import assert from "node:assert/strict";
import { collectionsQuiFondent } from "../api/_cloisonnement.js";
import { readFile } from "node:fs/promises";

const base = {
  clientAccounts: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}` })),
  repertoire: Array.from({ length: 343 }, (_, i) => ({ id: `r${i}` })),
  depenses: Array.from({ length: 9 }, (_, i) => ({ id: `d${i}` })),
  colis: [{ tracking: "BDE-1" }],
};
const vide = { clientAccounts: [], repertoire: [], depenses: [], colis: [] };
const fondues = collectionsQuiFondent(base, vide).map((x) => `${x.cle}:${x.avant}->${x.apres}`);
assert.deepEqual(fondues, ["colis:1->0", "clientAccounts:8->0", "repertoire:343->0", "depenses:9->0"]);

const cloisonnement = await readFile(new URL("../api/_cloisonnement.js", import.meta.url), "utf8");
const donnees = await readFile(new URL("../api/donnees.js", import.meta.url), "utf8");
const storage = await readFile(new URL("../src/lib/storage.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const baseApi = await readFile(new URL("../api/_base.js", import.meta.url), "utf8");
assert.match(cloisonnement, /compte === 0/);
assert.match(donnees, /updated_at=eq/);
assert.match(donnees, /baseVersion/);
assert.match(donnees, /status\(409\)\.json\(\{[\s\S]*conflit/);
assert.match(storage, /baseVersion/);
assert.match(app, /r && r\.conflict/);
assert.match(baseApi, /updated_at=eq/);
assert.match(baseApi, /conflit_version/);

const ligne = { value: { colis: [{ tracking: "BDE-1" }] }, updated_at: "v1" };
async function ecrireAgent(expected, value) {
  await new Promise((resolve) => setTimeout(resolve, 2));
  if (ligne.updated_at !== expected) return { conflict: true, latest: ligne };
  ligne.value = value;
  ligne.updated_at = `v${Number(expected.slice(1)) + 1}`;
  return { ok: true };
}
const versionLueParA = ligne.updated_at;
const versionLueParB = ligne.updated_at;
const [a, b] = await Promise.all([
  ecrireAgent(versionLueParA, { colis: [{ tracking: "BDE-A" }] }),
  ecrireAgent(versionLueParB, { colis: [{ tracking: "BDE-B" }] }),
]);
assert.equal([a.ok, b.ok].filter(Boolean).length, 1);
assert.equal([a.conflict, b.conflict].filter(Boolean).length, 1);
assert.equal(ligne.value.colis[0].tracking, "BDE-A");
console.log("OK: tableaux vides protégés, CAS updated_at présent, conflit rechargé sans file d’attente, deux agents sans écrasement.");
