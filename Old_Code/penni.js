/* Penni feature module: practice engine, engagement, settings, mains evaluation.
   Loads after the main inline script — shares its globals (S, CC, CI, allA, findA, toast, hap, showScr...). */

/* ---------- state ---------- */
const PS = {
  stats: JSON.parse(localStorage.getItem('u4stats') || '{"a":{},"d":{},"streak":{"last":"","count":0},"badges":[]}'),
  set: Object.assign({ target: 10, remind: false, key: '' }, JSON.parse(localStorage.getItem('u4set') || '{}')),
  qbm: JSON.parse(localStorage.getItem('u4qbm') || '[]'),
  mq: JSON.parse(localStorage.getItem('u4mq') || '{}'),
  pyq: [], pyqReady: false
};
function saveStats() { localStorage.setItem('u4stats', JSON.stringify(PS.stats)) }
function saveSet() { localStorage.setItem('u4set', JSON.stringify(PS.set)) }
function saveQbm() { localStorage.setItem('u4qbm', JSON.stringify(PS.qbm)) }

fetch('pyq-data.json').then(r => r.json()).then(d => { PS.pyq = d; PS.pyqReady = true; if (S.scr === 'practice-screen') renderPractice() }).catch(() => { });

/* ---------- question pools ---------- */
function articleQs() {
  const out = [];
  allA().forEach(a => (a.prelimsQs || []).forEach((q, i) => out.push({
    id: a.id + '-q' + (i + 1), src: 'article', aid: a.id, subject: a.category,
    q: q.q, options: q.options, answer: q.answer, explanation: q.explanation, ref: q.ref, srcLabel: a.headline
  })));
  return out;
}
function pyqPrelims() {
  return PS.pyq.filter(p => p.exam === 'prelims').map(p => ({
    id: 'pyq-' + p.id, src: 'pyq', subject: p.subject, q: p.question, options: p.options,
    answer: p.answer, explanation: p.explanation, srcLabel: 'UPSC Prelims ' + p.year
  }));
}
function allQs() { return articleQs().concat(pyqPrelims()) }
function mainsPool() {
  const out = [];
  allA().forEach(a => { const mq = a.deepDive && a.deepDive.possibleMainsQuestion; if (mq) out.push({ id: 'ma-' + a.id, q: mq.replace(/^["“]|["”]$/g, ''), subject: a.category, srcLabel: a.headline }) });
  PS.pyq.filter(p => p.exam === 'mains').forEach(p => out.push({ id: 'mp-' + p.id, q: p.question, subject: p.subject, srcLabel: 'UPSC Mains ' + p.year + ' · ' + p.paper, keyPoints: p.keyPoints }));
  return out;
}
function seededPick(arr, n, seed) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1);[a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n);
}
function dailySet() { return seededPick(allQs(), Math.min(PS.set.target, allQs().length), 'penni-' + today) }

/* ---------- answer recording, streaks, badges ---------- */
function recordAnswer(qid, correct, subject) {
  PS.stats.a[qid] = [correct ? 1 : 0, Date.now(), subject || ''];
  const d = PS.stats.d[today] || { n: 0, c: 0 };
  d.n++; if (correct) d.c++;
  PS.stats.d[today] = d;
  const st = PS.stats.streak;
  if (st.last !== today) {
    const y = new Date(Date.now() - 864e5).toISOString().split('T')[0];
    st.count = (st.last === y) ? st.count + 1 : 1; st.last = today;
  }
  checkBadges(); saveStats();
  if (d.n === PS.set.target) { toast('🎯 Daily target hit! Streak: ' + st.count + ' 🔥'); confetti() }
}
const BADGES = [
  { id: 'first', icon: '🌱', name: 'First Steps', desc: 'Answer your first question', cond: s => Object.keys(s.a).length >= 1 },
  { id: 'q25', icon: '📘', name: 'Quarter Century', desc: '25 questions attempted', cond: s => Object.keys(s.a).length >= 25 },
  { id: 'q100', icon: '🏆', name: 'Centurion', desc: '100 questions attempted', cond: s => Object.keys(s.a).length >= 100 },
  { id: 'streak3', icon: '🔥', name: 'On a Roll', desc: '3-day practice streak', cond: s => s.streak.count >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Week Warrior', desc: '7-day practice streak', cond: s => s.streak.count >= 7 },
  { id: 'streak30', icon: '💎', name: 'Iron Will', desc: '30-day practice streak', cond: s => s.streak.count >= 30 },
  { id: 'sharp', icon: '🎯', name: 'Sharpshooter', desc: '10 correct in a day', cond: s => Object.values(s.d).some(d => d.c >= 10) },
];
function checkBadges() {
  BADGES.forEach(b => { if (!PS.stats.badges.includes(b.id) && b.cond(PS.stats)) { PS.stats.badges.push(b.id); toast(b.icon + ' Badge earned: ' + b.name) } });
}
function confetti() {
  const c = document.createElement('div'); c.className = 'pn-confetti';
  for (let i = 0; i < 24; i++) { const s = document.createElement('i'); s.style.left = (Math.random() * 100) + '%'; s.style.animationDelay = (Math.random() * .4) + 's'; s.style.background = ['#F6D66B', '#fff', '#96D4AC', '#9DBCE8', '#F0A3A3'][i % 5]; c.appendChild(s) }
  document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
}
function togQbm(qid) { const i = PS.qbm.indexOf(qid); if (i > -1) { PS.qbm.splice(i, 1); toast('Question removed') } else { PS.qbm.push(qid); toast('Question bookmarked') } saveQbm() }

/* ---------- quiz player ---------- */
let QZ = { qs: [], i: 0, score: 0, done: false, title: '' };
function startQuiz(title, qs) {
  if (!qs.length) { toast('No questions here yet'); return }
  QZ = { qs, i: 0, score: 0, done: false, title };
  document.getElementById('quiz').classList.add('active');
  renderQuiz();
}
function closeQuiz() { document.getElementById('quiz').classList.remove('active'); if (S.scr === 'practice-screen') renderPractice() }
function renderQuiz() {
  const b = document.getElementById('quiz-body'), q = QZ.qs[QZ.i];
  document.getElementById('quiz-title').textContent = QZ.title;
  document.getElementById('quiz-cnt').textContent = (QZ.i + 1) + ' / ' + QZ.qs.length;
  if (QZ.done) {
    const pct = Math.round(QZ.score / QZ.qs.length * 100);
    b.innerHTML = `<div class="qz-end"><div class="qz-score">${QZ.score}<span>/${QZ.qs.length}</span></div><p>${pct >= 80 ? 'Outstanding! 🏆' : pct >= 50 ? 'Solid effort — review the misses. 💪' : 'Keep at it — revision wins. 📚'}</p><button class="pn-btn" onclick="startQuiz(QZ.title,QZ.qs)">Retry</button><button class="pn-btn ghost" onclick="closeQuiz()">Done</button></div>`;
    return;
  }
  const bm = PS.qbm.includes(q.id);
  b.innerHTML = `<div class="qz-meta"><span class="pv-tag subject">${q.subject || ''}</span><span class="qz-src">${q.srcLabel || ''}</span><button class="qz-bm ${bm ? 'on' : ''}" onclick="togQbm('${q.id}');renderQuiz()"><i class="${bm ? 'fas' : 'far'} fa-bookmark"></i></button></div>
  <div class="qz-q">${q.q}</div>
  <div class="qz-opts" id="qz-opts">${q.options.map((o, i) => `<div class="pv-opt" onclick="pickQz(${i})"><div class="ol">${String.fromCharCode(65 + i)}</div><div>${o}</div></div>`).join('')}</div>
  <div class="qz-exp" id="qz-exp"><b>Explanation:</b> <span></span></div>
  <button class="pn-btn" id="qz-next" style="display:none" onclick="nextQz()">${QZ.i + 1 === QZ.qs.length ? 'Finish' : 'Next question'}</button>`;
}
function pickQz(i) {
  const q = QZ.qs[QZ.i], opts = document.getElementById('qz-opts');
  if (opts.dataset.picked) return; opts.dataset.picked = '1';
  [...opts.children].forEach((c, ci) => { if (ci === q.answer) c.classList.add('correct'); else if (ci === i) c.classList.add('wrong') });
  const ok = i === q.answer; if (ok) QZ.score++;
  recordAnswer(q.id, ok, q.subject);
  const ex = document.getElementById('qz-exp'); ex.querySelector('span').textContent = q.explanation + (q.ref ? ' (' + q.ref + ')' : ''); ex.classList.add('show');
  document.getElementById('qz-next').style.display = '';
  hap(ok ? 12 : 30);
}
function nextQz() { QZ.i++; if (QZ.i >= QZ.qs.length) QZ.done = true; renderQuiz() }

/* ---------- practice hub ---------- */
function renderPractice() {
  const b = document.getElementById('practice-body'); if (!b) return;
  const d = PS.stats.d[today] || { n: 0, c: 0 }, tgt = PS.set.target, pct = Math.min(100, Math.round(d.n / tgt * 100));
  const pool = allQs(), subs = {};
  pool.forEach(q => { subs[q.subject] = (subs[q.subject] || 0) + 1 });
  const arts = (S.content[S.selDate] || []).filter(a => (a.prelimsQs || []).length);
  const bmQs = bookmarkPracticeSet();
  const quota = 5 - (PS.mq[today] || 0);
  b.innerHTML = `
  <div class="pn-hero"><div class="pn-streak"><span class="pn-fire">🔥</span><div><b>${PS.stats.streak.count} day${PS.stats.streak.count !== 1 ? 's' : ''}</b><span>practice streak</span></div></div>
    <div class="pn-target"><div class="pn-target-top"><span>Today's target</span><b>${d.n} / ${tgt}</b></div><div class="pn-bar"><i style="width:${pct}%"></i></div></div></div>
  <div class="pn-sec">Practice</div>
  <div class="pyq-card" onclick="startQuiz('Daily Practice', dailySet())"><div class="pc-icon" style="color:#B8860B">🎯</div><div class="pc-info"><h3>Daily Practice</h3><p>${tgt} fresh questions picked for ${fds(today)} — build your streak.</p></div><div class="pc-go"><i class="fas fa-play"></i></div></div>
  <div class="pyq-card" onclick="showScr('mains-screen')"><div class="pc-icon" style="color:#6C71C4">✍️</div><div class="pc-info"><h3>Mains Answer Writing</h3><p>Upload up to 5 handwritten answers a day — AI evaluates & annotates.</p></div><div class="pc-go" style="background:${quota > 0 ? 'var(--yellow)' : 'var(--panel2)'}">${quota}</div></div>
  ${bmQs.length ? `<div class="pyq-card" onclick="startQuiz('Bookmarked Practice', bookmarkPracticeSet())"><div class="pc-icon" style="color:#4CAF82">🔖</div><div class="pc-info"><h3>Bookmarked Practice</h3><p>${bmQs.length} questions from your saved articles & bookmarks.</p></div><div class="pc-go"><i class="fas fa-play"></i></div></div>` : ''}
  <div class="pn-sec">Article-wise <span>(${fds(S.selDate)})</span></div>
  ${arts.length ? arts.map(a => `<div class="pn-row" onclick="startQuiz('${(a.category || 'Article').replace(/'/g, '')}', articleQs().filter(q=>q.aid==='${a.id}'))"><div class="pn-dot" style="background:${(CC[a.category] || '#ccc')}"></div><div class="pn-row-t">${a.headline}</div><span class="pn-row-n">${a.prelimsQs.length} Qs</span></div>`).join('') : '<p class="pn-empty">No article questions for this date.</p>'}
  <div class="pn-sec">Subject-wise</div>
  <div class="pn-subs">${Object.keys(subs).sort().map(s => `<button class="pn-sub" data-s="${s}" onclick="quizSubject(this.dataset.s)">${s}<span>${subs[s]}</span></button>`).join('')}</div>
  <div class="pn-sec">More</div>
  <div class="quick-row">
    <div class="quick-tile" onclick="openPYQ()"><div class="qt-ic" style="color:#6C71C4"><i class="fas fa-scroll"></i></div><h4>PYQ Vault</h4><span>Previous year papers</span></div>
    <div class="quick-tile" onclick="openMapsArcade()"><div class="qt-ic" style="color:#4CAF82"><i class="fas fa-earth-asia"></i></div><h4>Maps Arcade</h4><span>Geography games</span></div>
  </div>`;
}
function quizSubject(sub) { startQuiz(sub, seededPick(allQs().filter(q => q.subject === sub), 10, 'sub' + Date.now())) }
function bookmarkPracticeSet() {
  const fromArts = articleQs().filter(q => S.bm.includes(q.aid));
  const direct = allQs().filter(q => PS.qbm.includes(q.id));
  const seen = new Set(); const out = [];
  fromArts.concat(direct).forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); out.push(q) } });
  return out;
}

/* ---------- bookmarks screen with tabs ---------- */
let BMTAB = 'articles';
function renderBm() {
  const b = document.getElementById('bm-body');
  const qs = allQs().filter(q => PS.qbm.includes(q.id));
  const tabs = `<div class="pv-tabs" style="margin-bottom:12px"><button class="pv-tab ${BMTAB === 'articles' ? 'active' : ''}" onclick="BMTAB='articles';renderBm()">Articles (${S.bm.length})</button><button class="pv-tab ${BMTAB === 'questions' ? 'active' : ''}" onclick="BMTAB='questions';renderBm()">Questions (${qs.length})</button></div>`;
  if (BMTAB === 'questions') {
    b.innerHTML = tabs + (qs.length ? `<button class="pn-btn" style="margin-bottom:12px" onclick="startQuiz('Bookmarked Questions', allQs().filter(q=>PS.qbm.includes(q.id)))"><i class="fas fa-play" style="margin-right:8px"></i>Practice these ${qs.length}</button>` + qs.map(q => `<div class="pn-qcard"><div class="pn-qcard-top"><span class="pv-tag subject">${q.subject}</span><button class="qz-bm on" onclick="togQbm('${q.id}');renderBm()"><i class="fas fa-bookmark"></i></button></div><p>${q.q}</p><span class="qz-src">${q.srcLabel || ''}</span></div>`).join('') : `<div class="empty-state"><i class="far fa-bookmark"></i><p>No bookmarked questions yet.<br>Tap the bookmark icon on any question while practising.</p></div>`);
    return;
  }
  const bmP = bookmarkPracticeSet();
  const practiceBtn = bmP.length ? `<button class="pn-btn" style="margin-bottom:12px" onclick="startQuiz('Bookmarked Practice', bookmarkPracticeSet())"><i class="fas fa-play" style="margin-right:8px"></i>Practice ${bmP.length} Qs from saved articles</button>` : '';
  if (!S.bm.length) { b.innerHTML = tabs + `<div class="empty-state"><i class="far fa-bookmark"></i><p>No bookmarks yet.<br>Tap the bookmark icon while reading.</p></div>`; return }
  b.innerHTML = tabs + practiceBtn + S.bm.map(id => findA(id)).filter(Boolean).map(c => {
    const col = CC[c.category]; const nq = (c.prelimsQs || []).length;
    return `<div class="bm-item" onclick="openDD('${c.id}')"><div class="bm-cat" style="background:${col}"></div><h4>${c.headline}</h4><div class="bm-meta"><span>${fdf(c.date)}</span><span>|</span><span>${c.category}</span>${nq ? `<span>|</span><span style="color:var(--acc);font-weight:800">${nq} practice Qs</span>` : ''}</div><p>${c.summary}</p><div class="bm-actions"><button onclick="event.stopPropagation();togBm('${c.id}')"><i class="fas fa-bookmark"></i></button><button onclick="event.stopPropagation();openFCById('${c.id}')"><i class="fas fa-clone"></i></button>${nq ? `<button onclick="event.stopPropagation();startQuiz('Article Practice', articleQs().filter(q=>q.aid==='${c.id}'))"><i class="fas fa-play"></i></button>` : ''}<button class="btn-dive" onclick="event.stopPropagation();openDD('${c.id}')">Read Full</button></div></div>`;
  }).join('');
}

/* ---------- deep dive augmentation: key terms + article questions ---------- */
const __openDD = openDD;
openDD = function (id) {
  __openDD(id);
  const c = findA(id); if (!c) return;
  const b = document.getElementById('dd-body');
  let extra = '';
  if (c.keyTerms && c.keyTerms.length) extra += `<div class="dd-section-title" style="margin-top:16px"><i class="fas fa-tags"></i> Key Terms</div><div class="pn-terms">${c.keyTerms.map(t => `<span>${t}</span>`).join('')}</div>`;
  if (c.prelimsQs && c.prelimsQs.length) {
    extra += `<div class="dd-section-title" style="margin-top:16px"><i class="fas fa-dumbbell"></i> Practice ${c.prelimsQs.length} Prelims Questions</div>`;
    extra += `<button class="pn-btn" onclick="startQuiz('Article Practice', articleQs().filter(q=>q.aid==='${c.id}'))"><i class="fas fa-play" style="margin-right:8px"></i>Start — based only on this article</button>`;
  }
  if (extra) { const w = document.createElement('div'); w.innerHTML = extra; b.appendChild(w) }
};

/* ---------- profile (full replacement) ---------- */
function renderProf() {
  const all = allA(), dates = Object.keys(S.content).sort(), b = document.getElementById('profile-body');
  const att = Object.keys(PS.stats.a).length, cor = Object.values(PS.stats.a).filter(x => x[0]).length;
  const acc = att ? Math.round(cor / att * 100) : 0;
  const name = PS.set.name || 'UPSC Aspirant';
  const badges = BADGES.map(bd => `<div class="pn-badge ${PS.stats.badges.includes(bd.id) ? '' : 'locked'}" title="${bd.desc}"><span>${bd.icon}</span><b>${bd.name}</b></div>`).join('');
  const subs = {};
  Object.values(PS.stats.a).forEach(x => { if (x[2]) { const s = subs[x[2]] || { n: 0, c: 0 }; s.n++; if (x[0]) s.c++; subs[x[2]] = s } });
  const subRows = Object.keys(subs).sort((a, b2) => subs[b2].n - subs[a].n).slice(0, 8).map(s => { const p = Math.round(subs[s].c / subs[s].n * 100); return `<div class="pn-subrow"><span>${s}</span><div class="pn-bar small"><i style="width:${p}%"></i></div><b>${p}%</b></div>` }).join('');
  b.innerHTML = `
  <div class="profile-card"><div class="profile-avatar">${name[0].toUpperCase()}</div><h3>${name}</h3><p>Civil Services Aspirant</p>
    <div class="profile-stats"><div class="profile-stat"><div class="ps-num">${att}</div><div class="ps-label">Attempted</div></div><div class="profile-stat"><div class="ps-num">${acc}%</div><div class="ps-label">Accuracy</div></div><div class="profile-stat"><div class="ps-num">${PS.stats.streak.count}🔥</div><div class="ps-label">Streak</div></div><div class="profile-stat"><div class="ps-num">${S.bm.length}</div><div class="ps-label">Saved</div></div></div></div>
  <div class="setting-group"><div class="setting-group-title">Badges</div><div class="pn-badges">${badges}</div></div>
  ${subRows ? `<div class="setting-group"><div class="setting-group-title">Subject-wise accuracy</div><div class="pn-subwrap">${subRows}</div></div>` : ''}
  <div class="setting-group"><div class="setting-group-title">Mains Evaluations</div><div id="prof-mains"><p class="pn-empty">Loading…</p></div></div>
  <div class="setting-group"><div class="setting-group-title">Content</div>
    <div class="setting-item" onclick="openUpload()"><div class="setting-left"><i class="fas fa-file-import"></i><span>Import JSON</span></div><i class="fas fa-chevron-right" style="color:var(--ink3);font-size:11px"></i></div>
    <div class="setting-item" onclick="fcD=allA().map(c=>c.deepDive.flashcard);S.fi=0;S.ff=false;renderFC();document.getElementById('flashcards').classList.add('active')"><div class="setting-left"><i class="fas fa-clone"></i><span>All Flashcards</span></div><span style="font-size:12px;color:var(--ink3)">${all.length}</span></div>
    <div class="setting-item" onclick="exportBm()"><div class="setting-left"><i class="fas fa-download"></i><span>Export Bookmarks</span></div><span style="font-size:12px;color:var(--ink3)">${S.bm.length}</span></div></div>
  <div class="setting-group"><div class="setting-group-title">App</div>
    <div class="setting-item" onclick="showScr('settings-screen')"><div class="setting-left"><i class="fas fa-gear"></i><span>Settings</span></div><i class="fas fa-chevron-right" style="color:var(--ink3);font-size:11px"></i></div></div>
  <div style="text-align:center;padding:16px;color:var(--on2);font-size:11px;font-weight:700">Built for UPSC aspirants<br><span style="color:var(--yellow)">Penni</span></div>`;
  renderProfMains();
}
async function renderProfMains() {
  const el = document.getElementById('prof-mains'); if (!el) return;
  const recs = await idbAll();
  if (!recs.length) { el.innerHTML = '<p class="pn-empty">No evaluated answers yet — try Mains practice.</p>'; return }
  el.innerHTML = recs.sort((a, b) => b.ts - a.ts).map(r => `<div class="setting-item" onclick="openMainsRecord(${r.ts})"><div class="setting-left"><i class="fas fa-file-pen"></i><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px">${r.qtext}</span></div><span style="font-size:12px;font-weight:900;color:var(--acc)">${r.eval ? r.eval.score + '/' + r.eval.max_score : '…'}</span></div>`).join('');
}

/* ---------- settings screen ---------- */
function renderSettings() {
  const b = document.getElementById('settings-body'); if (!b) return;
  const s = PS.set;
  b.innerHTML = `
  <div class="setting-group"><div class="setting-group-title">Account</div>
    <div class="setting-item"><div class="setting-left"><i class="fas fa-user"></i><span>Display name</span></div><input class="pn-inp" value="${s.name || ''}" placeholder="Aspirant" onchange="PS.set.name=this.value;saveSet();toast('Saved')"></div></div>
  <div class="setting-group"><div class="setting-group-title">Preferences</div>
    <div class="setting-item" onclick="toggleTheme();renderSettings()"><div class="setting-left"><i class="fas ${S.theme === 'dark' ? 'fa-moon' : 'fa-sun'}"></i><span>Dark Mode</span></div><button class="toggle ${S.theme === 'dark' ? 'on' : ''}" onclick="event.stopPropagation();toggleTheme();renderSettings()"></button></div>
    <div class="setting-item"><div class="setting-left"><i class="fas fa-sliders-h"></i><span>GS papers</span></div><div class="pn-gs">${['GS1', 'GS2', 'GS3', 'GS4'].map(g => `<button class="pn-gschip ${S.gs.includes(g) ? 'on' : ''}" onclick="const i=S.gs.indexOf('${g}');i>-1?S.gs.splice(i,1):S.gs.push('${g}');localStorage.setItem('u4gs',JSON.stringify(S.gs));renderSettings()">${g}</button>`).join('')}</div></div></div>
  <div class="setting-group"><div class="setting-group-title">Daily practice</div>
    <div class="setting-item"><div class="setting-left"><i class="fas fa-bullseye"></i><span>Daily question target</span></div><div class="pn-step"><button onclick="PS.set.target=Math.max(5,PS.set.target-5);saveSet();renderSettings()">−</button><b>${s.target}</b><button onclick="PS.set.target=Math.min(50,PS.set.target+5);saveSet();renderSettings()">+</button></div></div>
    <div class="setting-item" onclick="toggleRemind()"><div class="setting-left"><i class="fas fa-bell"></i><span>Revision reminder (7 pm, app open)</span></div><button class="toggle ${s.remind ? 'on' : ''}" onclick="event.stopPropagation();toggleRemind()"></button></div></div>
  <div class="setting-group"><div class="setting-group-title">AI evaluation (Mains)</div>
    <div class="setting-item" style="flex-wrap:wrap;gap:8px"><div class="setting-left"><i class="fas fa-key"></i><span>Claude API key</span></div><input class="pn-inp wide" type="password" value="${s.key || ''}" placeholder="sk-ant-..." onchange="PS.set.key=this.value.trim();saveSet();toast(this.value?'Key saved on this device':'Key removed')"></div>
    <p class="pn-note">Stored only on this device. Used to evaluate your Mains answers with Claude (model: claude-opus-4-8). Get a key at console.anthropic.com. Daily limit: 5 uploads.</p></div>
  <div class="setting-group"><div class="setting-group-title">Data & privacy</div>
    <div class="setting-item" onclick="exportContent()"><div class="setting-left"><i class="fas fa-file-export"></i><span>Backup all content (JSON)</span></div></div>
    <div class="setting-item" onclick="S.bm=[];localStorage.removeItem('u4bm');toast('Bookmarks cleared')"><div class="setting-left"><i class="fas fa-trash" style="color:#E36D6D"></i><span style="color:#E36D6D">Clear bookmarks</span></div></div>
    <div class="setting-item" onclick="if(confirm('Reset feed content to defaults?')){localStorage.removeItem('u4ct');S.content=defC();saveC();renderDT();loadFeed(S.selDate);toast('Content reset')}"><div class="setting-left"><i class="fas fa-rotate" style="color:#E36D6D"></i><span style="color:#E36D6D">Reset content</span></div></div>
    <div class="setting-item" onclick="if(confirm('Erase ALL app data on this device?')){localStorage.clear();indexedDB.deleteDatabase('penni');location.reload()}"><div class="setting-left"><i class="fas fa-arrow-rotate-left" style="color:#E36D6D"></i><span style="color:#E36D6D">Reset app</span></div></div>
    <div class="setting-item" onclick="window.open('privacy.html','_blank')"><div class="setting-left"><i class="fas fa-shield-halved"></i><span>Privacy policy</span></div><i class="fas fa-chevron-right" style="color:var(--ink3);font-size:11px"></i></div></div>`;
}
function toggleRemind() {
  PS.set.remind = !PS.set.remind; saveSet();
  if (PS.set.remind && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  renderSettings();
}
setInterval(() => {
  if (!PS.set.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
  const h = new Date().getHours(), done = (PS.stats.d[today] || { n: 0 }).n;
  const k = 'u4rem' + today;
  if (h >= 19 && !localStorage.getItem(k) && done < PS.set.target) { localStorage.setItem(k, '1'); new Notification('Penni', { body: `You're at ${done}/${PS.set.target} today — a quick round? 🔥` }) }
}, 60000);

/* ---------- IndexedDB (mains records) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('penni', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('mains', { keyPath: 'ts' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbPut(rec) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('mains', 'readwrite'); t.objectStore('mains').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error) }) }
async function idbAll() { try { const d = await idb(); return new Promise(res => { const q = d.transaction('mains').objectStore('mains').getAll(); q.onsuccess = () => res(q.result || []) }) } catch (e) { return [] } }
async function idbGet(ts) { const d = await idb(); return new Promise(res => { const q = d.transaction('mains').objectStore('mains').get(ts); q.onsuccess = () => res(q.result) }) }

/* ---------- mains practice ---------- */
let MQ = null, MUP = [];
function renderMains() {
  const b = document.getElementById('mains-body'); if (!b) return;
  const used = PS.mq[today] || 0, left = 5 - used;
  const pool = mainsPool();
  b.innerHTML = `<div class="pn-quota ${left ? '' : 'out'}"><i class="fas fa-cloud-arrow-up"></i> ${left ? `${left} of 5 evaluations left today` : 'Daily limit reached — resets tomorrow'}</div>
  ${PS.set.key ? '' : `<div class="pn-warn" onclick="showScr('settings-screen')"><i class="fas fa-key"></i> Add your Claude API key in Settings to enable AI evaluation <i class="fas fa-chevron-right"></i></div>`}
  ${pool.map((m, i) => `<div class="pn-qcard" onclick="openMainsDetail(${i})"><div class="pn-qcard-top"><span class="pv-tag subject">${m.subject || 'GS'}</span><span class="qz-src">${m.srcLabel || ''}</span></div><p>${m.q}</p><span class="pn-link">Write & upload <i class="fas fa-arrow-right"></i></span></div>`).join('')}`;
  b.dataset.pool = '1'; window.__mpool = pool;
}
function openMainsDetail(i) {
  MQ = window.__mpool[i]; MUP = [];
  document.getElementById('mains-detail').classList.add('active');
  renderMainsDetail();
}
function closeMainsDetail() { document.getElementById('mains-detail').classList.remove('active') }
function renderMainsDetail(state) {
  const b = document.getElementById('md-body');
  const left = 5 - (PS.mq[today] || 0);
  b.innerHTML = `<div class="pn-qcard" style="cursor:default"><div class="pn-qcard-top"><span class="pv-tag subject">${MQ.subject || 'GS'}</span><span class="qz-src">${MQ.srcLabel || ''}</span></div><p style="font-weight:800">${MQ.q}</p>${MQ.keyPoints ? `<ul class="pv-key" style="margin-top:10px">${MQ.keyPoints.map(k => `<li>${k}</li>`).join('')}</ul>` : ''}</div>
  <div class="pn-sec">Your answer <span>(photos of handwritten pages, up to 4)</span></div>
  <div class="pn-ups">${MUP.map((u, i) => `<div class="pn-up"><img src="${u.url}"><button onclick="MUP.splice(${i},1);renderMainsDetail()">×</button></div>`).join('')}
    ${MUP.length < 4 ? `<label class="pn-add"><i class="fas fa-plus"></i><input type="file" accept="image/*" multiple style="display:none" onchange="addMainsImgs(this)"></label>` : ''}</div>
  ${state === 'busy' ? `<div class="pn-busy"><i class="fas fa-circle-notch fa-spin"></i> Evaluating with Claude — this can take a minute…</div>`
      : `<button class="pn-btn" ${MUP.length && PS.set.key && left > 0 ? '' : 'disabled'} onclick="evaluateMains()"><i class="fas fa-wand-magic-sparkles" style="margin-right:8px"></i>Evaluate my answer (${left} left today)</button>
   ${!PS.set.key ? '<p class="pn-note">Add your API key in Settings first.</p>' : ''}${!MUP.length ? '<p class="pn-note">Add at least one page photo.</p>' : ''}`}
  <div id="md-report"></div>`;
}
function addMainsImgs(inp) {
  [...inp.files].slice(0, 4 - MUP.length).forEach(f => {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        MUP.push({ url: cv.toDataURL('image/jpeg', 0.85), type: 'image/jpeg' });
        renderMainsDetail();
      };
      im.onerror = () => toast('Could not read that image');
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
}
const EVAL_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    score: { type: "integer" }, max_score: { type: "integer" },
    overall: { type: "string" }, structure: { type: "string" }, content_feedback: { type: "string" },
    missing_points: { type: "array", items: { type: "string" } },
    value_addition: { type: "array", items: { type: "string" } },
    intro_body_conclusion: { type: "string" }, facts_examples: { type: "string" }, language_presentation: { type: "string" },
    model_answer: { type: "string" },
    page_comments: { type: "array", items: { type: "object", additionalProperties: false, properties: { page: { type: "integer" }, comments: { type: "array", items: { type: "string" } } }, required: ["page", "comments"] } }
  },
  required: ["score", "max_score", "overall", "structure", "content_feedback", "missing_points", "value_addition", "intro_body_conclusion", "facts_examples", "language_presentation", "model_answer", "page_comments"]
};
async function evaluateMains() {
  if (!PS.set.key || !MUP.length) return;
  renderMainsDetail('busy');
  const content = [{
    type: "text",
    text: `You are a strict but constructive UPSC Mains examiner. Evaluate the handwritten answer in the attached page images against this question (15 marks, GS standard):\n\n"${MQ.q}"\n\n${MQ.keyPoints ? 'Key points a good answer covers: ' + MQ.keyPoints.join('; ') : ''}\n\nRead the handwriting carefully. Score out of 15. Give specific, actionable feedback grounded in what is actually written. page_comments must have one entry per page image (page numbers starting at 1) with 2-4 margin-style remarks tied to that page's content.`
  }, ...MUP.map(u => ({ type: "image", source: { type: "base64", media_type: u.type, data: u.url.split(',')[1] } }))];
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': PS.set.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-opus-4-8', max_tokens: 8000,
        output_config: { format: { type: 'json_schema', schema: EVAL_SCHEMA } },
        messages: [{ role: 'user', content }]
      })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e.error && e.error.message) || ('HTTP ' + res.status)) }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('The evaluation was declined. Try rephrasing or another question.');
    const txt = (data.content.find(b => b.type === 'text') || {}).text || '{}';
    const ev = JSON.parse(txt);
    PS.mq[today] = (PS.mq[today] || 0) + 1; localStorage.setItem('u4mq', JSON.stringify(PS.mq));
    const rec = { ts: Date.now(), qid: MQ.id, qtext: MQ.q, images: MUP.map(u => u.url), eval: ev };
    await idbPut(rec);
    renderMainsDetail(); renderEvalReport(ev, rec);
    toast('Evaluation saved to your profile'); hap(20);
  } catch (err) {
    renderMainsDetail();
    document.getElementById('md-report').innerHTML = `<div class="pn-warn" style="margin-top:12px"><i class="fas fa-triangle-exclamation"></i> ${String(err.message || err).slice(0, 220)}</div>`;
  }
}
function renderEvalReport(ev, rec) {
  const r = document.getElementById('md-report');
  const li = a => (a || []).map(x => `<li>${x}</li>`).join('');
  r.innerHTML = `<div class="pn-sec" style="margin-top:18px">Evaluation</div>
  <div class="pn-report">
    <div class="pn-scorebox"><b>${ev.score}</b><span>/ ${ev.max_score}</span></div>
    <p class="pn-overall">${ev.overall}</p>
    <div class="pn-rsec"><h5>Structure</h5><p>${ev.structure}</p></div>
    <div class="pn-rsec"><h5>Content</h5><p>${ev.content_feedback}</p></div>
    <div class="pn-rsec"><h5>Intro · Body · Conclusion</h5><p>${ev.intro_body_conclusion}</p></div>
    <div class="pn-rsec"><h5>Facts, examples & case studies</h5><p>${ev.facts_examples}</p></div>
    <div class="pn-rsec"><h5>Language & presentation</h5><p>${ev.language_presentation}</p></div>
    <div class="pn-rsec"><h5>Missing points</h5><ul>${li(ev.missing_points)}</ul></div>
    <div class="pn-rsec"><h5>Value addition</h5><ul>${li(ev.value_addition)}</ul></div>
    <div class="pn-rsec"><h5>Model answer</h5><p>${ev.model_answer.replace(/\n/g, '<br>')}</p></div>
    <button class="pn-btn" onclick='downloadAnnotatedPDF(${rec.ts})'><i class="fas fa-file-pdf" style="margin-right:8px"></i>Download annotated PDF</button>
  </div>`;
  r.scrollIntoView({ behavior: 'smooth' });
}
async function openMainsRecord(ts) {
  const rec = await idbGet(ts); if (!rec) return;
  MQ = { q: rec.qtext, subject: '', srcLabel: 'Evaluated ' + new Date(rec.ts).toLocaleDateString('en-IN') };
  MUP = rec.images.map(u => ({ url: u, type: 'image/jpeg' }));
  document.getElementById('mains-detail').classList.add('active');
  renderMainsDetail(); renderEvalReport(rec.eval, rec);
}
async function downloadAnnotatedPDF(ts) {
  const rec = await idbGet(ts); if (!rec || !window.jspdf) { toast('PDF library not loaded'); return }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = 595, H = 842, M = 40; const ev = rec.eval;
  const wrap = (txt, w) => doc.splitTextToSize(String(txt || ''), w);
  // Cover
  doc.setFillColor(122, 127, 201); doc.rect(0, 0, W, H, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.text('Penni — Mains Evaluation', M, 90);
  doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.text(wrap(rec.qtext, W - 2 * M), M, 130);
  doc.setFontSize(64); doc.setFont('helvetica', 'bold'); doc.text(`${ev.score}/${ev.max_score}`, M, 320);
  doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(wrap(ev.overall, W - 2 * M), M, 360);
  doc.setFontSize(9); doc.text('Evaluated ' + new Date(rec.ts).toLocaleString('en-IN') + ' · model: claude-opus-4-8', M, H - 40);
  // Answer pages with margin comments
  rec.images.forEach((img, i) => {
    doc.addPage();
    const imgW = W * 0.62, imgH = H - 2 * M;
    try { doc.addImage(img, img.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, M, imgW, imgH, undefined, 'FAST') } catch (e) { }
    const cx = M + imgW + 14, cw = W - cx - M;
    doc.setFillColor(246, 214, 107); doc.roundedRect(cx, M, cw, 24, 6, 6, 'F');
    doc.setTextColor(60, 50, 10); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(`Page ${i + 1} remarks`, cx + 8, M + 16);
    doc.setTextColor(40); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    let y = M + 40;
    const pc = (ev.page_comments.find(p => p.page === i + 1) || { comments: [] }).comments;
    pc.forEach((cmt, ci) => {
      const lines = wrap('• ' + cmt, cw - 6);
      if (y + lines.length * 11 > H - M) return;
      doc.text(lines, cx + 2, y); y += lines.length * 11 + 8;
    });
  });
  // Feedback pages
  const sections = [['Structure', ev.structure], ['Content', ev.content_feedback], ['Intro / Body / Conclusion', ev.intro_body_conclusion], ['Facts, examples & case studies', ev.facts_examples], ['Language & presentation', ev.language_presentation], ['Missing points', (ev.missing_points || []).map(x => '• ' + x).join('\n')], ['Value addition', (ev.value_addition || []).map(x => '• ' + x).join('\n')], ['Model answer', ev.model_answer]];
  doc.addPage(); let y = M;
  doc.setTextColor(40);
  sections.forEach(([h, t]) => {
    const lines = wrap(t, W - 2 * M);
    if (y + 30 + lines.length * 12 > H - M) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(108, 113, 196); doc.text(h, M, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40); doc.text(lines, M, y); y += lines.length * 12 + 14;
  });
  doc.save('penni-mains-evaluation.pdf');
}

/* ---------- showScr hook ---------- */
const __showScr = showScr;
showScr = function (id) {
  __showScr(id);
  if (id === 'practice-screen') renderPractice();
  if (id === 'settings-screen') renderSettings();
  if (id === 'mains-screen') renderMains();
};
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('quiz').classList.contains('active')) closeQuiz();
  else if (document.getElementById('mains-detail').classList.contains('active')) closeMainsDetail();
});
