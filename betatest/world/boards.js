// Boards — the Station's transit hall screens: outside data drawn in-world.
//
// Owner, log 20261006-01: "the space station can be like a transportation hub
// ... walk off screen to a next screen"; and log 20261007-01 (item 26 of the
// backlog): the site ticker and other feeds rendered graphically, not as a
// web page in the game. The hall (content/spaces/station-hub.json) is the
// screen attached to the deck's west edge, the way the garden is attached to
// its east edge; this file is what its boards say.
//
// A board is an interactable of `type: "screen"` with a `feed`. The renderer
// draws it as a panel on the wall with one line scrolling across (marquee());
// INTERACT in front of it reads the whole board (lines()). Nothing here is
// invented: every line is a clock, a sun, a weather reading, a headline or the
// ship's own position, and a feed with nothing to say says so.
//
//   departures  every real place bound in the player's time (the same list the
//               ship can land at), with its local clock, the sun's phase there,
//               the weather now (Open-Meteo, cached by the engine's service,
//               fetched when you enter the hall) and its distance from the ship
//   wire        the studio's wire and press feed (the news desk's pool)
//   ship        where the one ship is, and the clocks: station UTC, Houston,
//               and the time the player stands in
class Boards {
    static get FEEDS() { return ['departures', 'wire', 'ship']; }

    constructor(engine) {
        this.engine = engine;
        this.weather = new Map();     // space id → weather | null (null: asked, nothing came back)
        this.fetching = new Set();
    }

    // Entering a space with screens: ask for each departure's weather once.
    // Failures are tolerated: a place with no reading shows its clock alone.
    onEnter(space) {
        if (!space || !space.interactables.some(i => i.type === 'screen')) return;
        if (this.engine.news && !this.engine.news.pool.length) this.engine.news.load();
        for (const d of this.departures()) {
            if (this.weather.has(d.space) || this.fetching.has(d.space)) continue;
            this.fetching.add(d.space);
            this.engine.weather.get(d.lat, d.lon)
                .then(w => { this.weather.set(d.space, w || null); })
                .catch(() => { this.weather.set(d.space, null); })
                .finally(() => { this.fetching.delete(d.space); });
        }
    }

    // The places on the board: the ship's own landing list for this time.
    departures() {
        const e = this.engine;
        if (!e.ship || !e.content) return [];
        return e.ship.nearby(true).map(n => {
            const data = e.content.spaces.get(n.space);
            const tz = e.spaceTimeZone(data) || 'UTC';
            const d = Daylight.now(n.lat, n.lon, tz, e.timeOverride, data && data.era_date);
            return { ...n, tz, clock: d.clock, phase: d.phase, weather: this.weather.get(n.space) };
        });
    }

    static utc() { return new Date().toISOString().slice(11, 16) + ' UTC'; }

    houston() {
        const n = [...this.engine.content.neighborhoods.values()].find(x => x.region === 'houston' && x.timezone);
        return Daylight.localTime(new Date(), (n && n.timezone) || 'America/Chicago');
    }

    shipLine() {
        const e = this.engine, s = e.ship;
        if (s.active) return `The ship: aloft over ${ShipMode.fmt(s.pos)}`;
        if (s.at === null) return 'The ship: docked at the Station';
        const sp = e.content.spaces.get(s.at);
        return `The ship: parked at ${(sp && sp.name) || s.at}`;
    }

    timeLine() {
        const e = this.engine, era = e.state.era || 'present';
        return era === 'present' ? 'Your time: Now' : `Your time: ${e.ship.timeLabel(era)}`;
    }

    // The whole board, for the dialogue box.
    lines(feed) {
        if (feed === 'departures') {
            const list = this.departures();
            if (!list.length) return ['No place on record stands in this time.', 'The Station keeps the present; the ship can set its clocks.'];
            return [`Departures. ${this.timeLine()}.`].concat(list.map(d => {
                const w = d.weather ? ', ' + WeatherService.describe(d.weather) : '';
                return `${d.label}: ${d.clock}, ${d.phase}${w}. ${d.km < 1 ? 'The ship is there.' : Math.round(d.km) + ' km from the ship.'}`;
            }));
        }
        if (feed === 'wire') {
            const pool = (this.engine.news && this.engine.news.pool) || [];
            if (!pool.length) return ['The wire is quiet and the press feed is empty.'];
            const wire = pool.filter(i => i.kind === 'wire'), arch = pool.filter(i => i.kind === 'archive');
            const out = [];
            for (const i of wire.slice(0, 4)) out.push(`${i.breaking ? 'BREAKING: ' : ''}${i.headline}${i.date ? ' (' + NewsDesk.prettyDate(i.date) + ')' : ''}`);
            for (const i of arch.slice(0, 6)) out.push(`${i.headline}${i.date ? ' (' + NewsDesk.prettyDate(i.date) + ')' : ''}`);
            out.push('Read the rest at cadenzaarthouse.com/news');
            return out;
        }
        if (feed === 'ship') {
            return [this.shipLine(), `Station time ${Boards.utc()}. Houston ${this.houston()}.`, this.timeLine() + '.'];
        }
        return ['A dark screen.'];
    }

    // The wall panel's lines, one crawl each; the renderer shows them in turn
    // and moves on when a line has crossed. Cheap enough to call every frame.
    items(feed) {
        let items;
        if (feed === 'departures') {
            const list = this.departures();
            items = list.length
                ? list.map(d => `${d.label}  ${d.clock}  ${d.phase}${d.weather ? '  ' + WeatherService.describe(d.weather) : ''}`)
                : ['nothing on record in this time'];
        } else if (feed === 'wire') {
            const pool = (this.engine.news && this.engine.news.pool) || [];
            items = pool.length ? pool.slice(0, 10).map(i => (i.breaking ? 'BREAKING  ' : '') + i.headline) : ['the wire is quiet'];
        } else if (feed === 'ship') {
            items = [this.shipLine(), `Station ${Boards.utc()}   Houston ${this.houston()}`, this.timeLine()];
        } else items = ['no signal'];
        return items;
    }

    marquee(feed, index) { const it = this.items(feed); return it[((index | 0) % it.length + it.length) % it.length]; }
}
