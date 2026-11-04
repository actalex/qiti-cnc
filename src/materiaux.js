/* ====================== Matériaux ====================== */
// Valeurs de départ prudentes pour une machine légère (broche 775) : à ajuster après un essai dans une chute.
// Fraise plate : avance et plongée en mm/min, profondeur par passe = doc × diamètre (plafonnée) ; fraise en V : valeurs fixes.
const MATERIALS = [
  { id: 'tendre', name: 'Bois tendre (pin, peuplier)', flat: { feed: 800, plunge: 250, doc: 0.5, docMax: 2 }, v: { feed: 700, plunge: 200, doc: 1 } },
  { id: 'dur', name: 'Bois dur (chêne, hêtre, noyer)', flat: { feed: 500, plunge: 150, doc: 0.3, docMax: 1.2 }, v: { feed: 500, plunge: 150, doc: 0.6 } },
  { id: 'mdf', name: 'MDF', flat: { feed: 700, plunge: 200, doc: 0.4, docMax: 1.5 }, v: { feed: 600, plunge: 200, doc: 0.8 } },
  { id: 'cp', name: 'Contreplaqué', flat: { feed: 600, plunge: 200, doc: 0.35, docMax: 1.5 }, v: { feed: 500, plunge: 150, doc: 0.8 } },
  { id: 'pmma', name: 'Acrylique (PMMA coulé)', flat: { feed: 500, plunge: 100, doc: 0.2, docMax: 0.8 }, v: { feed: 400, plunge: 100, doc: 0.4 } }
];
// Réglages d'une fraise pour un matériau ; les petites fraises plates vont moins vite (casse)
function materialParams(mat, T) {
  if (T.type === 'v') return { ...mat.v };
  const k = T.d <= 1 ? 0.4 : T.d < 2 ? 0.6 : 1, r = v => Math.max(5, Math.round(v * k / 10) * 10);
  return { feed: r(mat.flat.feed), plunge: r(mat.flat.plunge), doc: Math.max(0.1, Math.round(Math.min(mat.flat.docMax, mat.flat.doc * T.d) * 20) / 20) };
}
// Réglages retenus par couple matériau + fraise : S.cuts[matériau][id de fraise] = { feed, plunge, doc, knob }. Toute
// avance, plongée ou profondeur par passe saisie pendant qu'un matériau est choisi y est gardée ; rechoisir ce matériau
// les reprend à la place des valeurs de départ. knob = repère du variateur de broche (texte libre), rappelé avant gravure.
if (!S.cuts) S.cuts = {};
const cutOf = (T, mat = S.material) => (mat && S.cuts[mat] && S.cuts[mat][T.id]) || null;
function rememberCut(T, knob) {
  if (!S.material) return;
  const c = (S.cuts[S.material] ??= {}), o = c[T.id] || {};
  c[T.id] = { feed: T.feed, plunge: T.plunge, doc: T.doc, knob: knob ?? o.knob ?? '' };
}
// Avances plafonnées aux vitesses max de la carte ($110-$112, lues à la connexion) : la machine ne va pas plus vite.
// Renvoie les plafonds appliqués (texte), '' si aucun.
function applyMaterial(id) {
  const mat = MATERIALS.find(m => m.id === id); if (!mat) return null;
  const r = S.machine.plan && S.machine.plan.rate, capXY = r ? Math.min(r[0], r[1]) : Infinity, capZ = r ? r[2] : Infinity, capped = new Set();
  for (const T of S.tools) {
    const own = cutOf(T, id), p = own ? { feed: own.feed, plunge: own.plunge, doc: own.doc } : materialParams(mat, T);
    if (p.feed > capXY) { p.feed = capXY; capped.add(`avance ${capXY}`); }
    if (p.plunge > capZ) { p.plunge = capZ; capped.add(`plongée ${capZ}`); }
    Object.assign(T, p);
  }
  return [...capped].join(', ');
}
