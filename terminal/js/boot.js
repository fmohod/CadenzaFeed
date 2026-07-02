const BootScreen = {
    id: 'boot',
    title: 'System Boot',
    state: {},
    
    render: function(container) {
        container.innerHTML = `
            <div id="boot-wrapper" style="padding: 2rem;">
                <div id="boot-text-container"></div>
                <div class="skip-hint blink" style="margin-top:2rem; opacity:0.5;">Press [ENTER] to skip or initialize audio</div>
            </div>
        `;
    },

    onEnter: function(os, data) {
        if (typeof CAIN_Audio !== 'undefined') CAIN_Audio.init(); 
        
        const bootText = document.getElementById('boot-text-container');
        bootText.innerHTML = `
            <p>CAIN (Cadenza Arthouse Information Network) BIOS v2.1.4</p>
            <p>INITIALIZING CORE SYSTEMS...</p>
            <p class="blink">LOADING...</p>
        `;

        this.bootTimer = setTimeout(() => {
            if (typeof CAIN_Audio !== 'undefined' && typeof CAIN_Audio.bootUp === 'function') CAIN_Audio.bootUp();
            os.push(HomeScreen);
        }, 2000);
    },

    onSuspend: function() { clearTimeout(this.bootTimer); },
    onResume: function() {},
    onLeave: function() { clearTimeout(this.bootTimer); },
    destroy: function() {},
    
    get actions() {
        return {};
    },
    
    onKey: function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            clearTimeout(this.bootTimer);
            document.getElementById('cain-os-display').osRef.push(HomeScreen);
        }
    }
};