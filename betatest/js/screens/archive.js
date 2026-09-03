const ArchiveListScreen = {
    id: 'archive-list',
    title: 'Archive Database',
    state: {
        focusedId: null // Remembers what record you were hovering over
    },

    render: function(container) {
        container.innerHTML = `
            <div style="padding: 2rem; height: 100vh; display: flex; flex-direction: column;">
                <header style="border-bottom: var(--panel-border); padding-bottom: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between;">
                    <h2>ARCHIVE INDEX</h2>
                    <div id="sync-status" class="blink">SYNCING NODES...</div>
                </header>
                
                <main id="archive-list-container" style="flex: 1; overflow-y: hidden; display: flex; flex-direction: column; gap: 0.5rem;">
                    </main>

                <footer style="margin-top: 1rem; padding-top: 1rem; border-top: var(--panel-border);">
                    <div class="menu-item" data-selectable data-action="SYS_BACK" style="display:inline-block;">[ESC] BACK TO HOME</div>
                </footer>
            </div>
        `;
    },

    onEnter: async function(os, data) {
        // Fetch data via the Service
        const records = await CAIN_ArchiveService.sync();
        
        document.getElementById('sync-status').innerText = `${records.length} NODES ONLINE`;
        document.getElementById('sync-status').classList.remove('blink');
        
        const listContainer = document.getElementById('archive-list-container');
        listContainer.innerHTML = '';

        if (records.length === 0) {
            listContainer.innerHTML = `<p style="opacity: 0.5;">No records found in database.</p>`;
        } else {
            // Build the interactive list
            records.forEach(rec => {
                const isSelected = this.state.focusedId === rec.id ? 'focused' : '';
                listContainer.innerHTML += `
                    <div class="menu-item ${isSelected}" data-selectable data-action="open-record" data-id="${rec.id}">
                        [${rec.id}] ${rec.title}
                    </div>
                `;
            });
        }
        
        // Tell the OS to re-scan the new buttons, then land on the first record
        // (or the one we were on) rather than the footer's BACK item, which was
        // the only selectable thing on screen while the list was still loading.
        os.focus.scan(os.container);
        const remembered = this.state.focusedId && listContainer.querySelector(`[data-id="${this.state.focusedId}"]`);
        const first = remembered || listContainer.querySelector('[data-selectable]');
        if (first) os.focus.setFocus(first);
    },

    onSuspend: function() {
        // Save the currently focused element's ID before we leave
        const activeEl = document.querySelector('[data-selectable].focused');
        if (activeEl) this.state.focusedId = activeEl.dataset.id;
    },
    
    onResume: function() {
        // Focus manager automatically handles re-selecting if we apply the 'focused' class in render, 
        // but since we render dynamically, onEnter's logic or a manual re-focus here works beautifully.
    },
    
    onLeave: function() {},
    destroy: function() {},

    get actions() {
        return {
            'open-record': (dataset, os) => {
                os.push(RecordViewScreen, { id: dataset.id });
            }
        };
    }
};