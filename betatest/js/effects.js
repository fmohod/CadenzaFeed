// effects.js - Subtle screen jitter/flicker
(function() {
    const overlay = document.querySelector('.crt-overlay');
    if (!overlay) return;
    
    setInterval(() => {
        if(Math.random() > 0.98) {
            overlay.style.opacity = '0.15';
            setTimeout(() => overlay.style.opacity = '0.05', 50);
        }
    }, 100);
})();