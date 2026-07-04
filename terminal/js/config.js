const PlatformConfig = {
    environment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'local' : 'production',
    terminalMode: 'standalone', 
    version: 'CAIN OS v1.3.0-beta',
    osVersion: '1.3.0',
    interfacePackSpec: '1.0',
    archiveRoot: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://cadenzaarthouse.com',
    interfacePackRoot: 'interface-packs'
};

const SystemClock = {
    now: () => new Date(),
    formatTerminalTime: () => SystemClock.now().toLocaleTimeString('en-US', { hour12: false })
};

// The canonical ArchiveRecordBuilder (game/engine/record.js) resolves article
// paths against window.CADENZA_CONFIG.archiveRoot. Local: '..' (from /betatest/ up
// to the repo root, so '../0001/index.html'). Production: the apex origin. This
// keeps CAIN's record parsing aligned with its own ArchiveService discovery.
window.CADENZA_CONFIG = {
    archiveRoot: PlatformConfig.environment === 'local' ? '..' : PlatformConfig.archiveRoot
};
