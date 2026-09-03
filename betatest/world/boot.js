// boot.js — the thin Platform bootstrap for the world shell (INTERFACE_CONTRACTS:
// "Platform is not a library. It is the bootstrapper.") Wiring only.
document.addEventListener('DOMContentLoaded', async () => {
    // Offline after first load: a network-first service worker keeps the last
    // good copy of everything this page fetched (shell, content, CAIN, articles).
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('sw.js').catch((e) => console.info('[sw] not registered:', e.message));
    }

    const bus = new EventBus();
    const input = new InputRouter();
    if (InputRouter.touchWanted()) {
        const touch = document.getElementById('touch');
        touch.hidden = false;
        input.bindTouch(touch);
    }

    const content = await ContentLoader.load('content/world.json');

    const host = new TerminalHost({ bus, input });
    try {
        await host.mount();
    } catch (e) {
        // The world is still playable without its computer; say so in the console.
        console.error('[terminal-host] CAIN failed to mount; terminals will not open.', e);
    }

    const world = new WorldEngine({ bus, input, content, host, canvas: document.getElementById('world-canvas') });
    window.CADENZA_WORLD = world; // debugging handle; nothing depends on it
    world.start();
});
