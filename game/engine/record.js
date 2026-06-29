// ARCHIVE RECORD SERVICES
// Implements the contract in DevNotes/03_Technical_Reference/ARCHIVE_RECORD_SPEC.md
// (Schema Version 1, FROZEN). These are generic services with many consumers —
// never single-purpose loaders (RULES.md #2).
//
//   ArchiveRecordBuilder   HTML -> Archive Record   (the ONLY HTML-aware component)
//   RecordResolver         type:slug  -> record
//   ArchiveRecordRenderer  Record.body -> semantic DOM (consumer styles it)
//
// Today the Builder reads the live article HTML. Tomorrow it reads Markdown or a
// CMS. Nothing downstream changes, because consumers depend on the Record, not
// the source (RULES.md #3).

const ARCHIVE_SCHEMA_VERSION = 1;

class ArchiveRecordBuilder {
  // Build an Archive Record (type "article") from a 4-digit article id by reading
  // its published HTML. Returns null on failure (never throws).
  static async build(articleId) {
    try {
      const res = await fetch(`../${articleId}/index.html`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return ArchiveRecordBuilder._fromDoc(articleId, doc);
    } catch (e) {
      console.info(`[record] could not build article:${articleId} — ${e.message}`);
      return null;
    }
  }

  static _meta(doc, name) {
    return doc.querySelector(`meta[name="${name}"]`)?.content ||
           doc.querySelector(`meta[property="${name}"]`)?.content || null;
  }

  static _refList(doc, name, ns) {
    const raw = ArchiveRecordBuilder._meta(doc, name);
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => `${ns}:${s}`);
  }

  static _fromDoc(articleId, doc) {
    const M = (n) => ArchiveRecordBuilder._meta(doc, n);
    const title = doc.querySelector('title')?.textContent?.trim() || `Record ${articleId}`;
    const date = M('date');

    const media = [];
    const body = ArchiveRecordBuilder._extractBody(doc, articleId, media);

    return {
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      recordVersion: parseInt(M('game-record-version') || '1', 10) || 1,
      id: `article:${articleId}`,
      type: 'article',
      canon: 'historical',
      title,
      summary: M('description') || '',
      author: M('article:author') || 'Frankie Mohammed',
      section: M('article:section') || null,
      tags: (M('game-tags') || '').split(',').map(s => s.trim()).filter(Boolean),
      created: date,
      updated: date,
      era: M('game-era') || (date || '').slice(0, 4) || 'unknown',
      location: M('game-location') || null,
      world: M('game-world') || 'modern',
      references: {
        people:         ArchiveRecordBuilder._refList(doc, 'game-people', 'person'),
        organizations:  ArchiveRecordBuilder._refList(doc, 'game-orgs', 'organization'),
        places:         ArchiveRecordBuilder._refList(doc, 'game-places', 'place'),
        events:         ArchiveRecordBuilder._refList(doc, 'game-events', 'event'),
        concepts:       ArchiveRecordBuilder._refList(doc, 'game-concepts', 'concept'),
        discovers:      ArchiveRecordBuilder._refList(doc, 'game-discovers', 'knowledge'),
        advancesQuests: ArchiveRecordBuilder._refList(doc, 'game-advances-quest', 'quest'),
      },
      body,
      media,
      // Photos are discovered live from the /<id>/images/ folder (the canonical
      // source for the gallery), the same way the website slideshow does it.
      gallery: { articleId },
      source: { from: 'html', path: `/${articleId}/index.html` },
    };
  }

  // Walk the article body into presentation-neutral typed blocks (spec §body).
  static _extractBody(doc, articleId, media) {
    // NOTE: the article's <body> tag itself carries class="article-body", so we
    // must target the inner content div specifically, not the page body.
    const root = doc.querySelector('div.article-body') ||
                 doc.querySelector('article') ||
                 doc.querySelector('.article-wrap');
    if (!root) return [];
    const blocks = [];
    const sel = 'h1,h2,h3,h4,h5,h6,p,blockquote,ul,ol,iframe';
    let vid = 0;

    root.querySelectorAll(sel).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();

      if (/^h[1-6]$/.test(tag)) {
        if (text) blocks.push({ type: 'heading', level: parseInt(tag[1], 10), text });
      } else if (tag === 'p') {
        if (!text) return;
        const links = [...el.querySelectorAll('a')]
          .map(a => ({ text: (a.textContent || '').trim(), href: a.href }))
          .filter(l => l.text && l.href);
        blocks.push({ type: 'paragraph', text, links });
      } else if (tag === 'blockquote') {
        if (text) blocks.push({ type: 'quote', text });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [...el.querySelectorAll(':scope > li')]
          .map(li => (li.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      } else if (tag === 'iframe') {
        const src = el.getAttribute('src') || '';
        const provider = /youtube|youtu\.be/.test(src) ? 'youtube' : 'embed';
        const title = el.getAttribute('title') || 'Embedded video';
        const id = `video:${articleId}-${++vid}`;
        media.push({ id, kind: 'video', provider, src, title });
        blocks.push({ type: 'video', media: id, title });
      }
    });
    return blocks;
  }
}

// ── RecordResolver ──────────────────────────────────────────────────────────
// Resolve a type:slug reference to its record. Many consumers (terminal, quests,
// NPC dialogue, AI, search) resolve references the exact same way through this.
class RecordResolver {
  constructor() { this.records = new Map(); }
  register(record) { if (record && record.id) this.records.set(record.id, record); }
  has(id) { return this.records.has(id); }
  resolve(id) { return this.records.get(id) || null; }
  resolveMany(ids) { return (ids || []).map(id => this.resolve(id)).filter(Boolean); }
}

// ── ArchiveRecordRenderer ───────────────────────────────────────────────────
// Turn a Record's body into semantic DOM with stable class names. The consumer
// (terminal, website, museum) supplies the CSS skin. Generic by design.
class ArchiveRecordRenderer {
  static toFragment(record) {
    const frag = document.createDocumentFragment();
    const refs = [];

    for (const block of (record.body || [])) {
      let el;
      if (block.type === 'heading') {
        el = document.createElement('div');
        el.className = `ar-h ar-h${block.level || 2}`;
        el.textContent = block.text;
      } else if (block.type === 'paragraph') {
        el = document.createElement('p');
        el.className = 'ar-p';
        el.textContent = block.text;
        (block.links || []).forEach(l => { if (l.href) refs.push(l); });
      } else if (block.type === 'quote') {
        el = document.createElement('div');
        el.className = 'ar-quote';
        el.textContent = block.text;
      } else if (block.type === 'list') {
        el = document.createElement(block.ordered ? 'ol' : 'ul');
        el.className = 'ar-list';
        (block.items || []).forEach(it => {
          const li = document.createElement('li'); li.textContent = it; el.appendChild(li);
        });
      } else if (block.type === 'image') {
        el = document.createElement('div');
        el.className = 'ar-media';
        el.textContent = `▸ IMAGE  ${block.alt || ''}`.trim();
      } else if (block.type === 'video') {
        el = document.createElement('div');
        el.className = 'ar-media';
        el.textContent = `▸ VIDEO  ${block.title || ''}`.trim();
      } else {
        el = document.createElement('p');
        el.className = 'ar-p';
        el.textContent = block.text || '';
      }
      frag.appendChild(el);
    }

    // Collected external links become a REFERENCES section (in-fiction: the
    // terminal lists sources rather than navigating away to the live web).
    if (refs.length) {
      const head = document.createElement('div');
      head.className = 'ar-h ar-h3'; head.textContent = 'REFERENCES';
      frag.appendChild(head);
      const seen = new Set();
      refs.forEach(l => {
        if (seen.has(l.href)) return; seen.add(l.href);
        const r = document.createElement('div');
        r.className = 'ar-ref';
        r.textContent = `• ${l.text} — ${l.href.replace(/^https?:\/\//, '')}`;
        frag.appendChild(r);
      });
    }
    return frag;
  }
}
