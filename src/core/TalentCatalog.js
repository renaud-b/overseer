// Historical talent topology preserved for the VNext migration.
(function(root){
'use strict';
const trees = {
            foundation: [
                { id: 'root', x: 700, y: 100, cost: 0, unlocked: true },

                // Branche Défense
                { id: 'starter_base_hp', parent: 'root', x: 250, y: 300, cost: 5 },
                { id: 'starter_drone', parent: 'starter_base_hp', x: 250, y: 480, cost: 8 },
                { id: 'starter_guard', parent: 'starter_drone', x: 250, y: 660, cost: 12 },

                // Branche Vision
                { id: 'vision_boost', parent: 'root', x: 550, y: 300, cost: 5 },
                { id: 'resource_node_scanner', parent: 'vision_boost', x: 550, y: 480, cost: 10 },
                { id: 'artifact_scanner', parent: 'resource_node_scanner', x: 550, y: 660, cost: 12 },

                // Branche Economie
                { id: 'starter_economy', parent: 'root', x: 850, y: 300, cost: 5, legacy: true },
                { id: 'extra_scrap', parent: 'starter_economy', x: 850, y: 480, cost: 8, legacy: true },
                { id: 'extra_alloy', parent: 'extra_scrap', x: 850, y: 660, cost: 12, legacy: true },

                // Branche Production VNext : visible, mais non achetable tant que les effets ECS ne sont pas actifs.
                { id: 'production_extraction', parent: 'root', x: 850, y: 300, cost: 5, description: '+20 % de rendement en matière et énergie (proposition).' },
                { id: 'production_components', excludes: ['production_efficiency'], parent: 'production_extraction', x: 800, y: 480, cost: 8, description: '+25 % de production de composants (proposition).' },
                { id: 'production_efficiency', excludes: ['production_components'], parent: 'production_extraction', x: 900, y: 480, cost: 8, description: '-15 % d’intrants sur les conversions industrielles (proposition).' },
                { id: 'production_automation', parent: 'production_extraction', anyPrerequisites: ['production_components', 'production_efficiency'], x: 850, y: 660, cost: 12, description: '+10 % de cadence des bâtiments économiques observés (proposition).' },

                // Branche Technologie
                { id: 'starter_tech', parent: 'root', x: 1150, y: 300, cost: 8 },
                { id: 'starter_spell_building', parent: 'starter_tech', x: 1150, y: 480, cost: 10 },
                { id: 'spell_charge_boost', parent: 'starter_spell_building', x: 1150, y: 660, cost: 15 }
            ],   // Ton arbre actuel (root -> starter_drone etc.)
            architecture: [
                { id: 'root', x: 700, y: 100, cost: 0, unlocked: false },
                { id: 'adjacency_bonus_scrap', parent: 'root', x: 550, y: 300, cost: 6 },
                { id: 'resource_chain_hydronium_alloy', parent: 'adjacency_bonus_scrap', x: 400, y: 500, cost: 8 },
                { id: 'fusion_node_reactor', parent: 'root', x: 850, y: 300, cost: 6 },
                { id: 'bio_cuve_growth', parent: 'fusion_node_reactor', x: 1000, y: 500, cost: 8 },
                { id: 'defense_network_bonus', parent: 'root', x: 700, y: 500, cost: 8 },
                { id: 'xeno_synergy', parent: 'bio_cuve_growth', x: 1200, y: 700, cost: 10 },
                { id: 'temporal_link', parent: 'defense_network_bonus', x: 700, y: 700, cost: 10 },
                { id: 'unit_cap_increase', parent: 'resource_chain_hydronium_alloy', x: 300, y: 700, cost: 10 },
            ],
            evolution: [
                { id: 'root', x: 700, y: 100, cost: 0, unlocked: false },
                { id: 'blood_adaptation', parent: 'root', x: 600, y: 300, cost: 6 },
                { id: 'spiritual_salvage', parent: 'blood_adaptation', x: 600, y: 480, cost: 10 }
            ],
            ascension: [
                { id: 'wave_reward_boost', parent: 'root', x: 800, y: 300, cost: 8 }
            ]
        };
const api = Object.freeze({trees, get(id){return Object.values(trees).flat().find(n=>n.id===id)||null;}, all(){return Object.values(trees).flat();}});
root.OverseerTalentCatalog=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
