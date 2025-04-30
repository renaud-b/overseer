class OverseerCoreScene extends Phaser.Scene {
    constructor() {
        super('OverseerCoreScene');
        this.talentTrees = {
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
                { id: 'starter_economy', parent: 'root', x: 850, y: 300, cost: 5 },
                { id: 'extra_scrap', parent: 'starter_economy', x: 850, y: 480, cost: 8 },
                { id: 'extra_alloy', parent: 'extra_scrap', x: 850, y: 660, cost: 12 },

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
            ], // Vide pour l’instant
            evolution: [],    // Vide pour l’instant
            ascension: []     // Vide pour l’instant
        };
    }


    init(data) {
        this.fromMenu = data.fromMenu ?? false;
    }

    preload() {
        const lang = window.selectedLanguage || 'en';
        console.log(lang)
        this.load.json('gameTexts', `assets/game_texts_${lang}.json`);
    }

    create() {
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.gameTexts = this.cache.json.get('gameTexts');
        this.memoryShards = parseInt(localStorage.getItem('memoryShards') || '0');
        this.unlockedTalents = JSON.parse(localStorage.getItem('unlockedTalents') || '[]');

        // Forcer root à être débloqué
        if (!this.unlockedTalents.includes('root')) {
            this.unlockedTalents.push('root');
        }
        this.activeTree = 'foundation';
        this.centerX = this.scale.width / 2;
        this.centerY = this.scale.height / 2;
        this.createTalentTabs();

        this.autoLayoutTree('foundation');
        this.calculateTreeOffset();
        this.createBackground();
        this.drawConnections();
        this.createNodes();
        this.createShardDisplay();
        this.createContinueButton();
    }

    translate(key, replacements = {}) {
        const text = this.gameTexts?.ui?.[key] || key;
        return Object.entries(replacements).reduce((acc, [k, v]) => {
            return acc.replace(new RegExp(`{${k}}`, 'g'), v);
        }, text);
    }

    autoLayoutTree(treeId) {
        const spacingX = 300; // Espace horizontal entre branches principales
        const spacingY = 180; // Espace vertical entre chaque "layer"
        const startX = this.centerX - 450; // Décale un peu vers la gauche pour centrer
        const startY = 150; // Départ vertical sous le titre

        const tree = this.talentTrees[treeId] || [];

        // 1. Indexer les talents par ID
        const idToTalent = {};
        tree.forEach(t => idToTalent[t.id] = t);

        // 2. Trouver les racines immédiates sous root
        const firstLayer = tree.filter(t => t.parent === 'root');

        // 3. Layout chaque branche principale
        firstLayer.forEach((rootTalent, branchIndex) => {
            rootTalent.x = startX + branchIndex * spacingX;
            rootTalent.y = startY + spacingY;

            // Layout récursif pour les sous-branches
            this.autoLayoutSubtree(rootTalent.id, rootTalent.x, rootTalent.y + spacingY, spacingY, idToTalent);
        });

        // Replace root lui-même
        const rootTalent = tree.find(t => t.id === 'root');
        if (rootTalent) {
            rootTalent.x = this.centerX;
            rootTalent.y = startY ;
        }
    }

    autoLayoutSubtree(parentId, parentX, startY, spacingY, idToTalent) {
        // Trouver tous les enfants directs
        const children = Object.values(idToTalent).filter(t => t.parent === parentId);

        if (children.length === 0) return;

        // Centre horizontalement les enfants autour du parent
        const totalWidth = (children.length - 1) * 100; // 100px entre frères/sœurs
        const startX = parentX - totalWidth / 2;

        children.forEach((child, index) => {
            child.x = startX + index * 100;
            child.y = startY;

            // Appelle récursivement pour leurs enfants
            this.autoLayoutSubtree(child.id, child.x, startY + spacingY, spacingY, idToTalent);
        });
    }


    createTalentTabs() {
        const tabs = ['foundation', 'architecture', 'evolution', 'ascension'];
        const labels = {
            foundation: this.translate('tab_foundations') || 'Fondations',
            architecture: this.translate('tab_architecture') || 'Architecture',
            evolution: this.translate('tab_evolution') || 'Évolution',
            ascension: this.translate('tab_ascension') || 'Ascension'
        };

        this.tabButtons = [];

        tabs.forEach((tree, index) => {
            const x = this.centerX - 300 + index * 200;
            const y = 100;

            const isUnlocked = this.isTreeUnlocked(tree);

            const button = this.add.text(x, y, labels[tree], {
                fontSize: '20px',
                fill: isUnlocked ? '#ffffff' : '#888888',
                fontFamily: 'monospace'
            })
                .setOrigin(0.5)
                .setInteractive();

            if (isUnlocked) {
                button.on('pointerdown', () => {
                    this.switchTalentTree(tree);
                });
            }

            this.tabButtons.push(button);
        });
    }

    hasUnlockedFinalNode(tree) {
        const treeData = this.talentTrees[tree] || [];
        const finalNodes = treeData.filter(t => !treeData.some(other => other.parent === t.id));
        return finalNodes.some(node => this.unlockedTalents.includes(node.id));
    }

    isTreeUnlocked(tree) {
        if (tree === 'foundation') return true;
        if (tree === 'architecture') return this.hasUnlockedFinalNode('foundation');
        if (tree === 'evolution') return this.hasUnlockedFinalNode('architecture');
        if (tree === 'ascension') return this.hasUnlockedFinalNode('evolution');
        return false;
    }

    createBackground() {
        this.add.text(this.centerX, 30, this.translate('overseer_core_title'), {
            fontSize: '32px',
            fill: '#00ffcc',
            fontFamily: 'monospace'
        }).setOrigin(0.5);
    }

    createContinueButton() {
        const centerX = this.scale.width / 2;
        const btnY = this.scale.height - 60;

        const button = this.add.rectangle(centerX, btnY, 290, 50, 0x333333, 1)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive();

        let buttonTextValue = this.translate('restart_game_button')
        if(this.fromMenu){
            buttonTextValue = this.translate('return_to_menu_button')
        }

        const buttonText = this.add.text(centerX, btnY, buttonTextValue, {
            fontSize: '20px',
            fill: '#00ff00',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Effet visuel au survol
        button.on('pointerover', () => {
            button.setFillStyle(0x555555);
        });
        button.on('pointerout', () => {
            button.setFillStyle(0x333333);
        });

        // Au clic ➔ relancer MainScene
        button.on('pointerdown', () => {
            if(this.fromMenu){
                this.cameras.main.fadeOut(500, 0, 0, 0);
                this.time.delayedCall(500, () => {
                    this.scene.start('MainMenuScene');
                });

            } else {
                this.cameras.main.fadeOut(500, 0, 0, 0);
                this.time.delayedCall(500, () => {
                    this.scene.start('MainScene');
                });
            }
        });
    }


    createShardDisplay() {
        this.shardText = this.add.text(20, 20, this.translate('memory_shards_label', {count: this.memoryShards}), {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0, 0);
    }

    calculateTreeOffset() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        const currentTree = this.talentTrees[this.activeTree] || [];
        currentTree.forEach(talent => {
            minX = Math.min(minX, talent.x);
            maxX = Math.max(maxX, talent.x);
            minY = Math.min(minY, talent.y);
            maxY = Math.max(maxY, talent.y);
        });

        const treeWidth = maxX - minX;
        const treeHeight = maxY - minY;
        const offsetX = this.centerX - (treeWidth / 2) - minX;
        const offsetY = this.centerY - (treeHeight / 2) - minY;

        this.treeOffset = { x: offsetX, y: offsetY };
    }

    drawConnections() {
        this.connectionLines = []; // <- Stockage pour pouvoir les recolorer plus tard si besoin

        const currentTree = this.talentTrees[this.activeTree] || [];
        currentTree.forEach(talent => {
            if (talent.parent) {
                const parent = currentTree.find(t => t.id === talent.parent);
                if (!parent) return;

                const startX = parent.x + this.treeOffset.x;
                const startY = parent.y + this.treeOffset.y;
                const endX = talent.x + this.treeOffset.x;
                const endY = talent.y + this.treeOffset.y;

                const isUnlocked = this.unlockedTalents.includes(talent.id);



                const color = isUnlocked ? 0x00ff00 : 0xaaaaaa;

                const line = this.add.line(
                    0, 0,
                    startX, startY,
                    endX, endY,
                    color
                ).setOrigin(0, 0).setLineWidth(2).setAlpha(0.7);
                line.isTalentConnection = true;
                this.connectionLines.push(line);
            }
        });
    }

    clearScene() {
        if (this.connectionLines) this.connectionLines.forEach(l => l.destroy());
        this.connectionLines = [];

        if (this.infoBox) this.infoBox.destroy();
        if (this.infoText) this.infoText.destroy();
        this.infoBox = null;
        this.infoText = null;

        // 🚀 Collecter d'abord tous les enfants à détruire
        const nodesToDestroy = this.children.list.filter(child =>
            child.isTalentNode || child.isTalentConnection || child.isTalentLabel
        );

        nodesToDestroy.forEach(child => child.destroy());
    }

    switchTalentTree(name) {
        if (!this.isTreeUnlocked(name)) return;

        this.activeTree = name;
        this.clearScene();        // ➔ Nettoyer les nodes/dessins existants
        this.calculateTreeOffset();
        this.drawConnections();
        this.createNodes();
    }

    createNodes(skipAnimation = false) {
        const currentTree = this.talentTrees[this.activeTree] || [];
        currentTree.forEach(talent => {
            const isUnlocked = this.unlockedTalents.includes(talent.id) || talent.unlocked;

            const node = this.add.circle(
                talent.x + this.treeOffset.x,
                talent.y + this.treeOffset.y,
                30,
                isUnlocked ? 0x00ff00 : 0x555555
            )
                .setStrokeStyle(2, 0xffffff)
                .setInteractive()

            node.isTalentNode = true;

            if(!skipAnimation){
                node.setScale(0.5)
                node.setAlpha(0)
                this.tweens.add({
                    targets: node,
                    scale: 1,
                    alpha: 1,
                    duration: 1000,
                    delay: 100 + Math.random() * 400, // petit décalage aléatoire pour effet organique
                    ease: 'Cubic.easeOut',
                    onComplete: () => {

                        const label = this.add.text(
                            talent.x + this.treeOffset.x,
                            talent.y + this.treeOffset.y + 40,
                            this.translate(`talent_${talent.id}_label`),
                            {
                                fontSize: '14px',
                                fill: '#ffffff',
                                fontFamily: 'monospace'
                            }
                        ).setOrigin(0.5);
                        label.isTalentLabel = true;

                    }
                });
            } else {
                const label = this.add.text(
                    talent.x + this.treeOffset.x,
                    talent.y + this.treeOffset.y + 40,
                    this.translate(`talent_${talent.id}_label`),
                    {
                        fontSize: '14px',
                        fill: '#ffffff',
                        fontFamily: 'monospace'
                    }
                ).setOrigin(0.5);
                label.isTalentLabel = true;

            }

            node.on('pointerover', () => this.showTalentInfo(talent));
            node.on('pointerout', () => this.hideTalentInfo());
            node.on('pointerdown', () => this.tryUnlockTalent(talent));
        });
    }


    showTalentInfo(talent) {
        this.hideTalentInfo();

        const padding = 20;
        const maxWidth = 350;

        let infoString = `${this.translate(`talent_${talent.id}_label`)}\n\n${this.translate(`talent_${talent.id}_description`)}\n\n`;
        if (!this.unlockedTalents.includes(talent.id)) {
            infoString += this.translate('talent_cost_text', {cost: talent.cost});
        } else {
            infoString += this.translate('talent_unlocked_text');
        }

        // Crée le texte
        this.infoText = this.add.text(this.centerX, this.scale.height - 200, infoString, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            align: 'center',
            wordWrap: { width: maxWidth }
        }).setOrigin(0.5, 0);

        const textBounds = this.infoText.getBounds();

        const panelWidth = textBounds.width + padding * 2;
        const panelHeight = textBounds.height + padding * 2;

        this.infoBox = this.add.rectangle(
            this.centerX,
            this.infoText.y + textBounds.height / 2,
            Math.max(panelWidth, 300),
            panelHeight,
            0x222222,
            0.9
        ).setOrigin(0.5).setStrokeStyle(2, 0xffffff);

        this.infoBox.setDepth(100);
        this.infoText.setDepth(101);
    }



    hideTalentInfo() {
        if (this.infoBox) this.infoBox.destroy();
        if (this.infoText) this.infoText.destroy();
    }

    tryUnlockTalent(talent) {
        if (this.unlockedTalents.includes(talent.id)) return;
        if (talent.parent && !this.unlockedTalents.includes(talent.parent)) return;
        if (talent.cost > this.memoryShards) return;

        this.memoryShards -= talent.cost;
        this.unlockedTalents.push(talent.id);

        localStorage.setItem('memoryShards', this.memoryShards.toString());
        localStorage.setItem('unlockedTalents', JSON.stringify(this.unlockedTalents));

        // 🛠️ Faire l'animation directement sur l'élément existant
        this.animateTalentUnlock(talent);
        this.animateConnectionUnlock(talent);

        // 🛠️ Juste mettre à jour l'affichage du nombre de shards
        if (this.shardText) {
            this.shardText.setText(this.translate('memory_shards_label', { count: this.memoryShards }));
        }

        // ❌ Ne pas appeler tout de suite refreshTalentTreeDisplay() (sauf cas très spécifiques)
    }

    animateConnectionUnlock(talent) {
        const parent = this.talentTrees[this.activeTree].find(t => t.id === talent.parent);
        if (!parent) return;

        const startX = parent.x + this.treeOffset.x;
        const startY = parent.y + this.treeOffset.y;
        const endX = talent.x + this.treeOffset.x;
        const endY = talent.y + this.treeOffset.y;

        // Retrouver la ligne connectant parent ➔ talent
        const matchingLine = this.connectionLines.find(line => {
            return (line.geom.x1 === startX && line.geom.y1 === startY && line.geom.x2 === endX && line.geom.y2 === endY)
                || (line.geom.x2 === startX && line.geom.y2 === startY && line.geom.x1 === endX && line.geom.y1 === endY);
        });

        if (!matchingLine) return;

        this.tweens.add({
            targets: matchingLine,
            alpha: { from: 0, to: 1 },
            duration: 300,
            ease: 'Sine.easeOut',
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                matchingLine.setStrokeStyle(2, 0x00ff00);
                matchingLine.setAlpha(1);
            }
        });
    }


    animateTalentUnlock(talent) {
        const nodeX = talent.x + this.treeOffset.x;
        const nodeY = talent.y + this.treeOffset.y;

        // Retrouver le node visuellement à ses coordonnées
        const node = this.children.list.find(obj =>
            obj.isTalentNode &&
            Phaser.Math.Distance.Between(obj.x, obj.y, nodeX, nodeY) < 10
        );

        if (!node) return;

        // Animation visuelle du node
        this.tweens.add({
            targets: node,
            scale: { from: 1.2, to: 1 },
            alpha: { from: 0.5, to: 1 },
            duration: 400,
            ease: 'Cubic.easeOut'
        });

        // Facultatif : changer temporairement la couleur pour le plaisir
        node.setFillStyle(0x00ff00);
    }

}
