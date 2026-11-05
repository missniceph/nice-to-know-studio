/* Nice to Know Studio — plain JavaScript, no build step, data stays in this browser. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const STORAGE_KEY = 'ntkStudio.v1';
  const APP_ID = 'nice-to-know-studio';
  const STATUSES = ['Idea', 'Researching', 'Scripted', 'Filmed', 'Posted'];
  const SOURCES = {
    news: 'News',
    comment: 'Audience comment',
    law: 'Law / policy',
    personal: 'Personal experience'
  };
  const SHOT_TYPES = {
    talking: 'Talking head',
    broll: 'B-roll',
    screen: 'Screen recording',
    text: 'Text overlay'
  };
  const PLATFORMS = [
    { key: 'instagram', name: 'Instagram' },
    { key: 'facebook', name: 'Facebook' },
    { key: 'tiktok', name: 'TikTok' },
    { key: 'youtube', name: 'YouTube Shorts' }
  ];
  const DEFAULT_LIMITS = { instagram: 2200, facebook: 63206, tiktok: 4000, youtube: 5000 };
  const TARGETS = [30, 60, 90];
  const SUGGESTED_TAGS = ['question', 'myth-buster', 'did you know', 'stat', 'story', 'warning'];
  const DEFAULT_SETTINGS = {
    wpm: 150,
    target: 60,
    theme: 'system',
    limits: { ...DEFAULT_LIMITS },
    prompter: { fontSize: 44, speed: 40, mirror: false },
    inboxView: 'board'
  };

  // ---------- Helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowISO = () => new Date().toISOString();
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

  /** Text inside [square brackets] is treated as a stage note: not spoken, not timed. */
  const stripNotes = (t) => str(t).replace(/\[[^\]]*\]/g, ' ');
  const countWords = (t) => (stripNotes(t).match(/\S+/g) || []).length;
  const fmtTime = (sec) => {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const slug = (t) => str(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60) || 'script';
  const parseTags = (t) => Array.from(new Set(str(t).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)));

  // ---------- Data ----------
  function blankScript() {
    return { hook: '', body: '', cta: '', caption: '', hashtags: '', target: null, claims: [], shots: [], updatedAt: nowISO() };
  }

  function normScript(s) {
    if (!isObj(s)) return null;
    const out = blankScript();
    ['hook', 'body', 'cta', 'caption', 'hashtags'].forEach((k) => { out[k] = str(s[k]); });
    out.target = TARGETS.includes(Number(s.target)) ? Number(s.target) : null;
    out.updatedAt = str(s.updatedAt) || nowISO();
    out.claims = (Array.isArray(s.claims) ? s.claims : []).filter(isObj).map((c) => ({
      id: str(c.id) || uid(), claim: str(c.claim), source: str(c.source), link: str(c.link), verified: !!c.verified
    }));
    out.shots = (Array.isArray(s.shots) ? s.shots : []).filter(isObj).map((sh) => ({
      id: str(sh.id) || uid(), desc: str(sh.desc), type: SHOT_TYPES[sh.type] ? sh.type : 'talking', done: !!sh.done
    }));
    return out;
  }

  function normalize(d) {
    d = isObj(d) ? d : {};
    const s = isObj(d.settings) ? d.settings : {};
    const settings = {
      ...DEFAULT_SETTINGS,
      wpm: clamp(Number(s.wpm) || DEFAULT_SETTINGS.wpm, 60, 400),
      target: TARGETS.includes(Number(s.target)) ? Number(s.target) : DEFAULT_SETTINGS.target,
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
      inboxView: s.inboxView === 'list' ? 'list' : 'board',
      limits: { ...DEFAULT_LIMITS },
      prompter: { ...DEFAULT_SETTINGS.prompter }
    };
    if (isObj(s.limits)) {
      PLATFORMS.forEach(({ key }) => {
        const n = Math.round(Number(s.limits[key]));
        if (n > 0) settings.limits[key] = n;
      });
    }
    if (isObj(s.prompter)) {
      settings.prompter.fontSize = clamp(Number(s.prompter.fontSize) || 44, 20, 120);
      settings.prompter.speed = clamp(Number(s.prompter.speed) || 40, 5, 300);
      settings.prompter.mirror = !!s.prompter.mirror;
    }
    const ideas = (Array.isArray(d.ideas) ? d.ideas : []).filter(isObj).map((i) => ({
      id: str(i.id) || uid(),
      title: str(i.title).trim() || 'Untitled idea',
      angle: str(i.angle),
      sourceType: SOURCES[i.sourceType] ? i.sourceType : 'news',
      notes: str(i.notes),
      status: STATUSES.includes(i.status) ? i.status : 'Idea',
      createdAt: str(i.createdAt) || nowISO(),
      updatedAt: str(i.updatedAt) || nowISO(),
      script: normScript(i.script)
    }));
    const hooks = (Array.isArray(d.hooks) ? d.hooks : []).filter(isObj).filter((h) => str(h.text).trim()).map((h) => ({
      id: str(h.id) || uid(),
      text: str(h.text),
      tags: Array.isArray(h.tags) ? parseTags(h.tags.join(',')) : [],
      createdAt: str(h.createdAt) || nowISO()
    }));
    const meta = isObj(d.meta) ? { lastBackup: str(d.meta.lastBackup) } : { lastBackup: '' };
    return { version: 1, ideas, hooks, settings, meta };
  }

  function sampleData() {
    const t = nowISO();
    return {
      ideas: [{
        id: uid(),
        title: 'Free pre-employment documents for first-time jobseekers',
        angle: 'RA 11261 lets fresh grads get government pre-employment documents for free — once.',
        sourceType: 'law',
        notes: 'Laging tinatanong sa comments kung magkano ang NBI at police clearance. Evergreen topic, lalo na tuwing graduation season. Emphasize the barangay certification step — dito madalas naiipit ang mga tao.\n\nSAMPLE ONLY — the claims marked unverified in the Fact-check tab still need checking against the law and the agencies before posting.',
        status: 'Scripted',
        createdAt: t,
        updatedAt: t,
        script: {
          hook: 'Fresh grad ka ba? Baka hindi mo na kailangang magbayad para sa NBI clearance mo.',
          body: "May batas para dito: ang First Time Jobseekers Assistance Act, o Republic Act 11261.\n\n[Text overlay: RA 11261]\n\nIf you're applying for your very first job, government offices can't charge you fees for pre-employment documents — like your NBI clearance, police clearance, barangay clearance, and PSA birth certificate.\n\nStep one: pumunta ka sa barangay mo and ask for a Barangay Certification na first-time jobseeker ka. Dapat at least six months ka nang nakatira doon.\n\nStep two: dalhin mo 'yung certification kapag kukuha ka na ng documents.\n\nPero tandaan: isang beses lang 'to per document, at one year lang ang validity ng certification.",
          cta: "I-save mo 'to para sa job hunt mo, at i-share sa kaibigan mong bagong graduate. Follow for more nice-to-know adulting tips!",
          caption: "Fresh grad? Teka, 'wag ka munang magbayad! 🎓\n\nUnder RA 11261 (First Time Jobseekers Assistance Act), libre ang pre-employment documents mula sa government offices para sa first-time jobseekers — like NBI clearance, police clearance, barangay clearance at PSA birth certificate.\n\nStep 1: Kumuha ng Barangay Certification as a first-time jobseeker.\nStep 2: Ipakita ito kapag kukuha ka na ng documents.\n\nIsang beses lang 'to per document, kaya sulitin mo! I-save at i-share sa mga fresh grad 💛",
          hashtags: '#NiceToKnow #RA11261 #FirstTimeJobseeker #FreshGrad #AdultingPH #PhilippineLaw',
          target: 60,
          claims: [
            { id: uid(), claim: 'RA 11261 is the First Time Jobseekers Assistance Act.', source: 'Republic Act No. 11261', link: 'https://lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html', verified: true },
            { id: uid(), claim: 'First-time jobseekers do not pay government fees for pre-employment documents such as NBI clearance, police clearance, barangay clearance and PSA birth certificate.', source: 'Republic Act No. 11261', link: 'https://lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html', verified: false },
            { id: uid(), claim: 'You must have lived in the barangay for at least six months to get the first-time jobseeker Barangay Certification.', source: 'RA 11261 Implementing Rules (IRR) / DILG', link: '', verified: false },
            { id: uid(), claim: 'The free availment can be used only once per document.', source: 'Republic Act No. 11261', link: '', verified: false },
            { id: uid(), claim: 'The Barangay Certification is valid for one year from the date it is issued.', source: 'RA 11261 Implementing Rules (IRR)', link: '', verified: false }
          ],
          shots: [
            { id: uid(), desc: 'Hook to camera, holding an NBI clearance printout', type: 'talking', done: true },
            { id: uid(), desc: '"RA 11261" title card', type: 'text', done: true },
            { id: uid(), desc: 'List of covered documents (NBI, police, barangay, PSA…)', type: 'text', done: false },
            { id: uid(), desc: 'Walking into the barangay hall (or a generic barangay hall exterior)', type: 'broll', done: false },
            { id: uid(), desc: 'NBI Clearance website showing the application page', type: 'screen', done: false },
            { id: uid(), desc: 'CTA to camera', type: 'talking', done: false }
          ],
          updatedAt: t
        }
      }],
      hooks: [
        { id: uid(), text: 'Fresh grad ka ba? Baka hindi mo na kailangang magbayad para sa NBI clearance mo.', tags: ['question', 'did you know'], createdAt: t },
        { id: uid(), text: "Akala mo may bayad 'to? Libre pala!", tags: ['myth-buster'], createdAt: t },
        { id: uid(), text: "Alam mo bang may batas na nagpoprotekta sa'yo dito?", tags: ['did you know', 'question'], createdAt: t }
      ]
    };
  }

  let loadWarning = '';
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage blocked */ }
    if (!raw) return normalize(sampleData());
    try { return normalize(JSON.parse(raw)); } catch (e) {
      // Never silently overwrite damaged data: park a copy so it can be recovered.
      try { localStorage.setItem(`${STORAGE_KEY}.damaged-${Date.now()}`, raw); } catch (err) { /* ignore */ }
      loadWarning = 'Your saved data could not be read, so a copy was set aside. Import your latest backup in Settings.';
      return normalize({});
    }
  }

  let state = load();
  let saveTimer = null;

  function save(quiet) {
    state.version = 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (!quiet) showSaved();
      return true;
    } catch (e) {
      toast('Could not save — browser storage is full or blocked. Export a backup now!');
      return false;
    }
  }
  function showSaved() {
    const el = $('#save-status');
    if (!el) return;
    el.textContent = 'Saved ✓';
    el.style.opacity = '1';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  const getIdea = (id) => state.ideas.find((i) => i.id === id);
  const touch = (idea) => { idea.updatedAt = nowISO(); if (idea.script) idea.script.updatedAt = idea.updatedAt; };

  function scriptStats(script) {
    const s = script || blankScript();
    const words = countWords(s.hook) + countWords(s.body) + countWords(s.cta);
    const seconds = (words / state.settings.wpm) * 60;
    const target = s.target || state.settings.target;
    const level = seconds > target ? 'over' : seconds >= target * 0.9 ? 'near' : 'ok';
    const realClaims = s.claims.filter((c) => c.claim.trim() || c.source.trim() || c.link.trim());
    const unverified = realClaims.filter((c) => !c.verified).length;
    return { words, seconds, target, level, claims: realClaims.length, unverified, shots: s.shots.length, shotsDone: s.shots.filter((x) => x.done).length };
  }

  // ---------- UI state ----------
  const ui = {
    search: '',
    statusFilter: 'all',
    scriptTab: 'write',
    hookSearch: '',
    hookTag: '',
    scriptSearch: '',
    lastScriptId: ''
  };

  // ---------- Theme ----------
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    const dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#1a201e' : '#0f766e');
  }

  // ---------- Toast / clipboard / download ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function copyText(text, label) {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
    }
    toast(ok ? `${label || 'Text'} copied ✓` : 'Copy failed — select the text and copy manually');
    return ok;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ---------- Modal ----------
  let modalReturnFocus = null;
  const isDesktop = () => window.matchMedia('(min-width: 761px)').matches;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function openModal(title, bodyHTML) {
    const returnTo = $('#modal-root').firstChild ? modalReturnFocus : document.activeElement;
    closeModal(true);
    modalReturnFocus = returnTo;
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
          <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
          ${bodyHTML}
        </div>
      </div>`;
    // On desktop jump straight into the first field; on phones focus the dialog so the keyboard doesn't pop up.
    const first = $('input, textarea, select', root);
    if (first && isDesktop()) first.focus();
    else $('.modal', root).focus();
  }
  function closeModal(keepFocus) {
    const root = $('#modal-root');
    const wasOpen = !!root.firstChild;
    root.innerHTML = '';
    if (wasOpen && !keepFocus && modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    if (!keepFocus) modalReturnFocus = null;
  }
  /** Keep Tab / Shift+Tab inside an open dialog. */
  function trapTab(e, container) {
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }
  /** Mirror the visual "active" state of toggle buttons for screen readers. */
  function syncPressed() {
    $$('.seg button, .chip[data-action="set-filter"], .chip[data-action="hook-filter"]').forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
  }

  // ---------- Router ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [page, id] = h.split('/');
    const known = ['inbox', 'scripts', 'script', 'hooks', 'settings'];
    return { page: known.includes(page) ? page : 'inbox', id: id ? decodeURIComponent(id) : '' };
  }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    const r = route();
    const app = $('#app');
    const navKey = r.page === 'script' ? 'scripts' : r.page;
    $$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === navKey;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    closeModal(true);
    let pageTitle = ({ inbox: 'Inbox', scripts: 'Scripts', script: 'Script', hooks: 'Hook Bank', settings: 'Settings' }[r.page] || 'Inbox');
    switch (r.page) {
      case 'scripts': app.innerHTML = renderScripts(); break;
      case 'script': {
        const idea = getIdea(r.id);
        if (!idea) { app.innerHTML = `<div class="empty"><strong>Script not found</strong>It may have been deleted. <a href="#/scripts">Back to scripts</a></div>`; break; }
        if (!idea.script) { idea.script = blankScript(); save(true); }
        if (ui.lastScriptId !== idea.id) { ui.scriptTab = 'write'; ui.lastScriptId = idea.id; }
        app.innerHTML = renderEditor(idea);
        updateTimer(idea);
        pageTitle = idea.title;
        break;
      }
      case 'hooks': app.innerHTML = renderHooks(); break;
      case 'settings': app.innerHTML = renderSettings(); break;
      default: app.innerHTML = renderInbox(); renderIdeaResults();
    }
    document.title = `${pageTitle} · Nice to Know Studio`;
    syncPressed();
  }

  // ======================================================================
  // INBOX
  // ======================================================================
  function sourceOptions(sel) {
    return Object.entries(SOURCES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }
  function statusOptions(sel) {
    return STATUSES.map((s) => `<option value="${s}" ${s === sel ? 'selected' : ''}>${s}</option>`).join('');
  }

  function renderInbox() {
    const view = state.settings.inboxView;
    return `
      <section>
        <div class="page-head">
          <div><h1>Idea Inbox</h1><p class="muted small" id="idea-count">${ideaCountText()}</p></div>
        </div>
        <details class="card quick-add" ${!state.ideas.length || window.matchMedia('(min-width: 761px)').matches ? 'open' : ''}>
          <summary>Quick-add an idea</summary>
          <form data-form="add-idea" class="stack" autocomplete="off">
            <label class="field"><span>Title *</span><input type="text" name="title" required maxlength="200" placeholder="e.g. Can your landlord keep your deposit?"></label>
            <label class="field"><span>One-line angle</span><input type="text" name="angle" maxlength="300" placeholder="What's the hook or twist?"></label>
            <div class="grid-2">
              <label class="field"><span>Source type</span><select name="sourceType">${sourceOptions('news')}</select></label>
              <label class="field"><span>Status</span><select name="status">${statusOptions('Idea')}</select></label>
            </div>
            <label class="field"><span>Notes</span><textarea name="notes" rows="2" placeholder="Links, comments, reminders…"></textarea></label>
            <div class="row"><button class="btn btn-primary" type="submit">Add idea</button></div>
          </form>
        </details>
        <div class="toolbar">
          <div class="toolbar-top">
            <input type="search" id="idea-search" placeholder="Search ideas…" value="${esc(ui.search)}" aria-label="Search ideas">
            <div class="seg" role="group" aria-label="View">
              <button type="button" data-action="set-view" data-view="board" class="${view === 'board' ? 'active' : ''}">Board</button>
              <button type="button" data-action="set-view" data-view="list" class="${view === 'list' ? 'active' : ''}">List</button>
            </div>
          </div>
          <div class="chips" id="status-chips"></div>
        </div>
        <div id="idea-results"></div>
      </section>`;
  }

  function ideaCountText() {
    const n = state.ideas.length;
    return `${n} idea${n === 1 ? '' : 's'}${n ? ' · tap a card to edit' : ''}`;
  }

  function filteredIdeas(ignoreStatus) {
    const q = ui.search.trim().toLowerCase();
    return state.ideas
      .filter((i) => ignoreStatus || ui.statusFilter === 'all' || i.status === ui.statusFilter)
      .filter((i) => !q || [i.title, i.angle, i.notes, SOURCES[i.sourceType], i.script && i.script.hook, i.script && i.script.body].some((f) => str(f).toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function ideaCard(i) {
    const st = i.script ? scriptStats(i.script) : null;
    const badges = [`<span class="badge">${esc(SOURCES[i.sourceType])}</span>`];
    if (st) {
      badges.push(`<span class="badge ${st.level === 'over' ? 'badge-danger' : 'badge-accent'}">✎ ${fmtTime(st.seconds)}</span>`);
      if (st.unverified) badges.push(`<span class="badge badge-warn" title="Unverified claims">⚠ ${st.unverified} unverified</span>`);
    }
    return `
      <article class="idea-card status-${i.status}" data-action="edit-idea" data-id="${i.id}">
        <div>
          <h3><button type="button" class="card-title-btn" data-action="edit-idea" data-id="${i.id}">${esc(i.title)}</button></h3>
          ${i.angle ? `<p class="angle">${esc(i.angle)}</p>` : ''}
          <div class="meta">${badges.join('')}</div>
        </div>
        <div class="actions">
          <select class="select-sm" data-idea-status="${i.id}" aria-label="Status of ${esc(i.title)}">${statusOptions(i.status)}</select>
          <button type="button" class="btn btn-sm" data-action="open-script" data-id="${i.id}" aria-label="${i.script ? 'Open' : 'Start'} script: ${esc(i.title)}">${i.script ? 'Script' : '+ Script'}</button>
        </div>
      </article>`;
  }

  function renderIdeaResults() {
    const box = $('#idea-results');
    if (!box) return;
    setTimeout(syncPressed);
    const cnt = $('#idea-count');
    if (cnt) cnt.textContent = ideaCountText();
    const all = filteredIdeas(true);
    const chips = $('#status-chips');
    chips.innerHTML = [['all', 'All', all.length], ...STATUSES.map((s) => [s, s, all.filter((i) => i.status === s).length])]
      .map(([k, label, n]) => `<button type="button" class="chip ${ui.statusFilter === k ? 'active' : ''}" data-action="set-filter" data-status="${k}">${k !== 'all' ? `<span class="dot status-${k}"></span>` : ''}${label} <span class="count">${n}</span></button>`).join('');

    const list = filteredIdeas(false);
    if (!state.ideas.length) {
      box.innerHTML = `<div class="empty"><strong>Your inbox is empty</strong>Add your first idea above.</div>`;
      return;
    }
    if (state.settings.inboxView === 'list') {
      box.innerHTML = list.length
        ? `<h2 class="sr-only">Ideas</h2><div class="list">${list.map(ideaCard).join('')}</div>`
        : `<div class="empty"><strong>No matches</strong>Try another search or filter.</div>`;
      return;
    }
    const cols = ui.statusFilter === 'all' ? STATUSES : [ui.statusFilter];
    box.innerHTML = `${cols.length > 1 ? '<p class="board-hint">Swipe sideways to see every stage →</p>' : ''}<div class="board ${cols.length === 1 ? 'single' : ''}">${cols.map((s) => {
      const items = list.filter((i) => i.status === s);
      return `<div class="board-col status-${s}">
        <h2 class="board-col-head"><span class="dot" aria-hidden="true"></span>${s}<span class="count"><span class="sr-only">: </span>${items.length}<span class="sr-only"> ideas</span></span></h2>
        ${items.length ? items.map(ideaCard).join('') : `<div class="col-empty">Nothing here</div>`}
      </div>`;
    }).join('')}</div>`;
  }

  function ideaModal(idea) {
    openModal('Edit idea', `
      <form data-form="edit-idea" data-id="${idea.id}" class="stack" autocomplete="off">
        <label class="field"><span>Title *</span><input type="text" name="title" required maxlength="200" value="${esc(idea.title)}"></label>
        <label class="field"><span>One-line angle</span><input type="text" name="angle" maxlength="300" value="${esc(idea.angle)}"></label>
        <div class="grid-2">
          <label class="field"><span>Source type</span><select name="sourceType">${sourceOptions(idea.sourceType)}</select></label>
          <label class="field"><span>Status</span><select name="status">${statusOptions(idea.status)}</select></label>
        </div>
        <label class="field"><span>Notes</span><textarea name="notes" rows="5">${esc(idea.notes)}</textarea></label>
        <p class="muted small">Added ${fmtDate(idea.createdAt)} · Updated ${fmtDateTime(idea.updatedAt)}</p>
        <div class="modal-foot">
          <button type="button" class="btn btn-danger" data-action="delete-idea" data-id="${idea.id}">Delete</button>
          <span class="spacer"></span>
          <button type="button" class="btn" data-action="open-script" data-id="${idea.id}">${idea.script ? 'Open script' : 'Start script'}</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`);
  }

  // ======================================================================
  // SCRIPTS LIST
  // ======================================================================
  function renderScripts() {
    const q = ui.scriptSearch.trim().toLowerCase();
    const scripts = state.ideas.filter((i) => i.script)
      .filter((i) => !q || [i.title, i.script.hook, i.script.body, i.script.caption].some((f) => str(f).toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const noScript = state.ideas.filter((i) => !i.script);
    const rows = scripts.map((i) => {
      const st = scriptStats(i.script);
      const badges = [`<span class="badge"><span class="dot status-${i.status}"></span>${i.status}</span>`];
      if (st.unverified) badges.push(`<span class="badge badge-warn">⚠ ${st.unverified} unverified claim${st.unverified > 1 ? 's' : ''}</span>`);
      else if (st.claims) badges.push(`<span class="badge badge-ok">✓ ${st.claims} verified</span>`);
      else badges.push(`<span class="badge">No sources yet</span>`);
      if (st.shots) badges.push(`<span class="badge">🎬 ${st.shotsDone}/${st.shots} shots</span>`);
      return `
        <a class="script-row" href="#/script/${encodeURIComponent(i.id)}">
          <div class="grow">
            <div class="title">${esc(i.title)}</div>
            <div class="meta">${badges.join('')}</div>
          </div>
          <div>
            <div class="runtime ${st.level === 'ok' ? '' : st.level}">${fmtTime(st.seconds)}</div>
            <div class="muted small" style="text-align:right">target ${st.target}s</div>
          </div>
        </a>`;
    }).join('');
    return `
      <section>
        <div class="page-head">
          <div><h1>Scripts</h1><p class="muted small">${scripts.length} script${scripts.length === 1 ? '' : 's'}</p></div>
          <button type="button" class="btn btn-primary" data-action="new-script">+ New script</button>
        </div>
        ${state.ideas.some((i) => i.script) ? `<div class="toolbar"><input type="search" id="script-search" placeholder="Search scripts…" value="${esc(ui.scriptSearch)}" aria-label="Search scripts"></div>` : ''}
        <div class="list">${rows || `<div class="empty"><strong>${q ? 'No matches' : 'No scripts yet'}</strong>${q ? 'Try another search.' : 'Start one from an idea in your Inbox, or tap “New script”.'}</div>`}</div>
        ${noScript.length ? `
          <h2 style="margin:28px 0 10px">Ideas without a script</h2>
          <div class="list">${noScript.map((i) => `
            <div class="script-row">
              <div class="grow"><div class="title">${esc(i.title)}</div><div class="meta"><span class="badge"><span class="dot status-${i.status}"></span>${i.status}</span></div></div>
              <button type="button" class="btn btn-sm" data-action="open-script" data-id="${i.id}">Start script</button>
            </div>`).join('')}</div>` : ''}
      </section>`;
  }

  // ======================================================================
  // SCRIPT EDITOR
  // ======================================================================
  const SECTIONS = [
    { key: 'hook', label: 'Hook', spoken: true, ph: 'First 3 seconds — make them stop scrolling.', rows: 3 },
    { key: 'body', label: 'Body', spoken: true, ph: 'Explain it simply. Use [brackets] for on-screen notes — they are not counted in the runtime.', rows: 10, tall: true },
    { key: 'cta', label: 'CTA', spoken: true, ph: 'Save, share, follow, comment…', rows: 2 },
    { key: 'caption', label: 'Caption', spoken: false, ph: 'Post caption…', rows: 6 },
    { key: 'hashtags', label: 'Hashtags', spoken: false, ph: '#NiceToKnow #AdultingPH', rows: 2 }
  ];

  function renderEditor(idea) {
    const s = idea.script;
    const st = scriptStats(s);
    const tab = ui.scriptTab;
    const tabs = [
      ['write', 'Write'],
      ['facts', `Fact-check${st.unverified ? ` <span class="badge badge-warn" id="tab-warn">⚠ ${st.unverified}</span>` : st.claims ? ` <span class="badge badge-ok" id="tab-warn">✓</span>` : ''}`],
      ['shots', `Shots <span class="badge" id="tab-shots">${st.shotsDone}/${st.shots}</span>`],
      ['repurpose', 'Repurpose']
    ];
    return `
      <section data-editor="${idea.id}">
        <h1 class="sr-only">Script: ${esc(idea.title)}</h1>
        <div class="editor-head">
          <a class="back-link" href="#/scripts">← All scripts</a>
          <div class="row">
            <input type="text" class="title-input grow" data-ifield="title" value="${esc(idea.title)}" aria-label="Script title" maxlength="200">
            <select class="select-sm" data-ifield="status" aria-label="Status">${statusOptions(idea.status)}</select>
          </div>
          <div id="warn-banner"></div>
          <div class="editor-actions">
            <button type="button" class="btn btn-primary" data-action="prompter">▶ Teleprompter</button>
            <button type="button" class="btn" data-action="copy-script">Copy script</button>
            <button type="button" class="btn" data-action="export-txt">Export .txt</button>
          </div>
        </div>
        <div class="timer" id="timer">
          <div class="timer-top">
            <div class="timer-time" id="timer-time">0:00</div>
            <div class="timer-sub" id="timer-sub"></div>
            <div class="timer-target">
              <span class="muted small">Target</span>
              <div class="seg" role="group" aria-label="Target length">
                ${TARGETS.map((t) => `<button type="button" data-action="set-target" data-sec="${t}" class="${st.target === t ? 'active' : ''}">${t}s</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="timer-bar" id="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>
          <div class="timer-over-msg" id="timer-over" hidden></div>
        </div>
        <div class="tabs" role="tablist" aria-label="Script sections">
          ${tabs.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="tab-body" class="tab ${tab === k ? 'active' : ''}" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" data-action="tab" data-tab="${k}">${l}</button>`).join('')}
        </div>
        <div id="tab-body" role="tabpanel" aria-labelledby="tab-${tab}">${renderTab(idea)}</div>
      </section>`;
  }

  function renderTab(idea) {
    switch (ui.scriptTab) {
      case 'facts': return renderFacts(idea);
      case 'shots': return renderShots(idea);
      case 'repurpose': return renderRepurpose(idea);
      default: return renderWrite(idea);
    }
  }

  function sectionCounter(key, value) {
    if (key === 'caption') return `${value.length} chars`;
    if (key === 'hashtags') { const n = (value.match(/#[\p{L}\p{N}_]+/gu) || []).length; return `${n} hashtag${n === 1 ? '' : 's'}`; }
    const w = countWords(value);
    return `${w} word${w === 1 ? '' : 's'} · ${fmtTime((w / state.settings.wpm) * 60)}`;
  }

  function renderWrite(idea) {
    const s = idea.script;
    return SECTIONS.map((sec) => `
      <div class="section">
        <div class="section-head">
          <h2><label for="f-${sec.key}">${sec.label}</label></h2>
          ${sec.spoken ? '<span class="spoken">spoken</span>' : ''}
          <span class="counter" data-counter="${sec.key}">${sectionCounter(sec.key, s[sec.key])}</span>
        </div>
        <textarea id="f-${sec.key}" data-sfield="${sec.key}" rows="${sec.rows}" class="${sec.tall ? 'tall' : ''}" placeholder="${esc(sec.ph)}">${esc(s[sec.key])}</textarea>
        ${sec.key === 'hook' ? `
          <div class="section-tools">
            <button type="button" class="btn btn-sm" data-action="hook-pick">⤓ Insert from Hook Bank</button>
            <button type="button" class="btn btn-sm" data-action="hook-save">☆ Save hook to bank</button>
          </div>` : ''}
      </div>`).join('') + `<p class="hint">Autosaves as you type. Runtime counts Hook + Body + CTA at ${state.settings.wpm} words/min (change in Settings). Text in [brackets] is not counted.</p>`;
  }

  function updateTimer(idea) {
    const timer = $('#timer');
    if (!timer || !idea || !idea.script) return;
    const st = scriptStats(idea.script);
    timer.classList.remove('ok', 'near', 'over');
    timer.classList.add(st.level);
    $('#timer-time').textContent = fmtTime(st.seconds);
    $('#timer-sub').innerHTML = `<b>${st.words}</b> spoken words<br><span class="wide-only">@ ${state.settings.wpm} wpm · </span>target <b>${st.target}s</b>`;
    const scale = Math.max(100, st.target * 1.15, st.seconds * 1.08);
    const bar = $('#timer-bar');
    $$('.timer-mark', bar).forEach((m) => m.remove());
    TARGETS.forEach((t) => {
      const m = document.createElement('div');
      m.className = 'timer-mark' + (t === st.target ? ' is-target' : '');
      m.style.left = `${(t / scale) * 100}%`;
      m.innerHTML = `<span>${t}s</span>`;
      bar.appendChild(m);
    });
    $('#timer-fill').style.width = `${Math.min(100, (st.seconds / scale) * 100)}%`;
    const over = $('#timer-over');
    if (st.level === 'over') {
      const extraWords = Math.ceil(st.words - (st.target / 60) * state.settings.wpm);
      over.hidden = false;
      over.textContent = `Over by ${fmtTime(st.seconds - st.target)} — cut about ${extraWords} word${extraWords === 1 ? '' : 's'} to hit ${st.target}s.`;
    } else over.hidden = true;
    $$('[data-action="set-target"]').forEach((b) => b.classList.toggle('active', Number(b.dataset.sec) === st.target));
    updateWarnings(idea, st);
  }

  function updateWarnings(idea, st) {
    st = st || scriptStats(idea.script);
    const banner = $('#warn-banner');
    if (banner) {
      banner.innerHTML = st.unverified
        ? `<button type="button" class="badge badge-warn" style="border:0;cursor:pointer;padding:6px 12px;font-size:.85rem" data-action="tab" data-tab="facts">⚠ ${st.unverified} unverified claim${st.unverified > 1 ? 's' : ''} — check before posting</button>`
        : st.claims ? `<span class="badge badge-ok" style="padding:6px 12px;font-size:.85rem">✓ All ${st.claims} claim${st.claims > 1 ? 's' : ''} verified</span>` : '';
    }
    const factsTab = $('[data-tab="facts"].tab');
    if (factsTab) factsTab.innerHTML = `Fact-check${st.unverified ? ` <span class="badge badge-warn">⚠ ${st.unverified}</span>` : st.claims ? ' <span class="badge badge-ok">✓</span>' : ''}`;
    const shotsTab = $('[data-tab="shots"].tab');
    if (shotsTab) shotsTab.innerHTML = `Shots <span class="badge">${st.shotsDone}/${st.shots}</span>`;
    const sum = $('#facts-summary');
    if (sum) sum.textContent = st.claims ? `${st.claims - st.unverified} of ${st.claims} verified` : 'No claims yet';
  }

  // ----- Fact-check -----
  function renderFacts(idea) {
    const s = idea.script;
    const st = scriptStats(s);
    return `
      <div class="page-head" style="margin-bottom:12px">
        <div><h2>Fact-check</h2><p class="muted small" id="facts-summary">${st.claims ? `${st.claims - st.unverified} of ${st.claims} verified` : 'No claims yet'}</p></div>
        <button type="button" class="btn btn-primary" data-action="add-claim">+ Add claim</button>
      </div>
      <p class="hint" style="margin-bottom:12px">List every fact you say on camera. Tick “Verified” only after checking the primary source (the law itself, the agency’s official site, the Official Gazette).</p>
      ${s.claims.length ? s.claims.map((c, idx) => `
        <div class="claim ${c.verified ? 'verified' : 'unverified'}" data-claim="${c.id}">
          <div class="claim-top">
            <label class="field grow"><span>Claim ${idx + 1}</span><textarea data-cfield="claim" rows="2" placeholder="What are you saying is true?">${esc(c.claim)}</textarea></label>
            <button type="button" class="icon-btn danger" data-action="del-claim" data-id="${c.id}" aria-label="Delete claim">🗑</button>
          </div>
          <div class="grid-2">
            <label class="field"><span>Source name</span><input type="text" data-cfield="source" value="${esc(c.source)}" placeholder="e.g. RA 11261, DepEd Order No. 8, s. 2015"></label>
            <label class="field"><span>Link</span>
              <div class="link-row">
                <input type="url" data-cfield="link" value="${esc(c.link)}" placeholder="https://…" inputmode="url">
                ${/^https?:\/\//i.test(c.link) ? `<a class="btn btn-sm" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer" aria-label="Open link">↗</a>` : ''}
              </div>
            </label>
          </div>
          <label class="check-label"><input type="checkbox" data-cfield="verified" ${c.verified ? 'checked' : ''}> Verified against the source</label>
        </div>`).join('') : `<div class="empty"><strong>No claims yet</strong>Add each fact you mention so you can double-check it before posting.</div>`}`;
  }

  // ----- Shots -----
  function renderShots(idea) {
    const shots = idea.script.shots;
    return `
      <div class="page-head" style="margin-bottom:12px">
        <div><h2>Shot list</h2><p class="muted small">${shots.filter((x) => x.done).length} of ${shots.length} done</p></div>
        <button type="button" class="btn btn-primary" data-action="add-shot">+ Add shot</button>
      </div>
      ${shots.length ? shots.map((sh, idx) => `
        <div class="shot ${sh.done ? 'done' : ''}" data-shot="${sh.id}">
          <div class="shot-num">${idx + 1}</div>
          <div class="shot-body">
            <textarea data-shfield="desc" rows="2" placeholder="What's in this shot?" aria-label="Shot ${idx + 1} description">${esc(sh.desc)}</textarea>
            <div class="shot-opts">
              <select data-shfield="type" aria-label="Shot type">${Object.entries(SHOT_TYPES).map(([k, v]) => `<option value="${k}" ${k === sh.type ? 'selected' : ''}>${v}</option>`).join('')}</select>
              <label class="check-label"><input type="checkbox" data-shfield="done" ${sh.done ? 'checked' : ''}> Done</label>
            </div>
          </div>
          <div class="shot-controls">
            <button type="button" class="icon-btn" data-action="move-shot" data-id="${sh.id}" data-dir="-1" aria-label="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-btn" data-action="move-shot" data-id="${sh.id}" data-dir="1" aria-label="Move down" ${idx === shots.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon-btn danger" data-action="del-shot" data-id="${sh.id}" aria-label="Delete shot">🗑</button>
          </div>
        </div>`).join('') : `<div class="empty"><strong>No shots yet</strong>Plan your talking-head, B-roll, screen recordings and text overlays.</div>`}`;
  }

  // ----- Repurpose -----
  function platformText(s) {
    return [s.caption.trim(), s.hashtags.trim()].filter(Boolean).join('\n\n');
  }
  function renderRepurpose(idea) {
    const text = platformText(idea.script);
    const len = Array.from(text).length;
    return `
      <div class="page-head" style="margin-bottom:12px">
        <div><h2>Repurpose</h2><p class="muted small">Caption + hashtags, checked against each platform’s limit. <a href="#/settings">Edit limits</a></p></div>
      </div>
      ${PLATFORMS.map((p) => {
        const limit = state.settings.limits[p.key];
        const over = len > limit;
        return `
          <div class="card platform">
            <div class="platform-head">
              <h3>${p.name}</h3>
              <span class="count ${over ? 'over' : ''}">${len.toLocaleString()} / ${limit.toLocaleString()}${over ? ` · ${(len - limit).toLocaleString()} over` : ''}</span>
              <button type="button" class="btn btn-sm" data-action="copy-platform" data-platform="${p.key}">Copy</button>
            </div>
            <pre class="platform-preview" tabindex="0" aria-label="${p.name} caption preview">${text ? esc(text) : '<span class="muted">Write a caption in the Write tab first.</span>'}</pre>
            <div class="meter ${over ? 'over' : ''}"><div style="width:${Math.min(100, (len / limit) * 100)}%"></div></div>
          </div>`;
      }).join('')}`;
  }

  // ----- Plain-text export -----
  function scriptToText(idea) {
    const s = idea.script;
    const st = scriptStats(s);
    const L = [];
    L.push(`NICE TO KNOW — ${idea.title}`);
    L.push(`Status: ${idea.status} | Est. runtime: ${fmtTime(st.seconds)} (${st.words} words @ ${state.settings.wpm} wpm) | Target: ${st.target}s`);
    if (idea.angle) L.push(`Angle: ${idea.angle}`);
    L.push(`Exported: ${fmtDateTime(nowISO())}`);
    const sec = (name, body) => { L.push('', `=== ${name} ===`, body.trim() || '(empty)'); };
    sec('HOOK', s.hook);
    sec('BODY', s.body);
    sec('CTA', s.cta);
    sec('CAPTION', s.caption);
    sec('HASHTAGS', s.hashtags);
    if (s.shots.length) {
      L.push('', '=== SHOT LIST ===');
      s.shots.forEach((sh, i) => L.push(`${i + 1}. [${SHOT_TYPES[sh.type]}] ${sh.desc.trim() || '(no description)'}${sh.done ? '  ✓ done' : ''}`));
    }
    if (s.claims.length) {
      L.push('', '=== FACT-CHECK ===');
      s.claims.forEach((c, i) => {
        L.push(`${i + 1}. [${c.verified ? 'VERIFIED' : 'NOT VERIFIED'}] ${c.claim.trim() || '(no claim text)'}`);
        if (c.source.trim()) L.push(`   Source: ${c.source.trim()}`);
        if (c.link.trim()) L.push(`   Link: ${c.link.trim()}`);
      });
      if (st.unverified) L.push('', `⚠ ${st.unverified} claim(s) still unverified.`);
    }
    return L.join('\n') + '\n';
  }

  // ======================================================================
  // HOOK BANK
  // ======================================================================
  function allTags() {
    const set = new Set();
    state.hooks.forEach((h) => h.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }

  function tagSuggestButtons() {
    const tags = Array.from(new Set([...SUGGESTED_TAGS, ...allTags()]));
    return `<div class="chips" style="margin-top:8px">${tags.map((t) => `<button type="button" class="chip" data-action="tag-suggest" data-tag="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>`;
  }

  function renderHooks() {
    const tags = allTags();
    if (ui.hookTag && !tags.includes(ui.hookTag)) ui.hookTag = '';
    return `
      <section>
        <div class="page-head"><div><h1>Hook Bank</h1><p class="muted small">${state.hooks.length} saved hook${state.hooks.length === 1 ? '' : 's'}</p></div></div>
        <div class="card" style="margin-bottom:18px">
          <form data-form="add-hook" class="stack" autocomplete="off">
            <label class="field"><span>New hook</span><textarea name="text" rows="2" required placeholder="e.g. Alam mo bang may batas para dito?"></textarea></label>
            <label class="field"><span>Tags (comma-separated, optional)</span><input type="text" name="tags" placeholder="question, myth-buster" data-tag-input></label>
            ${tagSuggestButtons()}
            <div class="row"><button type="submit" class="btn btn-primary">Save hook</button></div>
          </form>
        </div>
        <div class="toolbar">
          <input type="search" id="hook-search" placeholder="Search hooks…" value="${esc(ui.hookSearch)}" aria-label="Search hooks">
          ${tags.length ? `<div class="chips"><button type="button" class="chip ${!ui.hookTag ? 'active' : ''}" data-action="hook-filter" data-tag="">All</button>${tags.map((t) => `<button type="button" class="chip ${ui.hookTag === t ? 'active' : ''}" data-action="hook-filter" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
        </div>
        <div id="hook-results">${renderHookList()}</div>
      </section>`;
  }

  function filteredHooks() {
    const q = ui.hookSearch.trim().toLowerCase();
    return state.hooks
      .filter((h) => !ui.hookTag || h.tags.includes(ui.hookTag))
      .filter((h) => !q || h.text.toLowerCase().includes(q) || h.tags.some((t) => t.includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function renderHookList() {
    const hooks = filteredHooks();
    if (!state.hooks.length) return `<div class="empty"><strong>No hooks yet</strong>Save hooks here, or from the Hook section of any script.</div>`;
    if (!hooks.length) return `<div class="empty"><strong>No matches</strong>Try another search or tag.</div>`;
    return hooks.map((h) => `
      <div class="card hook-item">
        <div class="grow">
          <div class="hook-text">${esc(h.text)}</div>
          ${h.tags.length ? `<div class="chips">${h.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="hook-actions">
          <button type="button" class="btn btn-sm btn-primary" data-action="use-hook" data-id="${h.id}">Use in script</button>
          <button type="button" class="btn btn-sm" data-action="copy-hook" data-id="${h.id}">Copy</button>
          <button type="button" class="icon-btn" data-action="edit-hook" data-id="${h.id}" aria-label="Edit hook">✎</button>
          <button type="button" class="icon-btn danger" data-action="del-hook" data-id="${h.id}" aria-label="Delete hook">🗑</button>
        </div>
      </div>`).join('');
  }

  function hookFormModal(title, hook, prefillText) {
    openModal(title, `
      <form data-form="save-hook" data-id="${hook ? hook.id : ''}" class="stack" autocomplete="off">
        <label class="field"><span>Hook</span><textarea name="text" rows="3" required>${esc(hook ? hook.text : prefillText || '')}</textarea></label>
        <label class="field"><span>Tags (comma-separated, optional)</span><input type="text" name="tags" value="${esc(hook ? hook.tags.join(', ') : '')}" data-tag-input placeholder="question, did you know"></label>
        ${tagSuggestButtons()}
        <div class="modal-foot">
          <button type="button" class="btn" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`);
  }

  function hookPickerModal(ideaId) {
    const hooks = [...state.hooks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    openModal('Insert a hook', hooks.length ? `
      <input type="search" id="pick-search" placeholder="Search hooks…" aria-label="Search hooks" style="margin-bottom:10px">
      <div class="pick-list" id="pick-list">
        ${hooks.map((h) => `<button type="button" class="pick-item" data-action="insert-hook" data-hook="${h.id}" data-idea="${ideaId}" data-search="${esc((h.text + ' ' + h.tags.join(' ')).toLowerCase())}">${esc(h.text)}${h.tags.length ? `<small>${esc(h.tags.join(' · '))}</small>` : ''}</button>`).join('')}
      </div>` : `<div class="empty"><strong>Your Hook Bank is empty</strong>Write a hook, then tap “Save hook to bank”.</div>`);
  }

  function scriptPickerModal(hookId) {
    const ideas = [...state.ideas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    openModal('Use hook in which script?', ideas.length ? `
      <div class="pick-list">
        ${ideas.map((i) => `<button type="button" class="pick-item" data-action="insert-hook" data-hook="${hookId}" data-idea="${i.id}" data-go="1">${esc(i.title)}<small>${i.status}${i.script ? (i.script.hook.trim() ? ' · has a hook (will be replaced)' : ' · empty hook') : ' · new script'}</small></button>`).join('')}
      </div>` : `<div class="empty"><strong>No ideas yet</strong>Add an idea in the Inbox first.</div>`);
  }

  function insertHook(hookId, ideaId, navigate) {
    const hook = state.hooks.find((h) => h.id === hookId);
    const idea = getIdea(ideaId);
    if (!hook || !idea) return;
    if (!idea.script) idea.script = blankScript();
    const cur = idea.script.hook.trim();
    if (cur && cur !== hook.text.trim() && !confirm('Replace the current hook with this one?')) return;
    idea.script.hook = hook.text;
    touch(idea);
    save();
    closeModal();
    toast('Hook inserted ✓');
    if (navigate) { ui.scriptTab = 'write'; go(`#/script/${encodeURIComponent(idea.id)}`); return; }
    const ta = $('[data-sfield="hook"]');
    if (ta) {
      ta.value = hook.text;
      const c = $('[data-counter="hook"]');
      if (c) c.textContent = sectionCounter('hook', hook.text);
      updateTimer(idea);
    }
  }

  // ======================================================================
  // SETTINGS
  // ======================================================================
  function renderSettings() {
    const s = state.settings;
    const bytes = (() => { try { return (localStorage.getItem(STORAGE_KEY) || '').length; } catch (e) { return 0; } })();
    return `
      <section>
        <div class="page-head"><h1>Settings</h1></div>
        <div class="settings">
          <div class="card">
            <h2>Appearance</h2>
            <p class="desc">Light, dark, or follow your phone/computer setting.</p>
            <div class="seg" role="group" aria-label="Theme">
              ${['system', 'light', 'dark'].map((t) => `<button type="button" data-action="theme" data-theme-val="${t}" class="${s.theme === t ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
            </div>
          </div>

          <div class="card">
            <h2>Speaking speed</h2>
            <p class="desc">Used for the runtime estimate. 150 words per minute is a typical conversational pace. Tip: read one script out loud with a timer to find your real pace.</p>
            <div class="wpm-row">
              <input type="range" min="80" max="260" step="5" value="${s.wpm}" data-setting="wpm-range" aria-label="Words per minute">
              <input type="number" min="60" max="400" value="${s.wpm}" data-setting="wpm" aria-label="Words per minute">
              <span class="muted small">wpm</span>
            </div>
          </div>

          <div class="card">
            <h2>Default target length</h2>
            <p class="desc">New scripts start with this target. You can change it per script.</p>
            <div class="seg" role="group" aria-label="Default target">
              ${TARGETS.map((t) => `<button type="button" data-action="default-target" data-sec="${t}" class="${s.target === t ? 'active' : ''}">${t}s</button>`).join('')}
            </div>
          </div>

          <div class="card">
            <h2>Caption limits</h2>
            <p class="desc">Character limits used in the Repurpose view. Platforms change these, so update them anytime.</p>
            ${PLATFORMS.map((p) => `
              <label class="limit-row"><span>${p.name}</span><input type="number" min="1" step="1" value="${s.limits[p.key]}" data-limit="${p.key}" aria-label="${p.name} character limit"></label>`).join('')}
            <div class="row" style="margin-top:12px"><button type="button" class="btn btn-sm" data-action="reset-limits">Reset to defaults</button></div>
          </div>

          <div class="card">
            <h2>Backup</h2>
            <p class="desc">Your work is saved only in this browser on this device. Export a backup file regularly (and before clearing your browser), keep it in Google Drive or email it to yourself, and use Import on another device to move your work.</p>
            <p class="small" style="margin-bottom:12px">Last backup: <b>${state.meta.lastBackup ? fmtDateTime(state.meta.lastBackup) : 'never'}</b> · ${state.ideas.length} ideas, ${state.ideas.filter((i) => i.script).length} scripts, ${state.hooks.length} hooks · ${(bytes / 1024).toFixed(1)} KB</p>
            <div class="row">
              <button type="button" class="btn btn-primary" data-action="export-backup">⤓ Export backup</button>
              <label class="btn" for="import-file">⤒ Import backup</label>
              <input type="file" id="import-file" accept="application/json,.json" class="sr-only">
            </div>
            <p class="hint" style="margin-top:8px">Importing replaces everything currently in the app with the backup’s contents.</p>
          </div>

          <div class="card">
            <h2>Data</h2>
            <p class="desc">Add the sample idea and script again, or start fresh.</p>
            <div class="row">
              <button type="button" class="btn" data-action="add-sample">Add sample idea</button>
              <button type="button" class="btn btn-danger" data-action="erase-all">Erase everything</button>
            </div>
          </div>
          <p class="muted small">Nice to Know Studio · no account, no tracking — everything stays on your device.</p>
        </div>
      </section>`;
  }

  function exportBackup() {
    state.meta.lastBackup = nowISO();
    save(true);
    const payload = { app: APP_ID, exportedAt: state.meta.lastBackup, ...state };
    const stamp = new Date().toISOString().slice(0, 10);
    download(`nice-to-know-backup-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup downloaded ✓');
    if (route().page === 'settings') render();
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('That file is not a valid backup (not JSON).'); return; }
      if (!isObj(data) || (!Array.isArray(data.ideas) && !Array.isArray(data.hooks))) { toast('That file does not look like a Nice to Know Studio backup.'); return; }
      const next = normalize(data);
      const msg = `Import this backup?\n\nIt has ${next.ideas.length} ideas, ${next.ideas.filter((i) => i.script).length} scripts and ${next.hooks.length} hooks${data.exportedAt ? `, saved ${fmtDateTime(data.exportedAt)}` : ''}.\n\nThis REPLACES what is in the app now.`;
      if (!confirm(msg)) return;
      state = next;
      save();
      applyTheme();
      toast('Backup imported ✓');
      render();
    };
    reader.onerror = () => toast('Could not read that file.');
    reader.readAsText(file);
  }

  // ======================================================================
  // TELEPROMPTER
  // ======================================================================
  const prompter = { playing: false, raf: 0, last: 0, pos: 0, idea: null };

  function prompterHTML(s) {
    const fmt = (t) => esc(t.trim()).replace(/\[([^\]]*)\]/g, '<span class="note">[$1]</span>');
    return [['HOOK', s.hook], ['BODY', s.body], ['CTA', s.cta]]
      .filter(([, t]) => t.trim())
      .map(([n, t]) => `<span class="sec">${n}</span>${fmt(t)}`).join('\n') || '<span class="note">Nothing to read yet — write your Hook, Body and CTA first.</span>';
  }

  let prompterReturnFocus = null;
  function openPrompter(idea) {
    const el = $('#prompter');
    prompterReturnFocus = document.activeElement;
    const p = state.settings.prompter;
    prompter.idea = idea;
    $('#prompter-text').innerHTML = prompterHTML(idea.script);
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    applyPrompterSettings();
    alignPrompterGuide();
    const sc = $('#prompter-scroll');
    sc.scrollTop = 0;
    prompter.pos = 0;
    setPlaying(false);
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    $('[data-p="mirror"]').setAttribute('aria-pressed', String(p.mirror));
    $('.pbtn-play').focus();
  }
  /** Put the first line on the reading guide (30% down the text area). */
  function alignPrompterGuide() {
    const sc = $('#prompter-scroll');
    if (!sc || $('#prompter').hidden) return;
    const y = Math.round(sc.clientHeight * 0.3);
    $('#prompter-text').style.paddingTop = `${y}px`;
    $('.prompter-guide').style.top = `${sc.getBoundingClientRect().top + y - 10}px`;
  }
  window.addEventListener('resize', alignPrompterGuide);

  function closePrompter() {
    setPlaying(false);
    $('#prompter').hidden = true;
    document.body.style.overflow = '';
    const returnTo = prompterReturnFocus;
    prompterReturnFocus = null;
    // Focus can only move back to the page once full screen has actually ended.
    const restore = () => { if (returnTo && document.contains(returnTo)) returnTo.focus(); };
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().then(restore, restore);
    else restore();
  }
  function applyPrompterSettings() {
    const p = state.settings.prompter;
    const txt = $('#prompter-text');
    txt.style.fontSize = `${p.fontSize}px`;
    txt.classList.toggle('mirror', p.mirror);
    $('#p-speed').textContent = p.speed;
    $('#p-size').textContent = p.fontSize;
    $('[data-p="mirror"]').setAttribute('aria-pressed', String(p.mirror));
  }
  function setPlaying(on) {
    prompter.playing = on;
    const btn = $('.pbtn-play');
    btn.textContent = on ? 'Pause' : 'Start';
    btn.classList.toggle('playing', on);
    cancelAnimationFrame(prompter.raf);
    if (on) {
      const sc = $('#prompter-scroll');
      prompter.pos = sc.scrollTop;
      prompter.last = performance.now();
      prompter.raf = requestAnimationFrame(tick);
    }
  }
  function tick(t) {
    if (!prompter.playing) return;
    const sc = $('#prompter-scroll');
    const dt = Math.min(0.1, (t - prompter.last) / 1000);
    prompter.last = t;
    // If the user scrolled manually, continue from there.
    if (Math.abs(sc.scrollTop - prompter.pos) > 2) prompter.pos = sc.scrollTop;
    prompter.pos += state.settings.prompter.speed * dt;
    sc.scrollTop = prompter.pos;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) { setPlaying(false); return; }
    prompter.raf = requestAnimationFrame(tick);
  }
  function prompterAction(a) {
    const p = state.settings.prompter;
    switch (a) {
      case 'toggle': setPlaying(!prompter.playing); return;
      case 'faster': p.speed = clamp(p.speed + 5, 5, 300); break;
      case 'slower': p.speed = clamp(p.speed - 5, 5, 300); break;
      case 'bigger': p.fontSize = clamp(p.fontSize + 4, 20, 120); break;
      case 'smaller': p.fontSize = clamp(p.fontSize - 4, 20, 120); break;
      case 'mirror': p.mirror = !p.mirror; break;
      case 'restart': $('#prompter-scroll').scrollTop = 0; prompter.pos = 0; return;
      case 'close': closePrompter(); return;
      default: return;
    }
    applyPrompterSettings();
    save(true);
  }

  // ======================================================================
  // EVENTS
  // ======================================================================
  function currentEditorIdea() {
    const sec = $('[data-editor]');
    return sec ? getIdea(sec.dataset.editor) : null;
  }

  const actions = {
    'close-modal': () => closeModal(),
    'set-filter': (el) => { ui.statusFilter = el.dataset.status; renderIdeaResults(); },
    'set-view': (el) => {
      state.settings.inboxView = el.dataset.view;
      save(true);
      $$('[data-action="set-view"]').forEach((b) => b.classList.toggle('active', b === el));
      renderIdeaResults();
    },
    'edit-idea': (el, e) => {
      // The whole card is a mouse/touch target; the title button is the keyboard target.
      if (el.tagName === 'ARTICLE' && e.target.closest('select, button, a, input')) return;
      const idea = getIdea(el.dataset.id);
      if (idea) ideaModal(idea);
    },
    'open-script': (el) => {
      const idea = getIdea(el.dataset.id);
      if (!idea) return;
      if (!idea.script) {
        idea.script = blankScript();
        idea.script.target = state.settings.target;
        touch(idea);
        save();
      }
      ui.scriptTab = 'write';
      go(`#/script/${encodeURIComponent(idea.id)}`);
    },
    'delete-idea': (el) => {
      const idea = getIdea(el.dataset.id);
      if (!idea) return;
      if (!confirm(`Delete “${idea.title}”${idea.script ? ' and its script' : ''}? This can’t be undone (unless you have a backup).`)) return;
      state.ideas = state.ideas.filter((i) => i !== idea);
      save();
      closeModal();
      toast('Idea deleted');
      if (route().page === 'script') go('#/scripts'); else render();
    },
    'new-script': () => {
      openModal('New script', `
        <form data-form="new-script" class="stack" autocomplete="off">
          <label class="field"><span>Title *</span><input type="text" name="title" required maxlength="200" placeholder="What's this Reel about?"></label>
          <label class="field"><span>Source type</span><select name="sourceType">${sourceOptions('law')}</select></label>
          <p class="hint">This also adds the idea to your Inbox (status: Researching).</p>
          <div class="modal-foot">
            <button type="button" class="btn" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create script</button>
          </div>
        </form>`);
    },
    tab: (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      ui.scriptTab = el.dataset.tab;
      $$('.tab').forEach((t) => {
        const on = t.dataset.tab === ui.scriptTab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      $('#tab-body').innerHTML = renderTab(idea);
      $('#tab-body').setAttribute('aria-labelledby', `tab-${ui.scriptTab}`);
      updateWarnings(idea);
      if (el.closest('#warn-banner')) $('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'set-target': (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      idea.script.target = Number(el.dataset.sec);
      touch(idea);
      save();
      updateTimer(idea);
    },
    prompter: () => { const idea = currentEditorIdea(); if (idea) openPrompter(idea); },
    'copy-script': () => { const idea = currentEditorIdea(); if (idea) copyText(scriptToText(idea), 'Script'); },
    'export-txt': () => {
      const idea = currentEditorIdea();
      if (!idea) return;
      download(`${slug(idea.title)}.txt`, scriptToText(idea));
      toast('Script exported ✓');
    },
    'hook-pick': () => { const idea = currentEditorIdea(); if (idea) hookPickerModal(idea.id); },
    'hook-save': () => {
      const idea = currentEditorIdea();
      if (!idea) return;
      const text = idea.script.hook.trim();
      if (!text) { toast('Write a hook first'); return; }
      const existing = state.hooks.find((h) => h.text.trim() === text);
      if (existing) { toast('That hook is already in your bank'); return; }
      hookFormModal('Save hook to bank', null, text);
    },
    'insert-hook': (el) => insertHook(el.dataset.hook, el.dataset.idea, !!el.dataset.go),
    'add-claim': () => {
      const idea = currentEditorIdea();
      if (!idea) return;
      idea.script.claims.push({ id: uid(), claim: '', source: '', link: '', verified: false });
      touch(idea); save();
      $('#tab-body').innerHTML = renderFacts(idea);
      const all = $$('[data-cfield="claim"]');
      if (all.length) all[all.length - 1].focus();
      updateWarnings(idea);
    },
    'del-claim': (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      const c = idea.script.claims.find((x) => x.id === el.dataset.id);
      if (c && (c.claim.trim() || c.source.trim()) && !confirm('Delete this claim?')) return;
      idea.script.claims = idea.script.claims.filter((x) => x.id !== el.dataset.id);
      touch(idea); save();
      $('#tab-body').innerHTML = renderFacts(idea);
      updateWarnings(idea);
    },
    'add-shot': () => {
      const idea = currentEditorIdea();
      if (!idea) return;
      idea.script.shots.push({ id: uid(), desc: '', type: 'talking', done: false });
      touch(idea); save();
      $('#tab-body').innerHTML = renderShots(idea);
      const all = $$('[data-shfield="desc"]');
      if (all.length) all[all.length - 1].focus();
      updateWarnings(idea);
    },
    'del-shot': (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      idea.script.shots = idea.script.shots.filter((x) => x.id !== el.dataset.id);
      touch(idea); save();
      $('#tab-body').innerHTML = renderShots(idea);
      updateWarnings(idea);
    },
    'move-shot': (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      const arr = idea.script.shots;
      const i = arr.findIndex((x) => x.id === el.dataset.id);
      const j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      touch(idea); save();
      $('#tab-body').innerHTML = renderShots(idea);
    },
    'copy-platform': (el) => {
      const idea = currentEditorIdea();
      if (!idea) return;
      const p = PLATFORMS.find((x) => x.key === el.dataset.platform);
      const text = platformText(idea.script);
      if (!text) { toast('Nothing to copy yet'); return; }
      copyText(text, `${p.name} caption`);
    },
    // Hook bank
    'tag-suggest': (el) => {
      const input = $('[data-tag-input]', el.closest('form'));
      if (!input) return;
      const tags = parseTags(input.value);
      if (!tags.includes(el.dataset.tag)) tags.push(el.dataset.tag);
      input.value = tags.join(', ');
    },
    'hook-filter': (el) => {
      ui.hookTag = el.dataset.tag;
      $$('[data-action="hook-filter"]').forEach((b) => b.classList.toggle('active', b === el));
      $('#hook-results').innerHTML = renderHookList();
    },
    'copy-hook': (el) => { const h = state.hooks.find((x) => x.id === el.dataset.id); if (h) copyText(h.text, 'Hook'); },
    'use-hook': (el) => scriptPickerModal(el.dataset.id),
    'edit-hook': (el) => { const h = state.hooks.find((x) => x.id === el.dataset.id); if (h) hookFormModal('Edit hook', h); },
    'del-hook': (el) => {
      if (!confirm('Delete this hook from your bank?')) return;
      state.hooks = state.hooks.filter((x) => x.id !== el.dataset.id);
      save();
      render();
    },
    // Settings
    theme: (el) => {
      state.settings.theme = el.dataset.themeVal;
      save();
      applyTheme();
      $$('[data-action="theme"]').forEach((b) => b.classList.toggle('active', b === el));
    },
    'default-target': (el) => {
      state.settings.target = Number(el.dataset.sec);
      save();
      $$('[data-action="default-target"]').forEach((b) => b.classList.toggle('active', b === el));
    },
    'reset-limits': () => {
      state.settings.limits = { ...DEFAULT_LIMITS };
      save();
      render();
      toast('Limits reset');
    },
    'export-backup': () => exportBackup(),
    'add-sample': () => {
      const s = normalize(sampleData());
      state.ideas.unshift(...s.ideas);
      s.hooks.forEach((h) => { if (!state.hooks.some((x) => x.text.trim() === h.text.trim())) state.hooks.push(h); });
      save();
      toast('Sample idea added to your Inbox');
      render();
    },
    'erase-all': () => {
      const ans = prompt('This deletes ALL ideas, scripts and hooks on this device.\nExport a backup first if you might need them.\n\nType ERASE to confirm:');
      if (ans === null) return;
      if (ans.trim().toUpperCase() !== 'ERASE') { toast('Not erased — you need to type ERASE'); return; }
      state = normalize({ settings: state.settings });
      save();
      toast('Everything erased');
      render();
    }
  };

  document.addEventListener('click', (e) => {
    // Skip link: move focus without touching the URL (the URL drives the page router).
    if (e.target.closest('.skip-link')) { e.preventDefault(); $('#app').focus(); return; }
    const p = e.target.closest('[data-p]');
    if (p) { prompterAction(p.dataset.p); return; }
    if (e.target.id === 'prompter-text' || e.target.closest('#prompter-text')) { setPlaying(!prompter.playing); return; }
    if (e.target.matches('[data-modal-backdrop]')) { closeModal(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) { fn(el, e); syncPressed(); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const get = (k) => str(fd.get(k)).trim();
    switch (form.dataset.form) {
      case 'add-idea': {
        if (!get('title')) return;
        const t = nowISO();
        state.ideas.unshift({ id: uid(), title: get('title'), angle: get('angle'), sourceType: SOURCES[get('sourceType')] ? get('sourceType') : 'news', notes: str(fd.get('notes')), status: STATUSES.includes(get('status')) ? get('status') : 'Idea', createdAt: t, updatedAt: t, script: null });
        save();
        form.reset();
        toast('Idea added ✓');
        renderIdeaResults();
        if (isDesktop()) $('[name="title"]', form).focus();
        break;
      }
      case 'edit-idea': {
        const idea = getIdea(form.dataset.id);
        if (!idea || !get('title')) return;
        idea.title = get('title');
        idea.angle = get('angle');
        idea.sourceType = SOURCES[get('sourceType')] ? get('sourceType') : idea.sourceType;
        idea.status = STATUSES.includes(get('status')) ? get('status') : idea.status;
        idea.notes = str(fd.get('notes'));
        touch(idea);
        save();
        closeModal();
        toast('Idea saved ✓');
        render();
        break;
      }
      case 'new-script': {
        if (!get('title')) return;
        const t = nowISO();
        const idea = { id: uid(), title: get('title'), angle: '', sourceType: SOURCES[get('sourceType')] ? get('sourceType') : 'law', notes: '', status: 'Researching', createdAt: t, updatedAt: t, script: blankScript() };
        idea.script.target = state.settings.target;
        state.ideas.unshift(idea);
        save();
        ui.scriptTab = 'write';
        go(`#/script/${encodeURIComponent(idea.id)}`);
        break;
      }
      case 'add-hook': {
        const text = str(fd.get('text')).trim();
        if (!text) return;
        if (state.hooks.some((h) => h.text.trim() === text)) { toast('That hook is already in your bank'); return; }
        state.hooks.push({ id: uid(), text, tags: parseTags(fd.get('tags')), createdAt: nowISO() });
        save();
        toast('Hook saved ✓');
        render();
        break;
      }
      case 'save-hook': {
        const text = str(fd.get('text')).trim();
        if (!text) return;
        const tags = parseTags(fd.get('tags'));
        const existing = state.hooks.find((h) => h.id === form.dataset.id);
        if (existing) { existing.text = text; existing.tags = tags; }
        else state.hooks.push({ id: uid(), text, tags, createdAt: nowISO() });
        save();
        closeModal();
        toast(existing ? 'Hook updated ✓' : 'Saved to Hook Bank ✓');
        if (route().page === 'hooks') render();
        break;
      }
      default:
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    // Searches
    if (t.id === 'idea-search') { ui.search = t.value; renderIdeaResults(); return; }
    if (t.id === 'hook-search') { ui.hookSearch = t.value; $('#hook-results').innerHTML = renderHookList(); return; }
    if (t.id === 'script-search') {
      ui.scriptSearch = t.value;
      const pos = t.selectionStart;
      render();
      const n = $('#script-search');
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
      return;
    }
    if (t.id === 'pick-search') {
      const q = t.value.trim().toLowerCase();
      $$('#pick-list .pick-item').forEach((b) => { b.hidden = !!q && !b.dataset.search.includes(q); });
      return;
    }

    const idea = currentEditorIdea();
    if (idea) {
      if (t.dataset.sfield) {
        idea.script[t.dataset.sfield] = t.value;
        touch(idea); save();
        const c = $(`[data-counter="${t.dataset.sfield}"]`);
        if (c) c.textContent = sectionCounter(t.dataset.sfield, t.value);
        if (['hook', 'body', 'cta'].includes(t.dataset.sfield)) updateTimer(idea);
        return;
      }
      if (t.dataset.ifield === 'title') {
        idea.title = t.value.trim() || 'Untitled idea';
        touch(idea); save();
        return;
      }
      const claimEl = t.closest('[data-claim]');
      if (claimEl && t.dataset.cfield && t.type !== 'checkbox') {
        const c = idea.script.claims.find((x) => x.id === claimEl.dataset.claim);
        if (c) { c[t.dataset.cfield] = t.value; touch(idea); save(); updateWarnings(idea); }
        return;
      }
      const shotEl = t.closest('[data-shot]');
      if (shotEl && t.dataset.shfield === 'desc') {
        const sh = idea.script.shots.find((x) => x.id === shotEl.dataset.shot);
        if (sh) { sh.desc = t.value; touch(idea); save(); }
        return;
      }
    }

    // Settings
    if (t.dataset.setting === 'wpm' || t.dataset.setting === 'wpm-range') {
      const n = Math.round(Number(t.value));
      if (n >= 60 && n <= 400) {
        state.settings.wpm = n;
        save();
        const other = $(t.dataset.setting === 'wpm' ? '[data-setting="wpm-range"]' : '[data-setting="wpm"]');
        if (other) other.value = n;
      }
      return;
    }
    if (t.dataset.limit) {
      const n = Math.round(Number(t.value));
      if (n > 0) { state.settings.limits[t.dataset.limit] = n; save(); }
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.ideaStatus) {
      const idea = getIdea(t.dataset.ideaStatus);
      if (idea) { idea.status = t.value; touch(idea); save(); renderIdeaResults(); toast(`Moved to ${t.value}`); }
      return;
    }
    if (t.id === 'import-file') { importBackup(t.files && t.files[0]); t.value = ''; return; }
    if (t.dataset.setting === 'wpm') {
      if (Math.round(Number(t.value)) !== state.settings.wpm) toast('Speaking speed must be between 60 and 400 words per minute');
      t.value = state.settings.wpm;
      return;
    }
    if (t.dataset.limit) {
      if (Math.round(Number(t.value)) !== state.settings.limits[t.dataset.limit]) toast('Limits must be a whole number above 0');
      t.value = state.settings.limits[t.dataset.limit];
      return;
    }
    const idea = currentEditorIdea();
    if (!idea) return;
    if (t.dataset.ifield === 'status') { idea.status = t.value; touch(idea); save(); return; }
    if (t.dataset.ifield === 'title') { t.value = idea.title; return; }
    const claimEl = t.closest('[data-claim]');
    if (claimEl && t.dataset.cfield === 'verified') {
      const c = idea.script.claims.find((x) => x.id === claimEl.dataset.claim);
      if (c) {
        c.verified = t.checked;
        touch(idea); save();
        claimEl.classList.toggle('verified', c.verified);
        claimEl.classList.toggle('unverified', !c.verified);
        updateWarnings(idea);
      }
      return;
    }
    if (claimEl && t.dataset.cfield === 'link') { $('#tab-body').innerHTML = renderFacts(idea); return; }
    const shotEl = t.closest('[data-shot]');
    if (shotEl && (t.dataset.shfield === 'type' || t.dataset.shfield === 'done')) {
      const sh = idea.script.shots.find((x) => x.id === shotEl.dataset.shot);
      if (!sh) return;
      if (t.dataset.shfield === 'type') sh.type = t.value;
      else { sh.done = t.checked; shotEl.classList.toggle('done', sh.done); }
      touch(idea); save();
      updateWarnings(idea);
      const sub = $('#tab-body .page-head .muted');
      if (sub) sub.textContent = `${idea.script.shots.filter((x) => x.done).length} of ${idea.script.shots.length} done`;
    }
  });

  document.addEventListener('keydown', (e) => {
    const pr = $('#prompter');
    if (!pr.hidden) {
      const onButton = e.target.closest && e.target.closest('button');
      if (e.key === 'Tab') trapTab(e, pr);
      else if ((e.key === ' ' || e.key === 'Spacebar') && !onButton) { e.preventDefault(); setPlaying(!prompter.playing); }
      else if (e.key === 'Escape') closePrompter();
      else if (e.key === 'ArrowUp') { e.preventDefault(); prompterAction('faster'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); prompterAction('slower'); }
      return;
    }
    const modal = $('#modal-root .modal');
    if (modal) {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'Tab') trapTab(e, modal);
      return;
    }
    // Arrow keys move between the script editor tabs (standard tab-list behaviour).
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = $$('[role="tab"]', tab.parentElement);
      let i = tabs.indexOf(tab);
      if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
      else if (e.key === 'Home') i = 0;
      else i = tabs.length - 1;
      e.preventDefault();
      tabs[i].click();
      tabs[i].focus();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    // If the user exits full screen with the system gesture, keep the prompter open but stop scrolling.
    if (!document.fullscreenElement && !$('#prompter').hidden) setPlaying(false);
    setTimeout(alignPrompterGuide, 50);
  });

  // Keep data in sync if the app is open in two tabs.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    try { state = normalize(JSON.parse(e.newValue)); applyTheme(); render(); } catch (err) { /* ignore */ }
  });

  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }

  window.addEventListener('hashchange', render);

  // ---------- Start ----------
  applyTheme();
  try { if (!localStorage.getItem(STORAGE_KEY)) save(true); } catch (e) { /* ignore */ }
  if (!location.hash) history.replaceState(null, '', '#/inbox');
  render();
  if (loadWarning) toast(loadWarning);
})();
