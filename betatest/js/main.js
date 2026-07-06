document.addEventListener("DOMContentLoaded", async () => {
    // Layer order matters here: Deployment Config decides WHAT to show,
    // Interface Packs decide HOW it looks. Load both before the first screen
    // renders so Home never has to guess at brand/menu on first paint.
    await Promise.all([
        CAIN_InterfacePacks.init(),
        CAIN_Deployment.init()
    ]);

    const CAIN = new TerminalOS('cain-os-display');
    document.getElementById('cain-os-display').osRef = CAIN;
    CAIN.push(BootScreen);

    // Idle Mode (Core Engine): starts watching for inactivity immediately;
    // it no-ops while the boot sequence is on screen (see js/idle.js).
    const CAIN_IdleManager = new IdleManager(CAIN);
    CAIN_IdleManager.start();
});
