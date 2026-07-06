// CAIN OS — Deployment Configuration Loader
//
// Layer 2 of the CAIN architecture (Core Engine / Deployment / Modules / Interface Pack).
// A Deployment describes BEHAVIOR: brand identity, menu structure, forms, idle
// playlist, QR destinations, and outbound links. It owns none of the visuals —
// that is the Interface Pack's job (js/services/interface-packs.js). The same
// deployment must render correctly under any Interface Pack, and the same
// Interface Pack must skin any deployment without modification. See
// "Deployment Configuration Specification.txt" for the frozen contract.
//
// Selection order for which deployment loads:
//   1. ?deployment=<id> query param (lets a kiosk tablet be pointed at an event
//      just by opening a URL — no code change, no rebuild)
//   2. Last deployment persisted in localStorage
//   3. manifest.json's declared default
//   4. First entry in manifest.json's deployments array
//
// A deployment that fails validation is skipped, exactly like an invalid
// Interface Pack — CAIN OS must never crash because a config file is missing
// or malformed; it should fall back and keep running.

class DeploymentLoader {
    constructor() {
        this.root = 'deployments';
        this.storageKey = 'cain.deployment';
        this.manifest = null;
        this.current = null;
        this.isReady = false;
    }

    async init() {
        if (this.isReady) return this.current;

        const manifest = await this._fetchJson(`${this.root}/manifest.json`);
        if (!manifest || manifest.spec !== '1.0' || !Array.isArray(manifest.deployments) || manifest.deployments.length === 0) {
            console.warn('[Deployment] Manifest missing or invalid — running with no deployment config.');
            this.isReady = true;
            return null;
        }
        this.manifest = manifest;

        const requestedId = this._getRequestedId();
        let deployment = requestedId ? await this._load(requestedId) : null;

        if (!deployment && manifest.default) {
            deployment = await this._load(manifest.default);
        }
        if (!deployment) {
            for (const id of manifest.deployments) {
                deployment = await this._load(id);
                if (deployment) break;
            }
        }

        this.current = deployment;
        if (deployment) {
            localStorage.setItem(this.storageKey, deployment.id);
        } else {
            console.warn('[Deployment] No valid deployment could be loaded.');
        }

        this.isReady = true;
        return this.current;
    }

    // Resolve a deployment-relative asset path (logo, wallpaper, etc.) to a
    // fetchable URL, mirroring the Asset Registry's rules for Interface Packs:
    // no remote URLs, no absolute reach into another deployment's folder.
    asset(relativePath) {
        if (!this.current || !relativePath) return '';
        if (/^(https?:)?\/\//i.test(relativePath) || relativePath.startsWith('data:')) return '';
        return `${this.current._base}/${relativePath}`.replace(/\/+/g, '/');
    }

    getForm(target) {
        return (this.current && this.current.forms && this.current.forms[target]) || null;
    }

    // Resolves a named link. Values starting with http(s) are used as-is;
    // anything else is treated as a path relative to the archive root, which
    // preserves the pre-deployment-config behavior of the "Main Website" /
    // "Press Archive" menu items.
    getLink(target) {
        const value = this.current && this.current.links && this.current.links[target];
        if (!value) return '';
        if (/^https?:\/\//i.test(value)) return value;
        return `${PlatformConfig.archiveRoot}${value}`;
    }

    getQr() {
        return (this.current && this.current.qr) || null;
    }

    getIdlePlaylist() {
        return (this.current && this.current.kiosk && this.current.kiosk.idlePlaylist) || [];
    }

    getIdleTimeoutSeconds() {
        return (this.current && this.current.kiosk && this.current.kiosk.idleTimeoutSeconds) || 60;
    }

    _getRequestedId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('deployment') || localStorage.getItem(this.storageKey);
    }

    async _load(id) {
        if (!id || !this.manifest.deployments.includes(id)) return null;
        const base = `${this.root}/${id}`;
        const config = await this._fetchJson(`${base}/deployment.json`);
        if (!this._isValid(config, id)) return null;
        config._base = base;
        return config;
    }

    _isValid(config, id) {
        if (!config) return false;
        if (config.spec !== '1.0') return false;
        if (config.id !== id) return false;
        if (!config.brand || !Array.isArray(config.menu)) return false;
        return true;
    }

    async _fetchJson(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn(`[Deployment] Could not load ${url}`, error);
            return null;
        }
    }
}

const CAIN_Deployment = new DeploymentLoader();
