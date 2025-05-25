const currentGameStats = {
    "resources": [
        {
            "id": "hydronium",
            "color": "#3cb9fc"
        },
        {
            "id": "scrap",
            "color": "#a0522d"
        },
        {
            "id": "alloy",
            "color": "#aaaaaa"
        },
        {
            "id": "ion_field",
            "color": "#ffff00"
        },
        {
            "id": "compute_units",
            "color": "#00ffff"
        },
        {
            "id": "flux_crystal",
            "color": "#9400d3"
        },
        {
            "id": "bio_gel",
            "color": "#7fff00"
        },
        {
            "id": "xeno_sample",
            "color": "#ff69b4"
        }
    ],
    "buildings": [
        {
            "id": "condensor",
            "produces": "hydronium",
            "rate": 1,
            "producesType": "resource",
            "color": "#3cb9fc",
            "level": 1
        },
        {
            "id": "scrap_mine",
            "produces": "scrap",
            "unlimited": true,
            "rate": 1,
            "max_produced": 10,
            "producesType": "resource",
            "color": "#a0522d",
            "level": 1
        },
        {
            "id": "refinery",
            "produces": "alloy",
            "rate": 1,
            "producesType": "resource",
            "color": "#aaaaaa",
            "level": 1
        },
        {
            "id": "reactor",
            "produces": "ion_field",
            "rate": 1,
            "cost": { "scrap": 20, "alloy": 20 },
            "producesType": "resource",
            "color": "#ffff00",
            "level": 2
        },
        {
            "id": "flux_catalyst",
            "produces": "spell",
            "cooldown": 20000,
            "producesType": "spell",
            "cost": { "hydronium": 5, "scrap": 10 },
            "color": "#9400d3",
            "level": 2
        },
        {
            "id": "drone_bay",
            "cooldown": 5000,
            "produces": "unit_dronoid",
            "producesType": "unit",
            "cost": { "hydronium": 10, "scrap": 20 },
            "consumePerCycle": {
                "scrap": 5
            },
            "unitCap": 3,
            "rate": 1,
            "color": "#00ff00",
            "level": 1
        },
        {
            "id": "decompiler",
            "produces": "scrap",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 6000,
            "consumePerCycle": {
                "hydronium": 2,
                "alloy": 4
            },
            "cost": {
                "compute_units": 2,
                "alloy": 5
            },
            "color": "#a07040",
            "level": 2
        },
        {
            "id": "ion_refinery",
            "produces": "ion_field",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 6000,
            "cost": {
                "hydronium": 20,
                "scrap": 10
            },
            "consumePerCycle": {
                "hydronium": 1,
                "scrap": 1
            },
            "color": "#ffee88",
            "level": 2
        },
        {
            "id": "sniper_tower",
            "cooldown": 6000,
            "produces": "unit_sniper",
            "producesType": "unit",
            "cost": { "hydronium": 5, "alloy": 8, "ion_field": 2 },
            "consumePerCycle": { "alloy": 4, "ion_field": 2 },
            "unitCap": 2,
            "rate": 1,
            "color": "#ff9900",
            "level": 2
        },
        {
            "id": "guard_bunker",
            "produces": "unit_guard",
            "producesType": "unit",
            "cooldown": 6000,
            "rate": 1,
            "unitCap": 3,
            "cost": {
                "scrap": 8,
                "bio_gel": 3,
                "compute_units": 1
            },
            "color": "#1e90ff",
            "level": 3
        },{
            "id": "mecha_forge",
            "produces": "unit_mecha",
            "producesType": "unit",
            "cooldown": 10000,
            "rate": 1,
            "unitCap": 2,
            "cost": {
                "alloy": 10,
                "xeno_sample": 2,
                "compute_units": 3
            },
            "color": "#8b0000",
            "level": 3
        },
        {
            "id": "bio_cuve",
            "name": "Biocuve Alpha",
            "produces": "bio_gel",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 10000,
            "cost": {
                "scrap": 5,
                "hydronium": 5
            },
            "color": "#7fff00",
            "level": 2
        },
        {
            "id": "quantum_compressor",
            "produces": "flux_crystal",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 15000,
            "cost": { "ion_field": 2, "compute_units": 1 },
            "consumePerCycle": { "ion_field": 1 },
            "color": "#dd66ff",
            "level": 3
        },
        {
            "id": "logic_cluster",
            "produces": "compute_units",
            "producesType": "resource",
            "rate": 1,
            "consumePerCycle": {
                "hydronium": 1,
                "alloy": 1
            },
            "cooldown": 8000,
            "cost": {
                "alloy": 5,
                "ion_field": 2
            },
            "color": "#00ffff",
            "level": 2
        },
        {
            "id": "supercluster",
            "produces": "compute_units",
            "producesType": "resource",
            "rate": 2,
            "cooldown": 10000,
            "cost": { "alloy": 10, "ion_field": 3 },
            "consumePerCycle": { "hydronium": 2, "alloy": 2 },
            "color": "#00ffee",
            "level": 3
        },
        {
            "id": "xeno_extractor",
            "produces": "xeno_sample",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 15000,
            "cost": {
                "bio_gel": 2,
                "compute_units": 2
            },
            "color": "#ff69b4",
            "level": 3
        },
        {
            "id": "hydrosmelt_forge",
            "produces": "ion_field",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 8000,
            "cost": { "scrap": 5, "hydronium": 5 },
            "consumePerCycle": { "hydronium": 2, "hydronium_extra": 2 },
            "color": "#ffeedd",
            "level": 1
        },
        {
            "id": "scrap_logic_bridge",
            "produces": "compute_units",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 8000,
            "cost": { "scrap": 10 },
            "consumePerCycle": { "scrap": 2, "scrap_extra": 2 },
            "color": "#ccffaa",
            "level": 1
        },
        {
            "id": "bio_distiller",
            "produces": "bio_gel",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 10000,
            "cost": { "scrap": 5, "hydronium": 5 },
            "consumePerCycle": { "scrap": 2, "hydronium": 1 },
            "color": "#aaffaa",
            "level": 1
        },
        {
            "id": "hydro_computer_pylon",
            "produces": "compute_units",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 7000,
            "cost": { "hydronium": 10 },
            "consumePerCycle": { "hydronium": 2 },
            "color": "#00dddd",
            "level": 2
        },
        {
            "id": "gel_injector",
            "produces": "xeno_sample",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 12000,
            "cost": { "bio_gel": 5 },
            "consumePerCycle": { "bio_gel": 2 },
            "color": "#ff99dd",
            "level": 2
        },
        {
            "id": "xeno_biocompressor",
            "produces": "flux_crystal",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 15000,
            "cost": { "bio_gel": 4, "compute_units": 3 },
            "consumePerCycle": { "bio_gel": 2, "bio_gel_extra": 2 },
            "color": "#ff44cc",
            "level": 3
        },
        {
            "id": "auto_compiler",
            "produces": "compute_units",
            "producesType": "resource",
            "rate": 1,
            "cooldown": 20000,
            "cost": { "alloy": 10, "flux_crystal": 1 },
            "consumePerCycle": {},
            "color": "#ccffff",
            "level": 3
        }
    ],
    "enemies": [
        {
            "id": "basic_monster",
            "level": 1,
            "role": "Attaque",
            "hp": 3,
            "speed": 30,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 2.0,
            "attack_damage": 1
        },
        {
            "id": "ranged_monster",
            "level": 2,
            "role": "Attaque",
            "hp": 3,
            "speed": 30,
            "attack_type": "ranged",
            "attack_range": 100,
            "attack_speed": 2.0,
            "attack_damage": 1
        },
        {
            "id": "base_rusher",
            "level": 2,
            "role": "Percuteur",
            "hp": 12,
            "speed": 45,
            "attack_type": "melee",
            "attack_range": 30,
            "attack_speed": 1.0,
            "attack_damage": 5,
            "behavior": "base_rusher"
        },
        {
            "id": "stalker",
            "level": 3,
            "role": "assassin",
            "hp": 3,
            "speed": 40,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 1.2,
            "attack_damage": 4,
            "behavior": "invisible_until_hit"
        },
        {
            "id": "mother_slime",
            "level": 3,
            "role": "fission",
            "hp": 8,
            "speed": 30,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 1.2,
            "attack_damage": 2,
            "behavior": "split_on_death",
            "split_spawn": "baby_slime",
            "split_count": 2
        },
        {
            "id": "baby_slime",
            "level": 1,
            "role": "parasite",
            "hp": 2,
            "speed": 35,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 1.0,
            "attack_damage": 1
        }
    ],
    "units": [
        {
            "id": "unit_dronoid",
            "sprite": "droneSprite",
            "desc": "Unité de support.",
            "hp": 4,
            "speed": 40,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 1.5,
            "attack_damage": 2,
            "cost": { "hydronium": 3, "alloy": 2 }
        },
        {
            "id": "unit_guard",
            "role": "défense",
            "hp": 7,
            "speed": 35,
            "attack_type": "melee",
            "attack_range": 20,
            "attack_speed": 1.0,
            "attack_damage": 2,
            "cost": {
                "scrap": 8,
                "bio_gel": 3,
                "compute_units": 1
            }
        },
        {
            "id": "unit_mecha",
            "role": "tank",
            "hp": 13,
            "speed": 25,
            "attack_type": "melee",
            "attack_range": 25,
            "attack_speed": 2.0,
            "attack_damage": 3,

            "cost": {
                "alloy": 10,
                "bio_gel": 5,
                "compute_units": 3
            }
        },
        {
            "id": "unit_sniper",
            "role": "tir à distance",
            "hp": 3,
            "speed": 30,
            "attack_type": "ranged",
            "attack_range": 120,
            "attack_speed": 2.5,
            "attack_damage": 3,
            "cost": { "alloy": 4, "ion_field": 2 }
        }
    ],
    "artifacts": [
        {
            "id": "heal_on_ally_death",
            "effect": "heal_random_on_death"
        },
        {
            "id": "explode_on_ally_death",
            "effect": "damage_enemy_on_death"
        },
        {
            "id": "heal_base_on_ally_death",
            "effect": "heal_base_on_death"
        },
        {
            "id": "condensor_boost",
            "effect": "boost_condensor"
        },
        {
            "id": "boost_decompiler",
            "effect": "boost_decompiler"
        },
        {
            "id": "refinery_boost",
            "effect": "boost_refinery"
        },
        {
            "id": "xeno_sample_periodic",
            "effect": "periodic_xeno"
        }
    ],
    "spells": [
        {
            "id": "emp_blast",
            "color": "#00ffff",
            "cooldown": 8000,
            "radius": 100,
            "effect": "stun",
            "duration": 2000
        },
        {
            "id": "ion_storm",
            "color": "#ffff00",
            "cooldown": 6000,
            "radius": 100,
            "effect": "damage",
            "amount": 2
        },
        {
            "id": "pulse_heal",
            "color": "#00ff00",
            "cooldown": 5000,
            "radius": 100,
            "effect": "heal",
            "amount": 2
        },
        {
            "id": "regen_field",
            "color": "#00ff00",
            "cooldown": 10000,
            "radius": 120,
            "duration": 10000,
            "tickInterval": 1000,
            "effect": "persistent_heal"
        }
    ]
}

function GetGameStats() {
    return currentGameStats;
}