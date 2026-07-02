// archive.js - Dynamic Fetch and Parsing Engine
const CAIN_Archive = (function() {
    let records = [];
    let isFetching = false;
    let maxSearched = false;

    // Automatically count up and fetch until we hit a 404
    async function syncArchives() {
        if (isFetching || maxSearched) return;
        isFetching = true;
        let currentId = 1;

        while (!maxSearched) {
            let folderId = currentId.toString().padStart(4, '0');
            try {
                let response = await fetch(`../${folderId}/index.html`);
                if (response.ok) {
                    let htmlText = await response.text();
                    let parsedData = parseHTML(htmlText, folderId);
                    if (parsedData) records.push(parsedData);
                    
                    // Update the header node count visually
                    const nodeDisplay = document.getElementById('node-count');
                    if (nodeDisplay) nodeDisplay.innerText = `${records.length} Nodes`;
                    
                    currentId++;
                } else {
                    maxSearched = true; // 404 hit, stop searching
                }
            } catch (error) {
                maxSearched = true;
            }
        }
        isFetching = false;
    }

    // Extract meta tags and content from the fetched HTML
    function parseHTML(htmlString, id) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const getMeta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content || 'UNKNOWN';
        const title = doc.querySelector('title')?.innerText || `ARCHIVE_${id}`;

        let contentEl = doc.querySelector('.article-content');
        let contentHTML = contentEl ? contentEl.innerHTML : "<p>ERROR: NO READABLE DATA IN NODE</p>";

        // Rewrite relative image paths so they work from the /terminal folder
        contentHTML = contentHTML.replace(/src="([^"]+)"/g, (match, path) => {
            if (path.startsWith('http') || path.startsWith('/')) return match;
            return `src="../${id}/${path}"`;
        });

        return {
            id: id,
            title: title,
            date: getMeta('date'),
            era: getMeta('game-era'),
            location: getMeta('game-location'),
            tags: getMeta('game-tags'),
            flavor: getMeta('game-flavor'),
            content: contentHTML
        };
    }

    function renderList() {
        if (records.length === 0) {
            return `<h3>ARCHIVE DATABASE</h3><p class="blink">SYNCING NODES... PLEASE WAIT</p>`;
        }

        let html = `<h3>ARCHIVE DATABASE</h3><ul class="archive-list">`;
        records.forEach((rec, index) => {
            html += `<li><button class="archive-btn" data-index="${index}">[${rec.id}] ${rec.title}</button></li>`;
        });
        html += `</ul><p class="instruction">Select a record to view dossier.</p>`;
        return html;
    }

    function renderArticle(index) {
        const rec = records[index];
        if (!rec) return `<p>ERROR: RECORD CORRUPTED</p>`;

        return `
            <div class="dossier-header">
                <h2>RECORD // ${rec.id}</h2>
                <h1>${rec.title}</h1>
                <div class="dossier-meta">
                    <p><strong>DATE:</strong> ${rec.date}</p>
                    <p><strong>ERA:</strong> ${rec.era}</p>
                    <p><strong>LOC:</strong> ${rec.location}</p>
                    <p><strong>TAGS:</strong> ${rec.tags}</p>
                </div>
                <p class="flavor-text">>> ${rec.flavor}</p>
            </div>
            <div class="dossier-content">
                ${rec.content}
            </div>
            <button class="back-btn" onclick="document.querySelector('[data-action=archive]').click()">◀ RETURN TO LIST</button>
        `;
    }

    return {
        init: syncArchives,
        renderList: renderList,
        renderArticle: renderArticle
    };
})();