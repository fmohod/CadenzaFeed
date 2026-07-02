const RecordViewScreen = {
    id: 'record-view',
    title: 'Record Dossier',
    state: {},

    render: function(container, data) {
        // We get 'data.id' passed from the ArchiveScreen's action!
        const record = CAIN_ArchiveService.getRecord(data.id);

        if (!record) {
            container.innerHTML = `<div style="padding:2rem;"><h2>ERROR: CORRUPTED NODE</h2><div class="menu-item" data-selectable data-action="SYS_BACK">BACK</div></div>`;
            return;
        }

        container.innerHTML = `
            <div style="padding: 2rem; height: 100vh; display: flex; flex-direction: column;">
                <header style="border-bottom: var(--panel-border); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <h2>FILE // ${record.id}</h2>
                    <h1>${record.title}</h1>
                </header>
                
                <main class="dossier-content" style="flex: 1; overflow-y: auto; padding-right: 2rem; margin-bottom:1rem;">
                    ${record.content}
                </main>

                <footer style="border-top: var(--panel-border); padding-top: 1rem;">
                    <div class="menu-item" data-selectable data-action="SYS_BACK" style="display:inline-block;">[ESC] RETURN TO INDEX</div>
                </footer>
            </div>
        `;
    },

    onEnter: function(os, data) {},
    onSuspend: function() {},
    onResume: function() {},
    onLeave: function() {},
    destroy: function() {},

    get actions() {
        return {}; // We only need the SYS_BACK command, which the OS handles automatically
    }
};