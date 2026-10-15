(function (root) {
    'use strict';

    const CATEGORIES = ['resources', 'buildings', 'enemies', 'units', 'artifacts', 'spells'];

    function validate(stats) {
        const errors = [];
        if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
            return { ok: false, errors: ['GameStats must be an object'] };
        }

        for (const category of CATEGORIES) {
            const entries = stats[category];
            if (!Array.isArray(entries)) {
                errors.push(category + ' must be an array');
                continue;
            }
            const ids = new Set();
            for (const entry of entries) {
                if (!entry || typeof entry.id !== 'string' || !entry.id) {
                    errors.push(category + ' has an entry without an id');
                } else if (ids.has(entry.id)) {
                    errors.push(category + ' contains duplicate id: ' + entry.id);
                } else {
                    ids.add(entry.id);
                }
            }
        }
        return { ok: errors.length === 0, errors };
    }

    const api = { validate };
    root.OverseerGameData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
