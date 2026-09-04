// Daylight — the real sun over a real place, with no service at all.
//
// Owner, 2026-09-03: "give the game a real clock to match the real world clock
// so that the scene and ambiance change to match actual daylight, dusk, night."
//
// The sun's altitude for a latitude, longitude and instant is arithmetic (the
// standard low-precision solar position, good to a fraction of a degree), so
// this works offline and needs nobody's permission. Phases follow the usual
// twilight bands: day above 6°, golden hour 0–6°, civil dusk 0 to −6°, nautical
// −6 to −12°, night below −12°. The tint is presentation; the phase is a fact.
class Daylight {
    static sunAltitude(lat, lon, date = new Date()) {
        const rad = Math.PI / 180;
        const jd = date.getTime() / 86400000 + 2440587.5;
        const n = jd - 2451545.0;
        const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
        const g = ((357.528 + 0.9856003 * n) % 360 + 360) % 360;
        const lambda = L + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad);
        const eps = 23.439 - 0.0000004 * n;
        const alpha = Math.atan2(Math.cos(eps * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad));
        const delta = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
        const gmst = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
        const lst = ((gmst * 15 + lon) % 360 + 360) % 360;
        let H = lst - alpha / rad;
        H = ((H + 540) % 360) - 180;
        const alt = Math.asin(Math.sin(lat * rad) * Math.sin(delta) + Math.cos(lat * rad) * Math.cos(delta) * Math.cos(H * rad));
        return alt / rad;
    }

    static phase(alt) {
        if (alt > 6) return { phase: 'day', tint: null };
        if (alt > 0) return { phase: 'golden hour', tint: [255, 150, 60, 0.14] };
        if (alt > -6) return { phase: 'dusk', tint: [70, 50, 120, 0.30] };
        if (alt > -12) return { phase: 'twilight', tint: [15, 20, 70, 0.45] };
        return { phase: 'night', tint: [6, 8, 40, 0.56] };
    }

    // The clock face at the place: "3:24 PM". `timeZone` is data (world.json).
    static localTime(date, timeZone) {
        try {
            return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined }).format(date);
        } catch (e) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
    }

    // ?time=HH:MM (local at the place) — for testing dusk at noon. Builds an
    // instant that reads HH:MM on that place's clock today.
    static overrideDate(hhmm, timeZone) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
        if (!m) return null;
        const now = new Date();
        const localNow = new Date(now.toLocaleString('en-US', { timeZone: timeZone || undefined }));
        const offsetMs = now.getTime() - localNow.getTime();
        const target = new Date(localNow);
        target.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return new Date(target.getTime() + offsetMs);
    }

    // The same clock reading on another calendar day at the place: today's
    // HH:MM:SS on that date, in that zone. What a dated era shows.
    static onDate(isoDate, timeZone, base = new Date()) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
        if (!m) return null;
        const localNow = new Date(base.toLocaleString('en-US', { timeZone: timeZone || undefined }));
        const offsetMs = base.getTime() - localNow.getTime();
        const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), localNow.getHours(), localNow.getMinutes(), localNow.getSeconds());
        return new Date(target.getTime() + offsetMs);
    }

    static now(lat, lon, timeZone, override = null, eraDate = null) {
        const base = Daylight.overrideDate(override, timeZone) || new Date();
        const date = (eraDate && Daylight.onDate(eraDate, timeZone, base)) || base;
        const alt = Daylight.sunAltitude(lat, lon, date);
        const p = Daylight.phase(alt);
        return { ...p, altitude: alt, clock: Daylight.localTime(date, timeZone), date, test: !!override, eraDate: eraDate || null };
    }
}
