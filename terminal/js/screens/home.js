const HomeScreen = {
    id: 'home',
    title: 'Main Menu',
    state: {},

    render: function(container) {
        const currentPack = CAIN_ThemeManager.currentTheme();
        const bootLogo = CAIN_Assets.get('bootLogo') || '../assets/logo.png';
        container.innerHTML = `
            <div class="screen-layout home-layout">
                <aside class="home-sidebar">
                    <div class="system-brand">
                        <img src="${bootLogo}" alt="CAIN logo" class="system-logo">
                        <h1>C.A.I.N.</h1>
                        <p>${PlatformConfig.version}</p>
                    </div>
                    
                    <nav class="menu-stack">
                        <div class="menu-item" data-selectable data-action="open-archive">Enter Archive Terminal</div>
                        <div class="menu-item" data-selectable data-action="open-settings">Display Settings</div>
                        <div class="menu-item" data-selectable data-action="open-website">Main Website</div>
                        <div class="menu-item" data-selectable data-action="open-press">Press Archive</div>
                    </nav>
                </aside>
                
                <main class="home-main">
                    <h2>SYSTEM READY</h2>
                    <p id="home-display-panel">Awaiting operator input...</p>
                    <div class="system-readout">
                        <span>INTERFACE PACK</span>
                        <strong>${currentPack ? currentPack.name : 'Fallback Core'}</strong>
                    </div>
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
            'open-archive': (dataset, os) => {
                os.push(ArchiveListScreen);
            },
            'open-settings': (dataset, os) => {
                os.push(DisplaySettingsScreen);
            },
            'open-website': (dataset, os) => {
                window.location.href = PlatformConfig.archiveRoot || '/';
            },
            'open-press': (dataset, os) => {
                // Press Archive relocated from /all.html to /news/ (2026-07).
                window.location.href = `${PlatformConfig.archiveRoot}/news/`;
            }
        };
    }
};
