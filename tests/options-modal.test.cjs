'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/scene/OptionsModal.js'), 'utf8');
const storageData = new Map([['overseer.vnext.save', 'run'], ['memoryShards', '8'], ['unlockedTalents', '["root"]']]);
const storage = {
    getItem: key => storageData.get(key) ?? null,
    setItem: (key, value) => storageData.set(key, value),
    removeItem: key => storageData.delete(key)
};
const { Modal, Settings } = vm.runInNewContext(
    source + '\n({ Modal: OverseerOptionsModal, Settings: OverseerGameSettings });',
    { window: { keyboardLayout: 'azerty', selectedLanguage: 'fr' }, localStorage: storage }
);
class Display {
    constructor() { this.handlers = {}; }
    setDepth(depth) { this.depth = depth; return this; }
    setInteractive() { return this; }
    on(event, callback) { this.handlers[event] = callback; return this; }
    destroy() {}
    fillStyle() { return this; }
    fillRect() { return this; }
    fillRoundedRect() { return this; }
    lineStyle() { return this; }
    strokeRoundedRect() { return this; }
}
function scene() {
    return {
        scale: { width: 1366, height: 768, on() {}, off() {} },
        scene: { key: 'MainMenuScene' },
        add: {
            graphics: () => new Display(),
            zone: () => new Display(),
            text: (_x, _y, label) => Object.assign(new Display(), { label })
        }
    };
}
function button(modal, label) {
    return modal.objects.find(object => object.label === label && object.handlers.pointerdown);
}
test('options has a transparent backdrop and no animation control', () => {
    assert.doesNotMatch(source, /0x08121c, 0\.92/);
    const modal = new Modal(scene());
    modal.open();
    assert.equal(button(modal, 'EFFACER LA PARTIE') !== undefined, true);
    assert.equal(modal.objects.some(object => /animations du menu/.test(object.label || '')), false);
});
test('confirmation sits above the main modal and cancel keeps data', () => {
    const modal = new Modal(scene());
    modal.open();
    button(modal, 'EFFACER LA PARTIE').handlers.pointerdown();
    assert.equal(modal.confirm, 'save');
    assert.equal(button(modal, 'CONFIRMER').depth, 513);
    assert.ok(modal.objects.some(object => object.depth === 511));
    button(modal, 'ANNULER').handlers.pointerdown();
    assert.equal(modal.confirm, null);
    assert.equal(storage.getItem('overseer.vnext.save'), 'run');
});
test('confirmed save removal keeps progress and confirmed progress reset clears both', () => {
    const modal = new Modal(scene());
    modal.open();
    button(modal, 'EFFACER LA PARTIE').handlers.pointerdown();
    button(modal, 'CONFIRMER').handlers.pointerdown();
    assert.equal(storage.getItem('overseer.vnext.save'), null);
    assert.equal(storage.getItem('memoryShards'), '8');
    storage.setItem('overseer.vnext.save', 'run2');
    const other = new Modal(scene());
    other.open();
    button(other, 'EFFACER LA PROGRESSION').handlers.pointerdown();
    button(other, 'CONFIRMER').handlers.pointerdown();
    assert.equal(storage.getItem('memoryShards'), null);
    assert.equal(storage.getItem('unlockedTalents'), null);
    assert.equal(storage.getItem('overseer.vnext.save'), null);
});
