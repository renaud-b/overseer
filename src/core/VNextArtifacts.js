(function(root) {
    'use strict';
    // Run-only inventory. Passive effects are implemented separately from this collection UI.
    const CAPACITY = 6;
    const CATALOG = Object.freeze([
        { id: 'echo', label: 'Écho de conscience', symbol: 'orbit', color: 0xb58aff,
          description: 'Toutes les 20 s, un bâtiment hors vision produit une fois si les ressources et capacités le permettent.' },
        { id: 'spontaneous', label: 'Génération spontanée', symbol: 'triangle', color: 0xf4ba58,
          description: 'Au début de chaque vague, 10 % de chance de produire gratuitement une unité d’un bâtiment militaire disponible.' },
        { id: 'core_laser', label: 'Jugement du noyau', symbol: 'cross', color: 0x62e7e1,
          description: 'Toutes les 15 s, le noyau tire sur un ennemi dans son rayon de détection (3 dégâts).' },
        { id: 'lingering', label: 'Mémoire résiduelle', symbol: 'orbit', color: 0xb58aff,
          description: 'Un bâtiment continue à fonctionner 3 s après être sorti de la vision.' },
        { id: 'shield', label: 'Instinct de conservation', symbol: 'diamond', color: 0x69d9a0,
          description: 'Une fois par vague, le noyau active un bouclier de 15 PV quand sa vie descend sous 30.' },
        { id: 'death_burst', label: 'Dernière instruction', symbol: 'triangle', color: 0xff6674,
          description: 'Une unité alliée détruite inflige 2 dégâts aux ennemis proches (rayon 80).' },
        { id: 'recovery', label: 'Protocole de récupération', symbol: 'cross', color: 0x69d9a0,
          description: 'Après une vague où le noyau a perdu de la vie, il récupère jusqu’à 5 PV.' },
        { id: 'duplicate', label: 'Parallélisme quantique', symbol: 'diamond', color: 0xf4ba58,
          description: 'Toutes les 30 s, la prochaine production industrielle accorde un second résultat gratuit.' },
        { id: 'hyperfocus', label: 'Hyperfocalisation', symbol: 'orbit', color: 0xb58aff,
          description: 'Si un seul bâtiment productif est observé, son cycle est accéléré de 40 % (recherche comprise).' },
        { id: 'recycle', label: 'Recyclage neuronal', symbol: 'diamond', color: 0x69d9a0,
          description: 'À la mort d’une unité fabriquée, récupère 25 % des ressources réellement dépensées.' },
        { id: 'mark_chain', label: 'Propagation de conscience', symbol: 'cross', color: 0xff6674,
          description: 'À la mort d’un ennemi marqué, transfère la marque à l’ennemi vivant le plus proche pour 2 s.' },
        { id: 'terminal_overload', label: 'Surcharge terminale', symbol: 'cross', color: 0x62e7e1,
          description: 'Nécessite Jugement du noyau : si son laser tue un ennemi, il touche jusqu’à 2 voisins proches (2 dégâts, rayon 110).' },
        { id: 'parasite_network', label: 'Réseau parasitaire', symbol: 'orbit', color: 0xb58aff,
          description: 'À chaque production observée, un bâtiment voisin hors vision gagne 20 % d’avancement sur son cycle.' },
        { id: 'vital_transfer', label: 'Transfert vital', symbol: 'diamond', color: 0x69d9a0,
          description: 'À la mort d’un allié, l’allié vivant blessé le plus proche récupère 30 % de ses PV maximaux.' },
        { id: 'defense_directive', label: 'Directive de protection', symbol: 'diamond', color: 0x62e7e1,
          description: 'Lorsque le noyau est attaqué, les alliés proches ciblent prioritairement son agresseur pendant 3 s.' },
        { id: 'defective', label: 'Production défectueuse', symbol: 'triangle', color: 0xf4ba58,
          description: 'Une unité militaire fabriquée sur cinq inflige 50 % de dégâts supplémentaires, mais perd 25 % de PV max.' },
        { id: 'corrosion', label: 'Contamination synthétique', symbol: 'orbit', color: 0x91bb70,
          description: 'À chaque mort ennemie, 30 % de chance de laisser pendant 4 s une zone corrosive (rayon 65), infligeant 1 dégât par seconde.' },
        { id: 'anticipation', label: 'Anticipation algorithmique', symbol: 'triangle', color: 0xf4ba58,
          description: 'Pendant les 5 premières secondes d’une vague, les bâtiments militaires observés fabriquent 2× plus vite.' },
        { id: 'distributed', label: 'Système distribué', symbol: 'orbit', color: 0xb58aff,
          description: 'Active un bâtiment immédiatement à la périphérie de la vision pendant 20 s, puis en choisit un autre au hasard.' },
        { id: 'evolution', label: 'Instinct d’évolution', symbol: 'diamond', color: 0x69d9a0,
          description: 'Après une vague sans dégâts au noyau, une unité alliée gagne +1 PV max (maximum +5 par unité).' },
        { id: 'pristine_repair', label: 'Intégrité préservée', symbol: 'diamond', color: 0x69d9a0,
          description: 'Après chaque vague remportée sans dégâts réels au noyau, restaure jusqu’à 5 PV (max. 100).' }
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
    function offerable(model) {
        // A full inventory can still draw new artifacts to consider for replacement.
        const owned = new Set(list(model));
        return IDS.filter(id => !owned.has(id) &&
            (id !== 'terminal_overload' || owned.has('core_laser')));
    }
    function available(model) { return hasCapacity(model) ? offerable(model) : []; }
    function hasCapacity(model) { return collection(model).ids.length < CAPACITY; }
    function add(model, id) {
        if (!get(id) || !hasCapacity(model) || collection(model).ids.includes(id)) return false;
        collection(model).ids.push(id);
        return true;
    }
    function canReplace(model, index, incoming) {
        const ids = collection(model).ids;
        if (ids.length !== CAPACITY || !Number.isInteger(index) ||
            index < 0 || index >= ids.length || !get(incoming) || ids.includes(incoming)) return false;
        // Surcharge terminale requires Jugement du noyau: never leave a dead passive.
        const next = ids.map((id, i) => i === index ? incoming : id);
        return !next.includes('terminal_overload') || next.includes('core_laser');
    }
    function replace(model, index, incoming) {
        if (!canReplace(model,index,incoming)) return false;
        collection(model).ids[index]=incoming;
        return true;
    }
    function valid(ids) {
        return Array.isArray(ids) && ids.length <= CAPACITY &&
            new Set(ids).size === ids.length && ids.every(id => IDS.includes(id));
    }
    const api = { CAPACITY, CATALOG, IDS, get, collection, list, offerable, available,
        hasCapacity, add, canReplace, replace, valid };
    root.OverseerVNextArtifacts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
