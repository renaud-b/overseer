(function (root) {
    'use strict';

    // Descriptive catalog only. A building's presence here does not mean its
    // mechanics, construction cost or production recipe have been implemented.
    const BUILDINGS = Object.freeze([
        { id: 'reactor', label: 'Réacteur', group: 'economy', color: 0x35d8ef, description: 'Produit de l’énergie.', status: 'prototype' },
        { id: 'extractor', label: 'Extracteur', group: 'economy', color: 0x39dd92, description: 'Extrait de la matière brute.', status: 'prototype' },
        { id: 'factory', label: 'Fabrique', group: 'economy', color: 0xf4ba58, description: 'Transforme des intrants en composants.', status: 'prototype' },
        { id: 'compute_node', label: 'Nœud de calcul', group: 'economy', color: 0xb58aff, description: 'Transforme énergie, matière et composants en données.', status: 'prototype' },
        { id: 'cryopump', label: 'Cryopompe', group: 'economy', color: 0x87b9e8, description: 'Refroidit ses huit cases voisines sous vision et donne des bonus de cadence.', status: 'prototype' },
        { id: 'barracks', label: 'Caserne', group: 'military', color: 0x62e7e1, description: 'Fabrique des unités de base autonomes.', status: 'planned' },
        { id: 'ballistics', label: 'Centre balistique', group: 'military', color: 0xe3bd6a, description: 'Fabrique des tireurs à distance.', status: 'planned' },
        { id: 'armor_forge', label: 'Forge blindée', group: 'military', color: 0x5fa8e6, description: 'Fabrique des unités résistantes.', status: 'planned' },
        { id: 'medical_center', label: 'Centre médical', group: 'military', color: 0x69d9a0, description: 'Fabrique des unités soigneuses.', status: 'planned' },
        { id: 'laboratory', label: 'Laboratoire', group: 'support', color: 0xb58aff, description: 'Destiné aux données et aux protocoles.', status: 'planned' },
        { id: 'maintenance', label: 'Centre de maintenance', group: 'support', color: 0xf4ba58, description: 'Destiné à réparer la base.', status: 'planned' },
        { id: 'perception_amplifier', label: 'Amplificateur de perception', group: 'support', color: 0x91ced1, description: 'Émet une onde radar qui traverse le champ de bataille et marque les ennemis.', status: 'prototype' },
        { id: 'bastion', label: 'Bastion', group: 'tactical', color: 0x5fa8e6, description: 'Destiné à protéger la base.', status: 'planned' },
        { id: 'attention_relay', label: 'Relais d’attention', group: 'tactical', color: 0xaa8cf6, description: 'Transmettrait l’activation aux voisins ; portée liée au refroidissement.', status: 'planned' }
    ].map(building => Object.freeze(building)));
    const byId = new Map(BUILDINGS.map(building => [building.id, building]));
    function getBuilding(id) { return byId.get(id) || null; }
    const api = Object.freeze({ BUILDINGS, getBuilding });
    root.OverseerVNextBuildings = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
