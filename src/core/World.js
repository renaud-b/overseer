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
