const RecordViewScreen = {
    id: 'record-view',
    title: 'Record Dossier',
    state: {},

    render: function(container, data) {
        // getRecord returns { id, title, record } — the full typed Archive Record.
        const item = CAIN_ArchiveService.getRecord(data.id);

        if (!item || !item.record) {
            container.innerHTML = `<div style="padding:2rem;"><h2>ERROR: CORRUPTED NODE</h2><div class="menu-item" data-selectable data-action="SYS_BACK">[ESC] BACK</div></div>`;
            return;
        }

        const rec = item.record;
        const meta = [rec.created, rec.section, rec.author].filter(Boolean).join('  ·  ');

        container.innerHTML = `
            <div style="padding: 2rem; height: 100vh; display: flex; flex-direction: column;">
                <header style="border-bottom: var(--panel-border); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <h2>FILE // ${item.id}</h2>
                    <h1>${rec.title}</h1>
                    ${meta ? `<p class="dossier-byline">${meta}</p>` : ''}
                </header>

                <main class="dossier-content" id="dossier-body" style="flex: 1; overflow-y: auto; padding-right: 2rem; margin-bottom:1rem;"></main>

                <footer style="border-top: var(--panel-border); padding-top: 1rem;">
                    <div class="menu-item" data-selectable data-action="SYS_BACK" style="display:inline-block;">[ESC] RETURN TO INDEX</div>
                </footer>
            </div>
        `;

        // Semantic body via the canonical renderer — no page chrome leaks in.
        // linkReferences:true → the REFERENCES list becomes real links that open
        // in a new tab (CAIN is a browsing tool, not the in-world game terminal).
        const body = document.getElementById('dossier-body');
        body.appendChild(ArchiveRecordRenderer.toFragment(rec, { linkReferences: true }));
    },

    onEnter: function(os, data) {},
    onSuspend: function() {},
    onResume: function() {},
    onLeave: function() {},
    destroy: function() {},

    get actions() {
        return {}; // Only SYS_BACK is needed, which the OS handles automatically
    }
};
