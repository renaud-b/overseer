// Presentation preferences are deliberately separate from ECS and run saves.
const OverseerGameSettings = {
    languages: ['fr', 'en', 'es', 'jp'],
    layouts: ['azerty', 'qwerty'],
    read(storage) {
        const get = (key, fallback) => {
            try { return storage?.getItem(key) || fallback; } catch (_) { return fallback; }
        };
        return {
            language: get('selectedLanguage', window.selectedLanguage || 'en'),
            layout: get('keyboardLayout', window.keyboardLayout || 'qwerty')
        };
    },
    set(storage, key, value) {
        const definitions = {
            language: ['selectedLanguage', this.languages],
            layout: ['keyboardLayout', this.layouts]
        };
        const definition = definitions[key];
        if (!definition || !definition[1].includes(value)) return false;
        try { storage?.setItem(definition[0], String(value)); }
        catch (_) { return false; }
        if (key === 'language') window.selectedLanguage = value;
        if (key === 'layout') window.keyboardLayout = value;
        return true;
    },
    remove(storage, keys) {
        try { for (const key of keys) storage?.removeItem(key); return true; }
        catch (_) { return false; }
    }
};

class OverseerOptionsModal {
    constructor(scene, onClose = () => {}) {
        this.scene = scene;
        this.onClose = onClose;
        this.objects = [];
        this.confirm = null;
        this.closed = false;
    }
    storage() {
        try { return typeof localStorage === 'undefined' ? null : localStorage; }
        catch (_) { return null; }
    }
    keep(object) { this.objects.push(object); return object; }
    clear() { this.objects.forEach(object => object.destroy()); this.objects = []; }
    text(x, y, value, size = 13, color = '#dfeaf0', depth = 502) {
        return this.keep(this.scene.add.text(x, y, value, {
            fontFamily: 'monospace', fontSize: size + 'px', color,
            wordWrap: { width: Math.max(180, this.width - 42) }
        }).setDepth(depth));
    }
    action(x, y, label, callback, color = '#62e7e1', depth = 503) {
        const button = this.keep(this.scene.add.text(x, y, label, {
            fontFamily: 'monospace', fontSize: '12px', color
        }).setDepth(depth).setInteractive({ useHandCursor: true }));
        button.on('pointerdown', callback);
        return button;
    }
    open() {
        this.render();
        this.resize = () => this.render();
        this.scene.scale.on('resize', this.resize);
    }
    render() {
        if (this.closed) return;
        this.clear();
        const { width: w, height: h } = this.scene.scale;
        this.width = Math.min(520, w - 30);
        const x = (w - this.width) / 2, top = Math.max(12, (h - 410) / 2);
        const g = this.keep(this.scene.add.graphics().setDepth(500));
        // Transparent hit-shield: keep the menu or battle visible behind the panel.
        this.keep(this.scene.add.zone(w / 2, h / 2, w, h).setInteractive().setDepth(501));
        g.fillStyle(0x0b1d2b, 1).fillRoundedRect(x, top, this.width, 410, 8);
        g.lineStyle(1, 0x346274, 0.9).strokeRoundedRect(x, top, this.width, 410, 8);
        const left = x + 22, right = x + this.width - 150;
        this.text(left, top + 17, 'OVERSEER / CONFIGURATION', 11, '#62e7e1');
        this.action(x + this.width - 37, top + 17, '×', () => this.close());
        this.text(left, top + 48, 'OPTIONS', 23);
        const settings = OverseerGameSettings.read(this.storage());
        this.text(left, top + 98, 'INTERFACE', 13, '#62e7e1');
        this.text(left, top + 129, 'Langue', 12);
        this.action(right, top + 129, settings.language.toUpperCase() + '  ›', () => {
            const next = OverseerGameSettings.languages;
            OverseerGameSettings.set(this.storage(), 'language',
                next[(next.indexOf(settings.language) + 1) % next.length]);
            this.render();
        });
        this.text(left, top + 166, 'Clavier', 12);
        this.action(right, top + 166, settings.layout.toUpperCase() + '  ›', () => {
            OverseerGameSettings.set(this.storage(), 'layout',
                settings.layout === 'azerty' ? 'qwerty' : 'azerty');
            this.render();
        });
        this.text(left, top + 214, 'DONNÉES LOCALES', 13, '#62e7e1');
        this.action(left, top + 250, 'EFFACER LA PARTIE', () => this.ask('save'), '#ff8a91');
        this.action(left, top + 286, 'EFFACER LA PROGRESSION', () => this.ask('progress'), '#ff8a91');
        this.text(left, top + 326, 'Chaque suppression demande une confirmation.', 10, '#8daabb');
        this.action(left, top + 371, '← RETOUR', () => this.close());
        if (this.confirm) {
            const type = this.confirm;
            // Separate high-depth overlay: the confirmation must intercept events
            // before the parent options buttons and its full-screen hit shield.
            const overlay = this.keep(this.scene.add.graphics().setDepth(510));
            overlay.fillStyle(0x08121c, 0.38).fillRect(0, 0, w, h);
            this.keep(this.scene.add.zone(w / 2, h / 2, w, h)
                .setInteractive().setDepth(511));
            const cy = Math.max(15, (h - 210) / 2);
            overlay.fillStyle(0x091923, 1)
                .fillRoundedRect(x + 10, cy, this.width - 20, 210, 6);
            overlay.lineStyle(1, 0xff6674)
                .strokeRoundedRect(x + 10, cy, this.width - 20, 210, 6);
            this.text(left, cy + 20, 'CONFIRMER LA SUPPRESSION ?', 15, '#ff8a91', 512);
            this.text(left, cy + 62, type === 'save' ?
                'La partie en cours sera perdue.' :
                'Les talents et éclats seront effacés.\\nLa partie en cours sera terminée.', 11, '#dfeaf0', 512);
            this.action(left, cy + 153, 'ANNULER',
                () => { this.confirm = null; this.render(); }, '#62e7e1', 513);
            this.action(right, cy + 153, 'CONFIRMER',
                () => this.erase(type), '#ff8a91', 513);
        }
    }
    ask(type) { this.confirm = type; this.render(); }
    erase(type) {
        const storage = this.storage();
        const keys = type === 'save' ? ['overseer.vnext.save'] :
            ['memoryShards', 'unlockedTalents', 'overseer.vnext.save'];
        if (!OverseerGameSettings.remove(storage, keys)) return;
        this.confirm = null;
        this.close();
        // Never leave an in-memory run playable after erasing its persistence.
        if (this.scene.sys?.settings?.key === 'VNextScene' || this.scene.scene?.key === 'VNextScene') {
            this.scene.runFinished = true;
            this.scene.scene.start('MainMenuScene');
        } else this.scene.drawMenu?.();
    }
    close(silent = false) {
        if (this.closed) return;
        this.closed = true;
        this.scene.scale.off('resize', this.resize);
        this.clear();
        if (!silent) this.onClose();
    }
}
