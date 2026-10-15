(function (root) {
    'use strict';

    // Data-only ECS with explicit tree ownership. No Phaser objects belong here.
    class World {
        constructor() {
            this.nextId = 1;
            this.entities = new Map();
        }

        create(parent = null) {
            if (parent !== null && !this.entities.has(parent)) throw new Error('Unknown parent: ' + parent);
            const id = this.nextId++;
            this.entities.set(id, { id, parent, children: new Set(), components: new Map() });
            if (parent !== null) this.entities.get(parent).children.add(id);
            return id;
        }

        has(id) { return this.entities.has(id); }

        entity(id) {
            const entity = this.entities.get(id);
            if (!entity) throw new Error('Unknown entity: ' + id);
            return entity;
        }

        set(id, kind, value) {
            if (typeof kind !== 'string' || !kind) throw new Error('Invalid component kind');
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                throw new Error('Components must be plain data objects');
            }
            this.entity(id).components.set(kind, { ...value });
            return this;
        }

        get(id, kind) { return this.entity(id).components.get(kind); }
        hasComponent(id, kind) { return this.entity(id).components.has(kind); }
        remove(id, kind) { return this.entity(id).components.delete(kind); }

        children(id) { return [...this.entity(id).children]; }

        query(...kinds) {
            return [...this.entities.values()]
                .filter(e => kinds.every(k => e.components.has(k)))
                .map(e => e.id);
        }


        // Snapshot only simulation data; parent/child links are reconstructed on load.
        serialize() {
            return {
                nextId: this.nextId,
                entities: [...this.entities.values()].map(entity => ({
                    id: entity.id,
                    parent: entity.parent,
                    components: [...entity.components].map(([kind, value]) =>
                        [kind, JSON.parse(JSON.stringify(value))])
                }))
            };
        }

        static restore(snapshot) {
            if (!snapshot || !Number.isSafeInteger(snapshot.nextId) || snapshot.nextId < 1 ||
                !Array.isArray(snapshot.entities)) throw new Error('Invalid ECS snapshot');
            const world = new World();
            let maxId = 0;
            for (const record of snapshot.entities) {
                if (!record || !Number.isSafeInteger(record.id) || record.id < 1 ||
                    !(record.parent === null || (Number.isSafeInteger(record.parent) && record.parent > 0)) ||
                    !Array.isArray(record.components) || world.entities.has(record.id)) {
                    throw new Error('Invalid ECS entity');
                }
                const components = new Map();
                for (const pair of record.components) {
                    if (!Array.isArray(pair) || pair.length !== 2 ||
                        typeof pair[0] !== 'string' || !pair[0] ||
                        !pair[1] || typeof pair[1] !== 'object' || Array.isArray(pair[1]) ||
                        components.has(pair[0])) throw new Error('Invalid ECS component');
                    // Detach imported values from the snapshot to preserve data-only ownership.
                    components.set(pair[0], JSON.parse(JSON.stringify(pair[1])));
                }
                world.entities.set(record.id, {
                    id: record.id, parent: record.parent, children: new Set(), components
                });
                maxId = Math.max(maxId, record.id);
            }
            if (snapshot.nextId <= maxId) throw new Error('ECS entity counter regressed');
            for (const entity of world.entities.values()) {
                if (entity.parent === null) continue;
                const parent = world.entities.get(entity.parent);
                if (!parent) throw new Error('Missing ECS parent');
                const seen = new Set([entity.id]);
                for (let id = entity.parent; id !== null; id = world.entities.get(id).parent) {
                    if (seen.has(id)) throw new Error('Cyclic ECS ownership');
                    seen.add(id);
                }
                parent.children.add(entity.id);
            }
            world.nextId = snapshot.nextId;
            return world;
        }

        destroy(id) {
            const entity = this.entity(id);
            for (const child of [...entity.children]) this.destroy(child);
            if (entity.parent !== null) this.entity(entity.parent).children.delete(id);
            this.entities.delete(id);
        }
    }

    const api = { World };
    root.OverseerECS = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
