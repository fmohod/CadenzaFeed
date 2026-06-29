// ARCHIVE TERMINAL  (in-world "OS")
// A full-screen DOM interface — the player's own Linux-ish machine browsing the
// archive. It renders Archive Records (via ArchiveRecordRenderer), never raw HTML
// (RULES.md #3). World mode hides behind it; this is its own focus/top layer.
//
// Same archive the website serves; different renderer. The article is the data,
// the terminal is one skin.

class ArchiveTerminal {
  constructor(engine) {
    this.engine = engine;
    this.open = false;
    this.view = null;            // current screen descriptor
    this.sel = 0;                // selected row in a list view
    this.selectables = [];       // [{ el, action }]
    this._openedAt = 0;
    this._galleryCache = new Map();
    this._recordCache = new Map();
    this.GITHUB = 'https://api.github.com/repos/fmohod/CadenzaFeed/contents';
    this._injectStyles();
    this._build();
    this._onKey = this._onKey.bind(this);
  }

  wire() {
    this.engine.bus.on('OpenTerminal', () => this.show());
  }

  // ── read-state (which records the player has opened) ──
  _readSet() {
    try { return new Set(JSON.parse(localStorage.getItem('cadenza-read') || '[]')); }
    catch (e) { return new Set(); }
  }
  _markRead(articleId) {
    const s = this._readSet(); s.add(articleId);
    try { localStorage.setItem('cadenza-read', JSON.stringify([...s])); } catch (e) {}
    // Hook: this is where an ArticleRead event would fire knowledge unlocks.
    this.engine.bus.emit('ArticleRead', { articleId });
  }

  // ── lifecycle ──
  show() {
    if (this.open) return;
    this.open = true;
    this._openedAt = performance.now();
    if (this.engine.presentation) this.engine.presentation.terminalOpen = true;
    if (this.engine.audio) this.engine.audio.stinger && this.engine.audio.stinger('ui');
    this.root.classList.add('on');
    window.addEventListener('keydown', this._onKey, true);
    this._home();
  }
  hide() {
    this.open = false;
    if (this.engine.presentation) this.engine.presentation.terminalOpen = false;
    this.root.classList.remove('on');
    window.removeEventListener('keydown', this._onKey, true);
  }

  // ── screens ──────────────────────────────────────────────────────────────
  _home() {
    const sim = this.engine.simulation;
    const rec = sim ? sim.getRecoveredCount() : 0;
    const total = sim ? sim.getTotalCount() : 0;
    this._frame('CADENZA ARCHIVE OS', `RECORDS ${rec}/${total}`);
    const items = [
      { label: `RECORDS         (${rec} recovered)`, action: () => this._records() },
      { label: 'SYSTEM', action: () => this._system() },
      { label: 'POWER OFF', action: () => this.hide() },
    ];
    this._list(items);
    this._foot('[↑↓] select   [ENTER] open   [ESC] power off');
  }

  _system() {
    this._frame('SYSTEM', 'CADENZA-CORE');
    const c = this.content;
    const info = [
      'CADENZA ARCHIVE OS  v0.01',
      '',
      'Machine     : CADENZA-CORE (archive reconstruction unit)',
      'Filesystem  : /archive  (mounted, read-only)',
      `Records      : ${this.engine.archive ? this.engine.archive.getTotalRecordCount() : 0} indexed`,
      `Era          : ${this.engine.simulation ? this.engine.simulation.getEra() : '—'}`,
      'Renderer    : ArchiveRecordRenderer (schema v1)',
      '',
      'This terminal reads the same archive the public network serves,',
      'rendered for local hardware.',
    ];
    const pre = document.createElement('div');
    pre.className = 'at-pre';
    pre.textContent = info.join('\n');
    c.appendChild(pre);
    this._foot('[ESC] back');
    this.selectables = [];
  }

  _records() {
    const sim = this.engine.simulation, arc = this.engine.archive;
    this._frame('RECORDS', '/archive/records');
    const read = this._readSet();
    const recovered = (sim ? sim.state.recovered : [])
      .map(rid => arc.getRecord(rid)).filter(Boolean);

    const items = recovered.map(r => {
      const unread = !read.has(r.articleId);
      return {
        label: `${r.articleId}  ${r.title}`,
        tag: unread ? 'NEW' : '',
        action: () => this._reader(r.articleId),
      };
    });

    if (!items.length) {
      this._empty('No records recovered yet. Find Records in the field, then return here.');
    } else {
      this._list(items);
    }

    const locked = (arc ? arc.getTotalRecordCount() : 0) - recovered.length;
    this._foot(`[↑↓] select  [ENTER] read  [ESC] back   ·   ${locked} signal(s) not yet recovered`);
  }

  async _reader(articleId) {
    this._frame(`RECORD ${articleId}`, 'loading…');
    this.content.innerHTML = '<div class="at-loading">ACCESSING RECORD…</div>';
    this.selectables = [];

    let record = this._recordCache.get(articleId);
    if (!record) {
      record = await ArchiveRecordBuilder.build(articleId);
      if (record) this._recordCache.set(articleId, record);
    }
    if (!this.open) return; // closed while loading
    if (!record) { this.content.innerHTML = '<div class="at-loading">RECORD UNREADABLE.</div>'; return; }

    this._markRead(articleId);
    this._frame(record.title, `${record.created || ''}  ·  ${record.author || ''}`);

    const scroll = document.createElement('div');
    scroll.className = 'at-reader';
    scroll.appendChild(ArchiveRecordRenderer.toFragment(record));
    this.content.appendChild(scroll);
    this._readerScroll = scroll;

    // footer actions (clickable + key shortcuts)
    const actions = [{ label: 'VIEW IMAGES', action: () => this._images(articleId) },
                     { label: 'BACK', action: () => this._records() }];
    this._actionRow(actions);
    this._foot('[↑↓] scroll   [I] images   [ESC] back');
  }

  async _images(articleId) {
    this._frame(`IMAGES ${articleId}`, '/archive/images');
    this.content.innerHTML = '<div class="at-loading">READING IMAGE DIRECTORY…</div>';
    this.selectables = [];

    let imgs = this._galleryCache.get(articleId);
    if (!imgs) {
      imgs = await this._fetchGallery(articleId);
      this._galleryCache.set(articleId, imgs);
    }
    if (!this.open) return;

    if (!imgs.length) {
      this._frame(`IMAGES ${articleId}`, '/archive/images');
      this._empty('No image files in this record.');
      this._foot('[ESC] back');
      return;
    }
    this._frame(`IMAGES ${articleId}`, `${imgs.length} file(s)`);
    const items = imgs.map((im, i) => ({
      label: `${String(i + 1).padStart(2, '0')}  ${im.name}`,
      action: () => this._imageView(articleId, imgs, i),
    }));
    this._list(items);
    this._foot('[↑↓] select   [ENTER] view   [ESC] back');
  }

  _imageView(articleId, imgs, idx) {
    idx = (idx + imgs.length) % imgs.length;
    const im = imgs[idx];
    this._frame(im.name, `${idx + 1} / ${imgs.length}`);
    const wrap = document.createElement('div');
    wrap.className = 'at-imgwrap';
    const image = document.createElement('img');
    image.className = 'at-img';
    image.src = im.url;
    image.alt = im.name;
    wrap.appendChild(image);
    this.content.appendChild(wrap);
    const actions = [
      { label: '‹ PREV', action: () => this._imageView(articleId, imgs, idx - 1) },
      { label: 'NEXT ›', action: () => this._imageView(articleId, imgs, idx + 1) },
      { label: 'BACK', action: () => this._images(articleId) },
    ];
    this._actionRow(actions);
    this._foot('[←→] prev / next   [ESC] back');
    this._imgCtx = { articleId, imgs, idx };
  }

  async _fetchGallery(articleId) {
    try {
      const res = await fetch(`${this.GITHUB}/${articleId}/images`);
      if (!res.ok) return [];
      const files = await res.json();
      return files
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
        .map(f => ({ name: f.name, url: f.download_url }));
    } catch (e) { return []; }
  }

  // ── view scaffolding ───────────────────────────────────────────────────────
  _frame(title, status) {
    this.barTitle.textContent = title;
    this.barStatus.textContent = status || '';
    this.content.innerHTML = '';
    this.actionWrap.innerHTML = '';
    this.selectables = [];
    this.sel = 0;
    this._readerScroll = null;
    this._imgCtx = null;
  }

  _list(items) {
    const ul = document.createElement('div');
    ul.className = 'at-list';
    this.selectables = [];
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'at-item';
      row.innerHTML = `<span class="at-item-label"></span>` +
                      (it.tag ? `<span class="at-tag">${it.tag}</span>` : '');
      row.querySelector('.at-item-label').textContent = it.label;
      row.addEventListener('click', () => { this._select(i); it.action(); });
      ul.appendChild(row);
      this.selectables.push({ el: row, action: it.action });
    });
    this.content.appendChild(ul);
    this._select(0);
  }

  _actionRow(actions) {
    this.actionWrap.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'at-btn';
      b.textContent = a.label;
      b.addEventListener('click', a.action);
      this.actionWrap.appendChild(b);
    });
  }

  _empty(msg) {
    const d = document.createElement('div');
    d.className = 'at-empty';
    d.textContent = msg;
    this.content.appendChild(d);
  }

  _select(i) {
    if (!this.selectables.length) return;
    this.sel = (i + this.selectables.length) % this.selectables.length;
    this.selectables.forEach((s, n) => s.el.classList.toggle('sel', n === this.sel));
    const cur = this.selectables[this.sel];
    if (cur) cur.el.scrollIntoView({ block: 'nearest' });
  }

  _foot(text) { this.foot.textContent = text; }

  // ── input ──────────────────────────────────────────────────────────────────
  _onKey(e) {
    if (!this.open) return;
    if (performance.now() - this._openedAt < 180) { e.preventDefault(); return; } // open debounce
    const k = e.key;

    // image viewer: left/right paginate
    if (this._imgCtx && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      const { articleId, imgs, idx } = this._imgCtx;
      this._imageView(articleId, imgs, idx + (k === 'ArrowRight' ? 1 : -1));
      return;
    }
    // reader: scroll
    if (this._readerScroll && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      this._readerScroll.scrollBy({ top: k === 'ArrowDown' ? 80 : -80 });
      return;
    }
    if (this._readerScroll && (k === 'i' || k === 'I')) {
      e.preventDefault();
      const id = this.barTitle.dataset ? null : null; // reader keeps its own action
      const viewBtn = this.actionWrap.querySelector('.at-btn');
      if (viewBtn) viewBtn.click();
      return;
    }

    if (k === 'ArrowDown') { e.preventDefault(); this._select(this.sel + 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); this._select(this.sel - 1); }
    else if (k === 'Enter') {
      e.preventDefault();
      const cur = this.selectables[this.sel];
      if (cur) cur.action();
    } else if (k === 'Escape' || k === 'Backspace') {
      e.preventDefault();
      this._back();
    }
  }

  _back() {
    // simple back: reader/images/system -> records or home; home -> close
    const title = this.barStatus.textContent || '';
    if (this._imgCtx) { this._images(this._imgCtx.articleId); return; }
    if (this.barStatus.textContent.startsWith('/archive/images')) {
      // images list -> reader
      const id = this.barTitle.textContent.replace('IMAGES ', '').trim();
      this._reader(id); return;
    }
    if (this._readerScroll) { this._records(); return; }
    if (this.barStatus.textContent === '/archive/records' || this.barStatus.textContent === 'CADENZA-CORE') {
      this._home(); return;
    }
    this.hide();
  }

  // ── DOM + styles ────────────────────────────────────────────────────────────
  _build() {
    const root = document.createElement('div');
    root.id = 'archive-terminal';
    root.innerHTML = `
      <div class="at-bar">
        <span class="at-bar-title"></span>
        <span class="at-bar-status"></span>
      </div>
      <div class="at-content"></div>
      <div class="at-actions"></div>
      <div class="at-foot"></div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.barTitle = root.querySelector('.at-bar-title');
    this.barStatus = root.querySelector('.at-bar-status');
    this.content = root.querySelector('.at-content');
    this.actionWrap = root.querySelector('.at-actions');
    this.foot = root.querySelector('.at-foot');
  }

  _injectStyles() {
    const css = `
      #archive-terminal {
        position: fixed; inset: 0; z-index: 300; display: none;
        flex-direction: column; background: #050403; color: #c8c2b4;
        font-family: 'IBM Plex Mono', monospace; overflow: hidden;
        padding: max(14px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
                 max(14px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      }
      #archive-terminal.on { display: flex; }
      #archive-terminal::after {     /* CRT scanlines */
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.18) 2px 3px);
      }
      .at-bar { display: flex; justify-content: space-between; align-items: baseline;
        border-bottom: 1px solid #3a2e1e; padding-bottom: 8px; margin-bottom: 10px; }
      .at-bar-title { color: #A07840; font-size: 15px; letter-spacing: 2px; text-transform: uppercase; }
      .at-bar-status { color: #6f6a60; font-size: 11px; }
      .at-content { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .at-actions { display: flex; gap: 10px; flex-wrap: wrap; padding: 8px 0; }
      .at-actions:empty { display: none; }
      .at-foot { border-top: 1px solid #3a2e1e; padding-top: 8px; margin-top: 8px;
        color: #6f6a60; font-size: 11px; letter-spacing: 1px; }

      .at-list { display: flex; flex-direction: column; }
      .at-item { display: flex; justify-content: space-between; align-items: center;
        padding: 10px 12px; cursor: pointer; border-left: 3px solid transparent; color: #c8c2b4; }
      .at-item:hover { background: rgba(160,120,64,0.10); }
      .at-item.sel { background: rgba(160,120,64,0.85); color: #0d0b08; border-left-color: #F6F2EB; }
      .at-item-label { font-size: 14px; }
      .at-tag { font-size: 10px; letter-spacing: 1px; color: #4a8a5a; }
      .at-item.sel .at-tag { color: #0d0b08; }

      .at-btn { background: rgba(40,33,24,0.8); border: 1px solid #A07840; color: #F6F2EB;
        font-family: inherit; font-size: 12px; letter-spacing: 1px; padding: 8px 14px; cursor: pointer; }
      .at-btn:hover { background: #A07840; color: #0d0b08; }

      .at-pre { white-space: pre-wrap; font-size: 13px; line-height: 1.6; color: #c8c2b4; }
      .at-loading, .at-empty { color: #6f6a60; padding: 24px 4px; font-size: 13px; }

      .at-reader { max-width: 760px; }
      .at-reader .ar-h { color: #A07840; text-transform: uppercase; letter-spacing: 1px;
        margin: 18px 0 8px; }
      .at-reader .ar-h1 { font-size: 18px; }
      .at-reader .ar-h2 { font-size: 15px; }
      .at-reader .ar-h3 { font-size: 13px; color: #b89a6a; }
      .at-reader .ar-p { font-size: 14px; line-height: 1.75; margin: 0 0 14px; color: #d6d0c2; }
      .at-reader .ar-quote { border-left: 2px solid #A07840; padding-left: 14px; margin: 0 0 14px;
        color: #b89a6a; font-style: italic; }
      .at-reader .ar-list { margin: 0 0 14px 18px; font-size: 14px; line-height: 1.7; color: #d6d0c2; }
      .at-reader .ar-media { color: #6f8a9a; font-size: 12px; letter-spacing: 1px; margin: 0 0 12px;
        border: 1px dashed #3a4a5a; padding: 8px 10px; }
      .at-reader .ar-ref { color: #6f6a60; font-size: 12px; margin: 2px 0; }

      .at-imgwrap { display: flex; align-items: center; justify-content: center; height: 100%; }
      .at-img { max-width: 100%; max-height: 70vh; border: 1px solid #3a2e1e; image-rendering: auto; }
    `;
    const s = document.createElement('style');
    s.id = 'at-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
}
