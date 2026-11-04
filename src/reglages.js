/* ====================== Sauvegarde des réglages ====================== */
// Fichier .json : fraises, réglages retenus par matériau (S.cuts), machine et options. Sert de sauvegarde (tout vit
// dans le localStorage du navigateur) et à passer de la page locale à la version en ligne, qui ne partagent pas leur
// stockage. À l'import, les fraises sont retrouvées par id puis par nom (comme à l'ouverture d'un projet), sinon ajoutées.
$('#bSetExport').onclick = () => {
  const { machine, tools, cuts, material, tabs, ramp, climb, origin } = S;
  download('atelier-cnc-reglages.json', JSON.stringify({ app: 'atelier-cnc-reglages', v: 1, machine, tools, cuts, material, tabs, ramp, climb, origin }, null, 1), 'application/json');
};
$('#bSetImport').onclick = () => $('#fSet').click();
$('#fSet').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (p.app !== 'atelier-cnc-reglages') throw new Error('Ce fichier n\'est pas une sauvegarde de réglages Atelier CNC.');
    const tools = p.tools || [];
    if (!confirm(`Importer les réglages du fichier (${tools.length} fraise(s), machine, réglages par matériau) ?\n\nLes fraises de même nom sont mises à jour, les autres ajoutées ; aucune n'est supprimée.`)) return;
    const remap = {};
    for (const pt of tools) {
      let t = S.tools.find(x => pt.id && x.id === pt.id) || S.tools.find(x => x.name === pt.name);
      if (t) Object.assign(t, pt, { id: t.id }); else { t = Object.assign({}, pt, { id: pt.id || newId() }); S.tools.push(t); }
      if (pt.id) remap[pt.id] = t.id;
    }
    for (const [m, byTool] of Object.entries(p.cuts || {})) {
      const c = (S.cuts[m] ??= {});
      for (const [id, v] of Object.entries(byTool)) c[remap[id] || id] = v;
    }
    if (p.machine) Object.assign(S.machine, p.machine);
    if (p.tabs) S.tabs = p.tabs; if (p.ramp) S.ramp = p.ramp; if (p.origin) S.origin = p.origin;
    if ('climb' in p) S.climb = !!p.climb; if ('material' in p) S.material = p.material || '';
    saveSettings(); $('#dlgMachine').close(); refreshAll();
    log(`Réglages importés : ${tools.length} fraise(s), ${Object.keys(p.cuts || {}).length} matériau(x) réglé(s).`, 'msg');
  } catch (err) { alert(err.message); }
});
