document.addEventListener("DOMContentLoaded", () => {
    const CAIN = new TerminalOS('cain-os-display');
    document.getElementById('cain-os-display').osRef = CAIN; 
    CAIN.push(BootScreen);
});