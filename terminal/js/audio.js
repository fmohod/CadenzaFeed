// audio.js - Synthesized Web Audio API Engine
const CAIN_Audio = (function() {
    let audioCtx = null;
    let isInitialized = false;

    function init() {
        if (!isInitialized) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            isInitialized = true;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Master synth function
    function playTone(freq, type, duration, vol) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    return {
        init: init,
        typeBeep: () => playTone(600, 'square', 0.05, 0.02),
        navHover: () => playTone(300, 'sine', 0.05, 0.05),
        navSelect: () => playTone(800, 'square', 0.1, 0.1),
        errorBeep: () => playTone(150, 'sawtooth', 0.3, 0.1),
        bootUp: () => {
            if(!audioCtx) return;
            // Classic ascending BIOS boot tone
            playTone(220, 'square', 0.2, 0.05);
            setTimeout(() => playTone(440, 'square', 0.4, 0.05), 200);
            setTimeout(() => playTone(880, 'sine', 0.8, 0.05), 600);
        }
    };
})();