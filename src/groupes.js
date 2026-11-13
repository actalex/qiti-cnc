/* ====================== Groupes du SVG dans la liste des formes ====================== */
// Inkscape reste l'éditeur des formes, de leurs noms et de leurs groupes : la page montre ses calques et groupes
// (sh.grp, posé par importSVG) pour organiser la liste, sans rien renommer. Les réglages restent portés par chaque
// forme, sans héritage : un clic sur un groupe sélectionne ses formes et le panneau habituel s'applique à toutes.
function groupTree(shapes) {
  const root = { kids: [] }, byKey = new Map();
  for (const sh of shapes) {
    let node = root;
    for (const g of sh.grp || []) {
      let n = byKey.get(g.k);
      if (!n) { n = { k: g.k, name: g.name, named: g.named, kids: [] }; byKey.set(g.k, n); node.kids.push(n); }
      node = n;
    }
    node.kids.push(sh);
  }
  // niveaux inutiles : un groupe d'un seul élément est remplacé par cet élément (sauf groupe nommé autour d'une forme
  // sans nom : son nom est le seul repère) ; les enveloppes uniques de la racine (calque, groupe « tout ») sont retirées
  const simp = n => {
    if (!n.kids) return n;
    n.kids = n.kids.map(simp);
    const c = n.kids[0];
    return n.kids.length === 1 && !(n.named && !c.kids && !c.named) ? c : n;
  };
  let top = root.kids.map(simp);
  while (top.length === 1 && top[0].kids) top = top[0].kids;
  return top;
}
const members = n => n.kids ? n.kids.flatMap(members) : [n];
const OPLABEL = { outside: 'ext.', inside: 'int.', on: 'ligne', pocket: 'poche', vcarve: 'V', none: '—' };
function shapeLabel(sh) {
  const own = toolById(sh.tool);
  return OPLABEL[sh.op] + (sh.op !== 'none' ? ' · ' + (sh.through ? 'traversant' : sh.depth + ' mm') + (sh.finish && sh.op !== 'on' && sh.op !== 'vcarve' ? ' · finition' : '') + (own ? ' · ' + own.name : '') : '');
}
// lignes de la liste, à plat (indentation par niveau) : sans groupe, une ligne par forme dans l'ordre du dessin
let listRows = [];
function buildShapeList(box) {
  if (!D.open) D.open = new Set(); // groupes dépliés (repliés par défaut)
  const sig = D.uid + '|' + [...D.open].join(',');
  if (box.dataset.sig === sig) return; // mise à jour en place (reconstruire ferait perdre le clic en cours)
  box.innerHTML = ''; box.dataset.sig = sig; listRows = [];
  const add = (n, lvl) => {
    const d = document.createElement('div'); d.innerHTML = '<span></span><small></small>'; d.style.paddingLeft = (7 + lvl * 14) + 'px';
    const ms = members(n);
    if (n.kids) {
      const open = D.open.has(n.k);
      d.classList.add('grp');
      d.firstChild.innerHTML = `<b class="tog">${open ? '▾' : '▸'}</b> `; d.firstChild.append(n.name);
      d.firstChild.firstChild.onclick = e => { e.stopPropagation(); if (open) D.open.delete(n.k); else D.open.add(n.k); refreshShapes(); };
    } else d.firstChild.textContent = n.name;
    d.onclick = e => {
      const mod = e.shiftKey || e.ctrlKey || e.metaKey, all = ms.every(s => sel.has(s.id));
      if (!mod) sel.clear();
      ms.forEach(s => mod && all ? sel.delete(s.id) : sel.add(s.id));
      refreshShapes(); draw();
    };
    box.appendChild(d); listRows.push({ d, n, ms });
    if (n.kids && D.open.has(n.k)) n.kids.forEach(c => add(c, lvl + 1));
  };
  groupTree(D.shapes).forEach(n => add(n, 0));
}
function paintShapeList() {
  const skippedSet = CAM && CAM.skipped;
  for (const { d, n, ms } of listRows) {
    const ns = ms.filter(s => sel.has(s.id)).length, skipped = skippedSet && ms.some(s => skippedSet.has(s.id));
    d.classList.toggle('sel', ns === ms.length); d.classList.toggle('part', ns > 0 && ns < ms.length);
    const sm = d.lastChild, labels = new Set(ms.map(shapeLabel)), same = labels.size === 1;
    sm.style.color = skipped ? '#c0392b' : same && new Set(ms.map(s => s.op)).size === 1 ? OPCOL[ms[0].op] : '';
    sm.textContent = (skipped ? '⚠ ignorée' + (n.kids ? '(s)' : '') + ' · ' : '') + (n.kids ? ms.length + (ms.length > 1 ? ' formes · ' : ' forme · ') : '') + (same ? [...labels][0] : 'réglages mixtes');
  }
}
// Sélection sur le plan, comme Inkscape : un clic prend le groupe le plus haut de la liste, Ctrl + clic la forme seule
// (ses groupes se déplient dans la liste), Maj + clic ajoute ou retire
function pickUnit(sh, single) {
  if (!D._tree || D._tree.uid !== D.uid) D._tree = { uid: D.uid, top: groupTree(D.shapes) };
  const path = [], find = (n, acc) => { if (n === sh) { path.push(...acc); return true; } return !!n.kids && n.kids.some(c => find(c, [...acc, n])); };
  const top = D._tree.top.find(n => find(n, []));
  if (single) { if (!D.open) D.open = new Set(); path.forEach(n => D.open.add(n.k)); return [sh]; }
  return top ? members(top) : [sh];
}
