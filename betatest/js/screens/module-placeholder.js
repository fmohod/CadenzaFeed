// CAIN OS — Module Placeholder Screen
//
// Layer 3 ("Modules": forms, gallery, video, QR, booking, etc.) is built
// incrementally after the Deployment Configuration layer. Until a given
// module's real screen exists, any deployment menu item that points at it
// resolves here instead of crashing or silently doing nothing.
//
// This screen also proves the config plumbing end-to-end: it reads the
// resolved menu item + the matching deployment.json data (form fields,
// submit endpoint, QR target, playlist) and displays it, so it's visible
// that the Deployment Configuration layer is already driving behavior —
// only the module's presentation layer is still pending.
const ModulePlaceholderScreen = {
    id: 'module-placeholder',
    title: 'Module Pending',
    state: {},

    render: function(container, data) {
        const item = (data && data.item) || {};
        const deployment = CAIN_Deployment.current;
        const detail = this._resolveDetail(item, deployment);

        container.innerHTML = `
            <div class="screen-layout module-placeholder-layout">
                <header class="screen-header">
                    <div>
                        <h2>MODULE NOT YET BUILT</h2>
                        <h1>${item.label || item.action || 'Untitled Module'}</h1>
                    </div>
                    <div class="status-pill">PHASE 1 IN PROGRESS</div>
                </header>

                <main class="module-placeholder-body">
                    <p>This menu item is wired to a live Deployment Configuration entry, but its Module screen hasn't been built yet.</p>
                    <dl class="config-dump">
                        <div><dt>Deployment</dt><dd>${deployment ? deployment.id : 'none'}</dd></div>
                        <div><dt>Action</dt><dd>${item.action || ''}</dd></div>
                        <div><dt>Target</dt><dd>${item.target || '—'}</dd></div>
                    </dl>
                    <pre class="config-dump-raw">${this._escape(JSON.stringify(detail, null, 2))}</pre>
                </main>

                <footer class="screen-footer">
                    <div class="menu-item" data-selectable data-action="SYS_BACK">[ESC] BACK TO HOME</div>
                </footer>
            </div>
        `;
    },

    _resolveDetail: function(item, deployment) {
        if (!deployment) return null;
        switch (item.action) {
            case 'open-form':
                return CAIN_Deployment.getForm(item.target) || { note: 'No form config found for this target.' };
            case 'open-qr':
                return CAIN_Deployment.getQr() || { note: 'No QR config on this deployment.' };
            case 'open-gallery':
                return { target: item.target, note: 'Gallery module not yet built.' };
            default:
                return item;
        }
    },

    _escape: function(str) {
        return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    },

    onEnter: function(os) { os.focus.scan(os.container); },
    onSuspend: function() {},
    onResume: function() {},
    onLeave: function() {},
    destroy: function() {},

    get actions() {
        return {};
    }
};
