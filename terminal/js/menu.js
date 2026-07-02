// menu.js - Navigation and Display Logic
function startClock() {
    const clockEl = document.getElementById('clock');
    setInterval(() => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('en-US', { hour12: false });
    }, 1000);
}

function initMenu() {
    const buttons = document.querySelectorAll('.menu-btn');
    const display = document.getElementById('display-content');
    let currentIndex = 0;

    // Trigger background fetch immediately
    CAIN_Archive.init();

    const views = {
        website: `<h3>MAIN WEBSITE</h3><p>Routing to external interface...</p><p>Target: cadenzaarthouse.com</p><p class="blink">Press [ENTER] to execute link.</p>`,
        press: `<h3>PRESS ARCHIVE</h3><p>Routing to repository...</p><p>Target: cadenzaarthouse.com/all.html</p><p class="blink">Press [ENTER] to execute link.</p>`,
        about: `<h3>ABOUT C.A.I.N.</h3><p>The Cadenza Arthouse Information Network (CAIN) is an experimental access node.</p><br><p>It will eventually serve as the canonical interface bridging the website, RPG elements, AI systems, and internal publishing tools.</p>`,
        sysinfo: `<h3>SYSTEM DIAGNOSTICS</h3><ul><li>OS: CAIN v1.0.4a</li><li>Environment: ${navigator.userAgent.substring(0,40)}...</li><li>Resolution: ${window.innerWidth}x${window.innerHeight}</li><li>Uptime: Synchronized</li></ul>`
    };

    function updateSelection() {
        buttons.forEach((btn, index) => {
            if (index === currentIndex) {
                btn.classList.add('selected');
                
                // If Archive is selected, ask CAIN_Archive for the list
                if (btn.dataset.action === 'archive') {
                    display.innerHTML = CAIN_Archive.renderList();
                    bindArchiveButtons();
                } else {
                    display.innerHTML = views[btn.dataset.action] || `<p>Awaiting input...</p>`;
                }
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    function bindArchiveButtons() {
        const archiveBtns = document.querySelectorAll('.archive-btn');
        archiveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                CAIN_Audio.navSelect();
                const recordIndex = e.target.getAttribute('data-index');
                display.innerHTML = CAIN_Archive.renderArticle(recordIndex);
            });
            btn.addEventListener('mouseenter', () => CAIN_Audio.navHover());
        });
    }

    function executeAction() {
        CAIN_Audio.navSelect();
        const action = buttons[currentIndex].dataset.action;
        
        if (action === 'website') setTimeout(() => window.location.href = "https://cadenzaarthouse.com", 500);
        if (action === 'press') setTimeout(() => window.location.href = "https://cadenzaarthouse.com/all.html", 500);
    }

    document.addEventListener('keydown', (e) => {
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen.id !== 'main-screen') return;

        if (e.key === 'ArrowDown') {
            currentIndex = (currentIndex + 1) % buttons.length;
            CAIN_Audio.navHover();
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            currentIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            CAIN_Audio.navHover();
            updateSelection();
        } else if (e.key === 'Enter') {
            executeAction();
        }
    });

    buttons.forEach((btn, index) => {
        btn.addEventListener('mouseenter', () => {
            if (currentIndex !== index) {
                currentIndex = index;
                CAIN_Audio.navHover();
                updateSelection();
            }
        });
        btn.addEventListener('click', executeAction);
    });

    updateSelection();
}