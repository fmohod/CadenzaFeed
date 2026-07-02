// boot.js - Startup sequence logic
document.addEventListener("DOMContentLoaded", () => {
    const bootLines = [
        "CAIN (Cadenza Arthouse Information Network) BIOS v2.1.4",
        "INITIALIZING CORE SYSTEMS...",
        "Memory Test: 640K OK",
        "Loading archive modules... [OK]",
        "Mounting repository nodes... [OK]",
        "Checking security protocols... [BYPASSED]",
        "Synchronizing records...",
        "SYSTEM READY."
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
            setTimeout(launchMainTerminal, 1500);
        }
    }

    function initAudioContext() {
        // Must be called directly by the click/keydown event to satisfy browser policies
        if(typeof CAIN_Audio.init === 'function') CAIN_Audio.init();
    }

    function launchMainTerminal() {
        if(isSkipped) return; 
        isSkipped = true;
        
        CAIN_Audio.bootUp();
        
        bootScreen.classList.remove('active');
        bootScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        mainScreen.classList.add('active');
        
        if(typeof startClock === 'function') startClock();
        if(typeof initMenu === 'function') initMenu();
    }

    document.addEventListener('keydown', (e) => {
        initAudioContext();
        if ((e.key === "Enter" || e.key === " ") && !isSkipped) launchMainTerminal();
    });

    document.addEventListener('click', () => {
        initAudioContext();
        if (!isSkipped) launchMainTerminal();
    });

    setTimeout(processBootSequence, 500);
});