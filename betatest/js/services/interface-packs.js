class LayoutEngine {
    constructor() {
        this.currentLayout = 'terminal-classic';
        this.supportedLayouts = new Set([
            'terminal-classic',
            'modern-panels',
            'broadcast',
            'accessibility'
        ]);
    }

    load(layoutName) {
        const nextLayout = this.supportedLayouts.has(layoutName) ? layoutName : 'terminal-classic';
        document.body.classList.remove(`layout-${this.currentLayout}`);
        this.currentLayout = nextLayout;
        document.body.classList.add(`layout-${this.currentLayout}`);
        return this.currentLayout;
    }
}

class AnimationProfileManager {
    constructor() {
        this.currentProfile = 'crt-flicker';
        this.supportedProfiles = new Set([
            'none',
            'instant',
            'fade',
            'crt-flicker',
            'slide',
            'pixel-pop'
        ]);
    }

    use(profileName) {
        const nextProfile = this.supportedProfiles.has(profileName) ? profileName : 'instant';
        document.body.classList.remove(`animation-${this.currentProfile}`);
        this.currentProfile = nextProfile;
        document.body.classList.add(`animation-${this.currentProfile}`);
        return this.currentProfile;
    }
}

class AssetRegistry {
    constructor() {
        this.assets = {};
        this.packBase = '';
    }

    register(pack, packBase) {
        this.assets = pack.assets || {};
        this.packBase = packBase;
    }

    get(key) {
        const value = this.assets[key];
        if (!value) return '';
        if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return '';
        return `${this.packBase}/${value}`.replace(/\/+/g, '/');
    }
}

class ThemeManager {
    constructor(stylesheetId, layoutEngine, animationManager, assetRegistry) {
        this.stylesheet = document.getElementById(stylesheetId);
        this.layoutEngine = layoutEngine;
        this.animationManager = animationManager;
        this.assetRegistry = assetRegistry;
        this.activePack = null;
    }

    applyTheme(pack, packBase) {
        if (!pack || !pack.entry || !pack.entry.css) return;

        this.activePack = pack;
        this.layoutEngine.load(pack.layout);
        this.animationManager.use(pack.animationProfile);
        this.assetRegistry.register(pack, packBase);

        document.body.dataset.interfacePack = pack.id;
        document.body.dataset.interfacePackUuid = pack.uuid;
        document.body.classList.remove(...Array.from(document.body.classList).filter(name => name.startsWith('pack-')));
        document.body.classList.add(`pack-${pack.id}`);

        this.stylesheet.href = `${packBase}/${pack.entry.css}`;
    }

    removeTheme() {
        this.activePack = null;
        this.stylesheet.href = '';
        delete document.body.dataset.interfacePack;
        delete document.body.dataset.interfacePackUuid;
    }

    currentTheme() {
        return this.activePack;
    }

    reloadTheme(packBase) {
        if (!this.activePack) return;
        this.applyTheme(this.activePack, packBase);
    }
}

class InterfacePackLoader {
    constructor(themeManager) {
        this.themeManager = themeManager;
        this.root = PlatformConfig.interfacePackRoot || 'interface-packs';
        this.storageKey = 'cain.interfacePack';
        this.packs = [];
        this.packBases = new Map();
        this.isReady = false;
    }

    async init() {
        if (this.isReady) return this.packs;

        const manifest = await this._fetchJson(`${this.root}/manifest.json`);
        if (!manifest || manifest.spec !== PlatformConfig.interfacePackSpec || !Array.isArray(manifest.packs)) {
            console.warn('[InterfacePacks] Manifest missing or incompatible.');
            this.isReady = true;
            return this.packs;
        }

        for (const folder of manifest.packs) {
            const packBase = `${this.root}/${folder}`;
            const pack = await this._fetchJson(`${packBase}/pack.json`);
            if (this._isValidPack(pack, folder)) {
                this.packs.push(pack);
                this.packBases.set(pack.uuid, packBase);
            }
        }

        const selectedPack = this.getSavedPack() || this.packs[0];
        if (selectedPack) this.applyPack(selectedPack.uuid);

        this.isReady = true;
        return this.packs;
    }

    getPacks() {
        return this.packs.slice();
    }

    getSavedPack() {
        const savedUuid = localStorage.getItem(this.storageKey);
        if (!savedUuid) return null;
        return this.packs.find(pack => pack.uuid === savedUuid) || null;
    }

    getPackByUuid(uuid) {
        return this.packs.find(pack => pack.uuid === uuid) || null;
    }

    getPackAsset(uuid, key) {
        const pack = this.getPackByUuid(uuid);
        if (!pack || !pack.assets || !pack.assets[key]) return '';
        const value = pack.assets[key];
        if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return '';
        const packBase = this.packBases.get(uuid);
        return `${packBase}/${value}`.replace(/\/+/g, '/');
    }

    applyPack(uuid) {
        const pack = this.getPackByUuid(uuid);
        if (!pack) return false;

        const packBase = this.packBases.get(pack.uuid);
        this.themeManager.applyTheme(pack, packBase);
        localStorage.setItem(this.storageKey, pack.uuid);
        localStorage.setItem(`${this.storageKey}.id`, pack.id);
        return true;
    }

    async _fetchJson(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn(`[InterfacePacks] Could not load ${url}`, error);
            return null;
        }
    }

    _isValidPack(pack, folder) {
        if (!pack) return false;
        if (pack.spec !== PlatformConfig.interfacePackSpec) return false;
        if (!pack.id || pack.id !== folder) return false;
        if (!this._isUuid(pack.uuid)) return false;
        if (!pack.name || !pack.packVersion || !pack.minimumOS || !pack.maximumOS) return false;
        if (!pack.entry || !pack.entry.css) return false;
        if (!this._isCompatible(pack)) return false;
        return true;
    }

    _isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    _isCompatible(pack) {
        const osMajor = PlatformConfig.osVersion.split('.')[0];
        if (pack.maximumOS.endsWith('.x')) {
            return pack.maximumOS.split('.')[0] === osMajor;
        }
        return true;
    }
}

const CAIN_LayoutEngine = new LayoutEngine();
const CAIN_AnimationProfiles = new AnimationProfileManager();
const CAIN_Assets = new AssetRegistry();
const CAIN_ThemeManager = new ThemeManager(
    'cain-interface-pack-css',
    CAIN_LayoutEngine,
    CAIN_AnimationProfiles,
    CAIN_Assets
);
const CAIN_InterfacePacks = new InterfacePackLoader(CAIN_ThemeManager);
