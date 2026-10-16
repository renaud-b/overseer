(function(root) {
    'use strict';
    const STARTER_CARDS = Object.freeze(['reactor', 'extractor', 'factory', 'barracks']);
    function initialize(model) {
        if (!model.world.hasComponent(model.game, 'BuildingHand')) {
            model.world.set(model.game, 'BuildingHand', { cards: [...STARTER_CARDS] });
        }
        return model.world.get(model.game, 'BuildingHand');
    }
    function cards(model) { return [...initialize(model).cards]; }
    function play(model, type, index) {
        const hand = initialize(model);
        const at = hand.cards.indexOf(type);
        if (at === -1) return null;
        const preview = root.OverseerVNextPreview || (typeof require === 'function' ? require('./VNextPreview.js') : null);
        const id = preview.placeBuilding(model, type, index);
        if (id === null) return null; // Never spend a card when placement fails.
        hand.cards.splice(at, 1);
        return id;
    }
    // Rewards grant one new one-shot card, even if the hand has another of that type.
    const REWARD_CARDS = Object.freeze([...STARTER_CARDS, 'ballistics', 'armor_forge', 'medical_center', 'laboratory', 'compute_node', 'perception_amplifier', 'cryopump', 'maintenance']);
    function grant(model, type) {
        if (!REWARD_CARDS.includes(type)) return false;
        initialize(model).cards.push(type);
        return true;
    }
    const api = { STARTER_CARDS, REWARD_CARDS, initialize, cards, play, grant };
    root.OverseerVNextCards = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
