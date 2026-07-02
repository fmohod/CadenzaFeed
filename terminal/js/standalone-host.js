// STANDALONE TERMINAL HOST
// Boots the Archive Terminal (engine/terminal.js) WITHOUT the game world.
//
// Per INTERFACE_CONTRACTS.md: the Terminal is pure UI that talks only to a host.
// The in-game terminal happens to receive the live `engine`; here we hand it an
// engine-SHAPED object built from the same Archive the game uses. The Terminal is
// reused verbatim — no fork, no duplicated rendering logic (RULES.md #2/#3).
//
// Modes (PlatformConfig.mode):
//   public    — published Records only, no dev tools. Safe to expose to visitors.
//   archivist — everything incl. unpublished, dev flag on. Gate the URL later.
//
// The Terminal's RECORDS screen lists `engine.simulation.state.recovered`. There
// is no "recovery" outside the game, so we treat the host's visible set AS the
// recovered set: public → published records, archivist → all records.

(function () {
  'use strict';

  // ── resolve mode ──────────────────────────────────────────────────────────
  // Priority: ?mode=… query param  >  window.CADENZA_CONFIG.mode  >  'public'.
  // The query param lets one deployed shell switch modes without a rebuild; the
  // archivist mode stays behind an explicit ?mode=archivist flag for now (a real
  // access gate — Cloudflare Access — is the follow-up, tracked separately).
  function resolveMode() {
    const q = new URLSearchParams(location.search).get('mode');
    const cfg = (window.CADENZA_CONFIG && window.CADENZA_CONFIG.mode) || null;
    const mode = (q || cfg || 'public').toLowerCase();
    return mode === 'archivist' ? 'archivist' : 'public';
  }

  // A published Record is one whose article opted into the game layer
  // (game-record=true). The Archive only ever loads opted-in articles as Records,
  // so in this build "published" == "every Record the Archive holds". When a
  // draft/unpublished flag is added later, public mode filters on it here and
  // archivist mode ignores it — the single seam for that policy.
  function visibleRecordIds(archive, mode) {
    const all = archive.getAllRecords();
    const records = (mode === 'archivist')
      ? all
      : all.filter(r => r.published !== false); // default published; future drafts set published:false
    return records.map(r => r.id);
  }

  // ── minimal simulation shim ───────────────────────────────────────────────
  // Satisfies exactly what terminal.js reads: state.recovered, getRecoveredCount,
  // getTotalCount, getEra. Nothing game-stateful — this is a read-only view.
  function makeSimulation(archive, mode) {
    const recovered = visibleRecordIds(archive, mode);
    const era = (archive.manifest && archive.manifest.activeEra) || '—';
    return {
      state: { recovered },
      getRecoveredCount: () => recovered.length,
      getTotalCount: () => archive.getTotalRecordCount(),
      getEra: () => era,
    };
  }

  // ── engine-shaped host ────────────────────────────────────────────────────
  function makeHost(archive, bus, mode) {
    return {
      bus,
      archive,
      simulation: makeSimulation(archive, mode),
      presentation: null, // no canvas world to suppress
      audio: null,        // no audio engine in the standalone shell
      mode,
    };
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  async function boot() {
    const mode = resolveMode();
    const bus = new EventBus();

    // archiveRoot from PlatformConfig ('' = same-origin root). The shell sets this
    // so Archive (article discovery + fetch) and ArchiveRecordBuilder both resolve
    // articles at the deployment root regardless of where the shell itself lives.
    const archiveRoot = (window.CADENZA_CONFIG && window.CADENZA_CONFIG.archiveRoot) ?? '';
    const archive = new Archive({ archiveRoot });

    const status = document.getElementById('boot-status');
    const setStatus = (t) => { if (status) status.textContent = t; };

    setStatus('SCANNING ARCHIVE…');
    // manifest.json lives beside the game; resolve it against archiveRoot too so
    // the same shell works locally and on the subdomain. Falls back gracefully —
    // Archive.load never throws, it records errors and continues.
    await archive.load(`${archiveRoot}/game/manifest.json`.replace(/^\/+/, '/'));

    const host = makeHost(archive, bus, mode);

    // The Terminal was written against `engine`; the host is that shape.
    const terminal = new ArchiveTerminal(host);
    terminal.wire();

    // Standalone: there is no game world behind the terminal, so POWER OFF / EXIT
    // must not leave a black void. The terminal's hide() simply drops its 'on'
    // class; we re-open immediately so the terminal IS the app. (hide() emits no
    // event, so we wrap it rather than subscribe.)
    const origHide = terminal.hide.bind(terminal);
    terminal.hide = function () {
      origHide();
      setTimeout(() => { if (!terminal.open) terminal.show(); }, 50);
    };

    setStatus('READY');
    document.body.classList.add('booted');
    terminal.show();

    // expose for dev/debugging in archivist mode
    if (mode === 'archivist') {
      window.CADENZA = { archive, terminal, host, bus };
      console.info('[terminal] archivist mode — window.CADENZA available');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
