// CAIN OS — Home Screen
//
// Deployment-driven (CAIN Deployment Configuration Specification v1.0):
// brand, logo, and the menu itself come from CAIN_Deployment.current. This
// screen owns no brand-specific content — swapping deployments swaps the
// menu without touching this file, and swapping Interface Packs swaps the
// look without touching the menu.
const HomeScreen = {
    id: 'home',
    title: 'Main Menu',
    state: {},

    render: function(container) {
        const currentPack = CAIN_ThemeManager.currentTheme();
        const deployment = CAIN_Deployment.current;

        const brand = deployment ? deployment.brand : 'C.A.I.N.';
        const logo = (deployment && deployment.logo && CAIN_Deployment.asset(deployment.logo))
            || CAIN_Assets.get('bootLogo')
            || '../assets/logo.png';
        const tagline = deployment && deployment.tagline
            ? `<p class="deployment-tagline">${deployment.tagline}</p>`
            : '';
        const menu = (deployment && deployment.menu) || [];

        container.innerHTML = `
            <div class="screen-layout home-layout">
                <aside class="home-sidebar">
                    <div class="system-brand">
                        <img src="${logo}" alt="${brand} logo" class="system-logo">
                        <h1>${brand}</h1>
                        <p>${PlatformConfig.version}</p>
                        ${tagline}
                    </div>

                    <nav class="menu-stack">
                        ${menu.map((item, i) => `
                            <div class="menu-item" data-selectable data-action="menu-select" data-index="${i}">${item.label}</div>
                        `).join('')}
                        <div class="menu-item" data-selectable data-action="open-settings">Display Settings</div>
                    </nav>
                </aside>

                <main class="home-main">
                    <h2>SYSTEM READY</h2>
                    <p id="home-display-panel">Awaiting operator input...</p>
                    <div class="system-readout">
                        <span>DEPLOYMENT</span>
                        <strong>${deployment ? deployment.id : 'none'}</strong>
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
            'menu-select': (dataset, os) => {
                const deployment = CAIN_Deployment.current;
                const item = deployment && deployment.menu[Number(dataset.index)];
                if (!item) return;
                this._dispatch(item, os);
            },
            'open-settings': (dataset, os) => {
                os.push(DisplaySettingsScreen);
            }
        };
    },

    // Generic dispatcher: every deployment menu item is { label, action, target? }.
    // Adding a new deployment never requires touching this switch — it only grows
    // when a genuinely new *action type* is introduced (i.e. a new Module).
    _dispatch: function(item, os) {
        switch (item.action) {
            case 'open-archive':
                os.push(ArchiveListScreen);
                break;
            case 'open-link': {
                const url = CAIN_Deployment.getLink(item.target);
                if (url) window.location.href = url;
                break;
            }
            case 'open-form':
            case 'open-gallery':
            case 'open-qr':
            default:
                // Module not built yet (forms / gallery / QR / video are the next
                // priorities after this Deployment Configuration layer). Show the
                // placeholder rather than doing nothing or throwing.
                os.push(ModulePlaceholderScreen, { item });
        }
    }
};
