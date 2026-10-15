(function(root) {
    'use strict';
    const STARTER_CARDS = Object.freeze(['reactor', 'factory', 'barracks']);
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
        const id = root.OverseerVNextPreview.placeBuilding(model, type, index);
        if (id === null) return null; // Never spend a card when placement fails.
        hand.cards.splice(at, 1);
        return id;
    }
    const api = { STARTER_CARDS, initialize, cards, play };
    root.OverseerVNextCards = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
