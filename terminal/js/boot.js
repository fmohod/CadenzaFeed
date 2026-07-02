// boot.js - Startup sequence logic
document.addEventListener("DOMContentLoaded", () => {
    const bootLines = [
        "CAIN (Cadenza Arthouse Information Network) BIOS v2.1.4",
        "Copyright (C) 2017-2026 Cadenza Arthouse",
        " ",
        "INITIALIZING CORE SYSTEMS...",
        "Memory Test: 640K OK",
        "Loading archive modules... [OK]",
        "Mounting repository nodes... [OK]",
        "Checking security protocols... [BYPASSED]",
        "Synchronizing records...",
        " ",
        "SYSTEM READY.",
        "Awaiting user interaction..."
    ];

    const bootContainer = document.getElementById('boot-text-container');
    const bootScreen = document.getElementById('boot-screen');
    const mainScreen = document.getElementById('main-screen');
    
    let isSkipped = false;
    let lineIndex = 0;

    function typeLine(text, index, callback) {
        if (isSkipped) return;
        if (index < text.length) {
            bootContainer.innerHTML += text.charAt(index);
            // Random chance to play typing sound to make it feel mechanical
            if (Math.random() > 0.5) CAIN_Audio.typeBeep();
            setTimeout(() => typeLine(text, index + 1, callback), Math.random() * 30 + 10);
        } else {
            bootContainer.innerHTML += "<br>";
            setTimeout(callback, Math.random() * 200 + 100);
        }
    }

    function processBootSequence() {
        if (lineIndex < bootLines.length && !isSkipped) {
            typeLine(bootLines[lineIndex], 0, () => {
                lineIndex++;
                processBootSequence();
            });
        } else if (!isSkipped) {
            // Give them a moment to read SYSTEM READY before auto-advancing
            setTimeout(launchMainTerminal, 1500);
        }
    }

    function launchMainTerminal() {
        if(isSkipped) return; // Prevent double firing
        isSkipped = true;
        CAIN_Audio.init();
        CAIN_Audio.bootUp();
        
        bootScreen.classList.remove('active');
        bootScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        mainScreen.classList.add('active');
        
        // Initialize the clock and menu from other scripts
        if(typeof startClock === 'function') startClock();
        if(typeof initMenu === 'function') initMenu();
    }

    // Skip handlers
    document.addEventListener('keydown', (e) => {
        if ((e.key === "Enter" || e.key === " ") && !isSkipped) {
            launchMainTerminal();
        }
    });

    document.addEventListener('click', () => {
        if (!isSkipped) launchMainTerminal();
    });

    // Start sequence
    setTimeout(processBootSequence, 500);
});