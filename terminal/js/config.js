const PlatformConfig = {
    environment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'local' : 'production',
    terminalMode: 'standalone', 
    version: 'CAIN OS v1.2.0',
    archiveRoot: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://cadenzaarthouse.com'
};

const SystemClock = {
    now: () => new Date(),
    formatTerminalTime: () => SystemClock.now().toLocaleTimeString('en-US', { hour12: false })
};