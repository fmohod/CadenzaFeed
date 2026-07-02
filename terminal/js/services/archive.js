class ArchiveService {
    constructor() {
        this.cache = [];
        this.isSynced = false;
        this.isFetching = false;
    }

    async sync() {
        if (this.isSynced) return this.cache;
        if (this.isFetching) return; 
        
        this.isFetching = true;
        let currentId = 1;
        let maxSearched = false;

        // Loop and fetch folders until we hit a 404
        while (!maxSearched) {
            let folderId = currentId.toString().padStart(4, '0');
            
            // Contextual routing based on config
            let targetUrl = PlatformConfig.environment === 'local' 
                ? `../${folderId}/index.html` 
                : `${PlatformConfig.archiveRoot}/${folderId}/index.html`;

            try {
                let response = await fetch(targetUrl);
                if (response.ok) {
                    let htmlText = await response.text();
                    let record = this._parseHTML(htmlText, folderId);
                    if (record) this.cache.push(record);
                    currentId++;
                } else {
                    maxSearched = true; // 404 hit, stop searching
                }
            } catch (error) {
                console.warn(`[Service] Network halt on record ${folderId}`);
                maxSearched = true;
            }
        }
        
        this.isFetching = false;
        this.isSynced = true;
        return this.cache;
    }

    getRecord(id) {
        return this.cache.find(rec => rec.id === id);
    }

    _parseHTML(htmlString, folderId) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        // Extract basic data. Adjust selectors based on your actual Markdown/HTML structure in the 000X folders
        const titleElement = doc.querySelector('title') || doc.querySelector('h1');
        const title = titleElement ? titleElement.innerText.replace(' | Cadenza Arthouse', '') : `UNKNOWN RECORD ${folderId}`;
        
        const contentBody = doc.querySelector('main') || doc.querySelector('body');
        
        return {
            id: folderId,
            title: title.trim(),
            content: contentBody ? contentBody.innerHTML : '<p class="blink">DATA CORRUPTED</p>'
        };
    }
}

// Instantiate globally so screens can use it
const CAIN_ArchiveService = new ArchiveService();