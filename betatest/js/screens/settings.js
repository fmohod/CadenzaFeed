const DisplaySettingsScreen = {
    id: 'display-settings',
    title: 'Display Settings',
    state: {},

    render: function(container) {
        const packs = CAIN_InterfacePacks.getPacks();
        const currentPack = CAIN_ThemeManager.currentTheme();

        container.innerHTML = `
            <div class="screen-layout settings-layout">
                <header class="screen-header">
                    <div>
                        <h2>DISPLAY SETTINGS</h2>
                        <h1>Interface Packs</h1>
                    </div>
                    <div class="status-pill">${packs.length} PACKS REGISTERED</div>
                </header>

                <main class="settings-grid">
                    ${packs.map(pack => this._renderPackCard(pack, currentPack)).join('')}
                </main>

                <footer class="screen-footer">
                    <div class="menu-item" data-selectable data-action="SYS_BACK">[ESC] BACK TO HOME</div>
                </footer>
            </div>
        `;
    },

    _renderPackCard: function(pack, currentPack) {
        const active = currentPack && currentPack.uuid === pack.uuid;
        const preview = CAIN_InterfacePacks.getPackAsset(pack.uuid, 'preview');
        const flags = Object.entries(pack.supports || {})
            .filter((entry) => entry[1])
            .map((entry) => entry[0])
            .slice(0, 5);

        return `
            <article class="pack-card ${active ? 'is-active' : ''}" data-selectable data-action="select-pack" data-uuid="${pack.uuid}">
                <div class="pack-preview" style="${preview ? `background-image:url('${preview}')` : ''}">
                    <span>${active ? 'ACTIVE' : 'AVAILABLE'}</span>
                </div>
                <div class="pack-card-body">
                    <div class="pack-kicker">${pack.certification || 'community'} / ${pack.layout}</div>
                    <h2>${pack.name}</h2>
                    <p>${pack.description}</p>
                    <dl class="pack-meta">
                        <div><dt>Version</dt><dd>${pack.packVersion}</dd></div>
                        <div><dt>Spec</dt><dd>${pack.spec}</dd></div>
                        <div><dt>OS</dt><dd>${pack.minimumOS} - ${pack.maximumOS}</dd></div>
                    </dl>
                    <div class="pack-flags">
                        ${flags.map(flag => `<span>${flag}</span>`).join('')}
                    </div>
                </div>
            </article>
        `;
    },

    onEnter: function(os, data) {
        os.focus.scan(os.container);
    },
    onSuspend: function() {},
    onResume: function() {},
    onLeave: function() {},
    destroy: function() {},

    get actions() {
        return {
            'select-pack': (dataset, os) => {
                const applied = CAIN_InterfacePacks.applyPack(dataset.uuid);
                if (!applied && typeof CAIN_Audio !== 'undefined') CAIN_Audio.errorBeep();
                this.render(os.container);
                os.focus.scan(os.container);
            }
        };
    }
};
