// NewsDesk — the breaking-news layer: every five minutes of real time, a
// newscaster reads one line from the studio's own wire over whatever is on
// screen, and the game keeps going underneath.
//
// Owner, log 20261007-01: "every five minutes there's a little breaking news
// alert and there's a pop-up overlay on the screen and you have a newscaster
// person announce something from the website ... literally reading one of the
// ticker lines as a teaser and then it goes away ... HUD style, a square
// picture in picture, tight portrait zoom in of the newscaster ... you can
// still see whatever the main picture is ... you really can't pause Universe
// B, so time will just keep going ... it's presumed that whenever this
// breaking news thing happens it happens for everybody; NPCs all just received
// an all-hands message, so that normally allows the plot line to advance."
//
// This is the first mechanism of the Control Room he described in the same
// log (a layer that can take over the feed of any Cadenza Arthouse screen), so
// it is written to be lifted out: it needs a root element, two URLs, a clock
// and two callbacks, and nothing else about the game. The engine owns what
// "free" means and what a broadcast does to the save; this file owns the
// cadence, the sources and the picture.
//
// Sources, both already public on the site and read on the same origin:
//   wire     /news/ticker.json   CAMT's compiled ticker (the archive's live wire;
//                                an item carries `breaking`)
//   archive  /feed.xml           the press RSS: every published story with its
//                                headline and description (the tile teaser)
// The wire goes first when it has anything; the archive is read when it does
// not. Nothing is invented: an empty wire and an empty feed mean no broadcast.
//
// Cadence: the first bulletin FIRST_DELAY seconds into a session, then one
// every PERIOD seconds, measured on the wall clock. A bulletin that falls due
// while the screen is taken (title, terminal, a dialogue) waits for the screen
// and is never dropped; the clock for the next one starts when it is read.
// `?news=now` brings the first one forward for testing; `?news=off` silences
// the desk for that load.
//
// Everything on screen is driven from tick(now), never from timers of its own:
// a background tab throttles setTimeout to once a second, which would turn a
// twelve-second bulletin into a minute of stutter, while elapsed time read from
// the clock is right whenever the next frame comes.
class NewsDesk {
    static get PERIOD() { return 300; }
    static get FIRST_DELAY() { return 45; }
    static get TEASER_MAX() { return 220; }
    static get HEAD_MS() { return 32; }     // per character, the headline, talking pace
    static get TEASER_MS() { return 18; }   // per character, the teaser
    static get PAUSE_MS() { return 250; }   // between the headline and the teaser
    static get OFF_MS() { return 500; }     // the slide out

    constructor({ root, wireUrl, feedUrl, isFree, onBroadcast, portrait, anchorName, period, firstDelay }) {
        this.root = root;
        this.wireUrl = wireUrl;
        this.feedUrl = feedUrl;
        this.isFree = isFree || (() => true);
        this.onBroadcast = onBroadcast || (() => {});
        this.period = (period || NewsDesk.PERIOD) * 1000;
        this.firstDelay = (firstDelay == null ? NewsDesk.FIRST_DELAY : firstDelay) * 1000;
        this.pool = [];          // [{ key, kind: 'wire'|'archive', breaking, date, headline, teaser, link }]
        this.seen = new Set();   // keys already read in this save (restored by the engine)
        this.count = 0;          // bulletins read in this save
        this.showing = null;     // the item on screen, or null
        this.plan = null;        // the timing of the bulletin on screen
        this.next = null;        // clock time at which the next bulletin is due
        this.offAt = null;       // clock time at which a finished bulletin is hidden
        this.enabled = true;
        this.loadedAt = 0;
        this.el = {
            slug: root.querySelector('#news-slug-text'),
            face: root.querySelector('#news-face'),
            name: root.querySelector('#news-anchor-name'),
            head: root.querySelector('#news-head'),
            teaser: root.querySelector('#news-teaser'),
            date: root.querySelector('#news-date'),
        };
        if (portrait) this.el.face.src = portrait;
        this.el.name.textContent = anchorName || '';
        // A tap on the bulletin ends it early, the way BACK does on a keyboard.
        root.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dismiss(); });
    }

    // Carry the save's memory of what was read, so a reload reads the next thing.
    restore(news) {
        this.seen = new Set((news && news.seen) ? [...news.seen] : []);
        this.count = (news && news.count) | 0;
    }

    start(now) {
        this.next = now + this.firstDelay;
        this.load();
    }

    // Both sources, failures tolerated: a missing file is an empty source.
    async load() {
        const wire = await this._wire();
        const archive = await this._archive();
        this.pool = wire.concat(archive);
        this.loadedAt = performance.now();
        if (!this.pool.length) console.info('[news] the wire and the feed are both empty: nothing to broadcast');
        return this.pool;
    }

    async _wire() {
        try {
            const r = await fetch(this.wireUrl, { cache: 'no-cache' });
            if (!r.ok) return [];
            const d = await r.json();
            return (d.items || []).filter(i => i && i.text).map(i => ({
                key: 'wire:' + (i.date || '') + ':' + i.text,
                kind: 'wire', breaking: !!i.breaking, date: i.date || '',
                headline: String(i.text), teaser: '', link: i.link || '',
            }));
        } catch (e) { console.info('[news] wire unavailable:', e.message); return []; }
    }

    async _archive() {
        try {
            const r = await fetch(this.feedUrl, { cache: 'no-cache' });
            if (!r.ok) return [];
            const doc = new DOMParser().parseFromString(await r.text(), 'application/xml');
            if (doc.querySelector('parsererror')) return [];
            const out = [];
            for (const it of doc.querySelectorAll('item')) {
                const t = (q) => { const n = it.querySelector(q); return n ? n.textContent.trim() : ''; };
                const headline = t('title'); if (!headline) continue;
                const link = t('link') || t('guid');
                const when = Date.parse(t('pubDate'));
                out.push({
                    key: 'archive:' + (link || headline),
                    kind: 'archive', breaking: false,
                    date: isNaN(when) ? '' : new Date(when).toISOString().slice(0, 10),
                    headline, teaser: t('description'), link,
                });
            }
            return out;
        } catch (e) { console.info('[news] feed unavailable:', e.message); return []; }
    }

    // The next thing to read: the first item nobody has heard, else round robin.
    pick() {
        if (!this.pool.length) return null;
        return this.pool.find(i => !this.seen.has(i.key)) || this.pool[this.count % this.pool.length];
    }

    // Called every frame by whoever owns the loop. `now` is performance.now().
    tick(now) {
        if (this.offAt != null && now >= this.offAt) {
            this.offAt = null;
            if (!this.showing) { this.root.hidden = true; this.root.classList.remove('is-off'); }
        }
        if (this.showing) { this._render(now); return; }
        if (!this.enabled || this.next == null || now < this.next) return;
        if (now - this.loadedAt > this.period) { this.loadedAt = now; this.load(); }   // a new wire item is read within one period
        if (!this.pool.length || !this.isFree()) return;
        const item = this.pick();
        if (item) this.broadcast(item, now);
    }

    broadcast(item, now) {
        now = now == null ? performance.now() : now;
        this.showing = item;
        this.seen.add(item.key);
        this.count++;
        this.next = now + this.period;
        this.offAt = null;
        const teaser = (item.teaser || '').length > NewsDesk.TEASER_MAX
            ? item.teaser.slice(0, NewsDesk.TEASER_MAX).replace(/\s+\S*$/, '') + '…'
            : (item.teaser || '');
        // The anchor reads: the headline at talking pace, a breath, the teaser,
        // then holds long enough to be read back, then signs off.
        const headMs = item.headline.length * NewsDesk.HEAD_MS + NewsDesk.PAUSE_MS;
        const teaserMs = teaser.length * NewsDesk.TEASER_MS + (teaser ? NewsDesk.PAUSE_MS : 0);
        const holdMs = 4500 + Math.min(4000, teaser.length * 12);
        this.plan = { t0: now, headline: item.headline, teaser, headMs, teaserMs, endAt: now + headMs + teaserMs + holdMs };
        const root = this.root, el = this.el;
        root.classList.toggle('is-breaking', item.breaking);
        root.classList.toggle('is-archive', item.kind === 'archive');
        el.slug.textContent = item.breaking ? 'Breaking news' : (item.kind === 'wire' ? 'From the wire' : 'From the archive');
        el.date.textContent = item.date ? NewsDesk.prettyDate(item.date) : '';
        el.head.textContent = '';
        el.teaser.textContent = '';
        root.classList.remove('is-off', 'is-on');
        root.hidden = false;
        void root.offsetWidth;            // commit the off-screen start so the slide in is a transition, not a jump
        root.classList.add('is-on');
        this.onBroadcast(item);
    }

    // What is on the card at this instant, from elapsed time alone.
    _render(now) {
        const p = this.plan, el = this.el;
        const e = now - p.t0;
        const hChars = Math.min(p.headline.length, Math.floor(e / NewsDesk.HEAD_MS));
        el.head.textContent = p.headline.slice(0, hChars);
        const te = e - p.headMs;
        const tChars = te <= 0 ? 0 : Math.min(p.teaser.length, Math.floor(te / NewsDesk.TEASER_MS));
        el.teaser.textContent = p.teaser.slice(0, tChars);
        if (now >= p.endAt) this.end(now);
    }

    dismiss() { if (this.showing) this.end(performance.now()); }

    end(now) {
        if (!this.showing) return;
        this.showing = null;
        this.plan = null;
        this.root.classList.remove('is-on');
        this.root.classList.add('is-off');
        this.offAt = (now == null ? performance.now() : now) + NewsDesk.OFF_MS;
    }

    static prettyDate(iso) {
        const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
