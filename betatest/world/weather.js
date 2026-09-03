// WeatherService — real weather at a real place, for the visitor's browser.
//
// Owner, 2026-09-03: "if i load the game right now it should match the weather
// of the location in the game to what's happening IRL."
//
// This asks Open-Meteo (https://open-meteo.com, free, no key, CC BY 4.0 —
// "Weather data by Open-Meteo.com") for the CURRENT conditions at a space's
// anchor coordinates. It runs in the visitor's browser and reveals only the
// public place's coordinates, never the visitor's. It is NOT a CAMT sensor and
// must not be mistaken for one: CAMT's own weather sensing is a parked entry in
// FUTURE_IDEAS.md (a local station first, because an API goes quiet in the storm
// it exists to warn about). A game overlay may go quiet without harm.
//
// Fail-soft: any error → null, the world renders as if nobody looked outside,
// and the dev line says "weather: unavailable" rather than "clear".
class WeatherService {
    constructor({ override = null, ttlMs = 10 * 60 * 1000 } = {}) {
        this.override = override;   // ?weather=rain|storm|drizzle|fog|snow|clear|cloudy|night
        this.ttlMs = ttlMs;
        this.cache = new Map();     // key "lat,lon" → { at, weather }
    }

    static classify(code, isDay) {
        // WMO weather interpretation codes, as Open-Meteo returns them.
        let kind = 'clear', intensity = 0;
        if (code === 0) kind = 'clear';
        else if (code >= 1 && code <= 3) { kind = 'cloudy'; intensity = code / 3; }
        else if (code === 45 || code === 48) { kind = 'fog'; intensity = 0.6; }
        else if (code >= 51 && code <= 57) { kind = 'drizzle'; intensity = 0.35; }
        else if (code >= 61 && code <= 67) { kind = 'rain'; intensity = code >= 65 ? 1 : code >= 63 ? 0.7 : 0.45; }
        else if (code >= 71 && code <= 77) { kind = 'snow'; intensity = 0.6; }
        else if (code >= 80 && code <= 82) { kind = 'rain'; intensity = code === 82 ? 1 : code === 81 ? 0.75 : 0.5; }
        else if (code === 85 || code === 86) { kind = 'snow'; intensity = 0.7; }
        else if (code >= 95) { kind = 'storm'; intensity = 1; }
        return { kind, intensity, isDay: isDay !== 0, code };
    }

    static fromOverride(word) {
        const presets = {
            clear: { kind: 'clear', intensity: 0, isDay: true },
            cloudy: { kind: 'cloudy', intensity: 0.8, isDay: true },
            fog: { kind: 'fog', intensity: 0.6, isDay: true },
            drizzle: { kind: 'drizzle', intensity: 0.35, isDay: true },
            rain: { kind: 'rain', intensity: 0.8, isDay: true },
            storm: { kind: 'storm', intensity: 1, isDay: true },
            snow: { kind: 'snow', intensity: 0.7, isDay: true },
            night: { kind: 'clear', intensity: 0, isDay: false },
        };
        const w = presets[word];
        return w ? { ...w, code: null, source: 'override', temperatureC: null, fetchedAt: Date.now() } : null;
    }

    async get(lat, lon) {
        if (this.override) return WeatherService.fromOverride(this.override);
        const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < this.ttlMs) return hit.weather;
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
                        `&current=weather_code,is_day,precipitation,temperature_2m&timezone=auto`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const c = data.current || {};
            const weather = {
                ...WeatherService.classify(c.weather_code, c.is_day),
                precipitationMm: c.precipitation,
                temperatureC: c.temperature_2m,
                observedAt: c.time || null,
                source: 'open-meteo',
                fetchedAt: Date.now(),
            };
            this.cache.set(key, { at: Date.now(), weather });
            return weather;
        } catch (e) {
            console.info('[weather] unavailable:', e.message);
            return null;
        }
    }

    static describe(w, placeName = null) {
        if (!w) return '';
        const words = { clear: 'clear', cloudy: 'cloudy', fog: 'fog', drizzle: 'drizzle', rain: 'rain', storm: 'thunderstorm', snow: 'snow' };
        let s = words[w.kind] || w.kind;
        if (typeof w.temperatureC === 'number') s += `, ${Math.round(w.temperatureC * 9 / 5 + 32)}°F`;
        if (w.source === 'override') s += ' (test)';
        return placeName ? `Now at ${placeName}: ${s}` : s;
    }
}
