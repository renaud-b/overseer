(function(root) {
    'use strict';
    // Run-only inventory. Passive effects are implemented separately from this collection UI.
    const CAPACITY = 6;
    const CATALOG = Object.freeze([
        { id: 'echo', label: 'Écho de conscience', symbol: 'orbit', color: 0xb58aff,
          description: 'Un bâtiment hors vision termine périodiquement un cycle.' },
        { id: 'spontaneous', label: 'Génération spontanée', symbol: 'triangle', color: 0xf4ba58,
          description: 'Au début d’une vague, une unité alliée peut apparaître gratuitement.' },
        { id: 'core_laser', label: 'Jugement du noyau', symbol: 'cross', color: 0x62e7e1,
          description: 'Le noyau tire occasionnellement sur un ennemi détecté.' },
        { id: 'lingering', label: 'Mémoire résiduelle', symbol: 'orbit', color: 0xb58aff,
          description: 'Un bâtiment continue brièvement à fonctionner hors vision.' },
        { id: 'shield', label: 'Instinct de conservation', symbol: 'diamond', color: 0x69d9a0,
          description: 'Un bouclier protège le noyau lorsqu’il devient vulnérable.' },
        { id: 'death_burst', label: 'Dernière instruction', symbol: 'triangle', color: 0xff6674,
          description: 'Une unité alliée détruite inflige des dégâts aux ennemis proches.' },
        { id: 'recovery', label: 'Protocole de récupération', symbol: 'cross', color: 0x69d9a0,
          description: 'Le noyau peut récupérer de la vie après une vague.' },
        { id: 'duplicate', label: 'Parallélisme quantique', symbol: 'diamond', color: 0xf4ba58,
          description: 'Certaines productions accordent un résultat supplémentaire.' }
    ].map(entry => Object.freeze(entry)));
    const IDS = Object.freeze(CATALOG.map(entry => entry.id));
    function get(id) { return CATALOG.find(artifact => artifact.id === id) || null; }
    function collection(model) {
        const world = model.world;
        if (!world.hasComponent(model.game, 'ArtifactCollection')) {
            world.set(model.game, 'ArtifactCollection', { ids: [] });
        }
        return world.get(model.game, 'ArtifactCollection');
    }
    function list(model) { return [...collection(model).ids]; }
    function available(model) {
        const owned = new Set(list(model));
        return IDS.filter(id => !owned.has(id));
    }
    function hasCapacity(model) { return collection(model).ids.length < CAPACITY; }
    function add(model, id) {
        if (!get(id) || !hasCapacity(model) || collection(model).ids.includes(id)) return false;
        collection(model).ids.push(id);
        return true;
    }
    function valid(ids) {
        return Array.isArray(ids) && ids.length <= CAPACITY &&
            new Set(ids).size === ids.length && ids.every(id => IDS.includes(id));
    }
    const api = { CAPACITY, CATALOG, IDS, get, collection, list, available, hasCapacity, add, valid };
    root.OverseerVNextArtifacts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
