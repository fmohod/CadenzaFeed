const HomeScreen = {
    id: 'home',
    title: 'Main Menu',
    state: {},

    render: function(container) {
        container.innerHTML = `
            <div class="screen-layout" style="display:flex; height:100vh; padding:2rem;">
                <aside style="width: 300px; border-right: var(--panel-border); padding-right: 2rem;">
                    <div style="margin-bottom: 2rem;">
                        <img src="../assets/logo.png" alt="Logo" style="max-width:100%; filter: invert(1) sepia(1) hue-rotate(80deg) saturate(5);">
                        <h1>C.A.I.N.</h1>
                        <p style="opacity:0.7">v1.2.0</p>
                    </div>
                    
                    <nav style="display:flex; flex-direction:column; gap:1rem;">
                        <div class="menu-item" data-selectable data-action="open-placeholder">Enter Archive Terminal</div>
                        <div class="menu-item" data-selectable data-action="open-website">Main Website</div>
                        <div class="menu-item" data-selectable data-action="open-press">Press Archive</div>
                    </nav>
                </aside>
                
                <main style="flex: 1; padding-left: 2rem;">
                    <h2 style="margin-bottom: 1rem;">SYSTEM READY</h2>
                    <p id="home-display-panel">Awaiting operator input...</p>
                </main>
            </div>
        `;
    },

    onEnter: function(os, data) {},
    onSuspend: function() {},
    onResume: function() {},
    onLeave: function() {},
    destroy: function() {},

get actions() {
        return {
            'open-placeholder': (dataset, os) => {
                os.push(ArchiveListScreen);
            },
            'open-website': (dataset, os) => {
                window.location.href = PlatformConfig.archiveRoot || '/';
            },
            'open-press': (dataset, os) => {
                window.location.href = `${PlatformConfig.archiveRoot}/all.html`;
            }
        };
    }
};