document.addEventListener("DOMContentLoaded", async () => {
    await CAIN_InterfacePacks.init();

    const CAIN = new TerminalOS('cain-os-display');
    document.getElementById('cain-os-display').osRef = CAIN; 
    CAIN.push(BootScreen);
});
