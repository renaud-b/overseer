class HUDManager {
    constructor(scene, resources, units) {
        this.scene = scene;
        this.statsOverlayElements = [];
        this.menuOpen = false;
        this.createHUD();
        this.createInfoPanel();
        const lastPosition = this.createTimeControlButtons();
        this.createWaveCounter(lastPosition);
        this.createVisionUpgradeButton();
        this.updateHUD(resources, units, {});
    }
    showStatsOverlay() {
        if (this.menuOpen) return;
        this.menuOpen = true;
        const { width, height } = this.scene.scale;
        const centerX = width / 2;
        const bg = this.scene.add
            .rectangle(0, 0, width, height, 0, 0.85)
            .setOrigin(0)
            .setDepth(900);
        this.statsOverlayElements.push(bg);
        const title = this.scene.add
            .text(
                centerX,
                80,
                this.scene.translate("overlay_stats_title") || "Analyse stratégique",
                { fontSize: "32px", fill: "#00ffff", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setDepth(901);
        this.statsOverlayElements.push(title);
        const artifactTitle = this.scene.add
            .text(
                centerX,
                140,
                this.scene.translate("overlay_artifact_title") || "🔮 Artefacts actifs",
                { fontSize: "20px", fill: "#ffffff", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setDepth(901);
        this.statsOverlayElements.push(artifactTitle);
        const startY = 180;
        const lineSpacing = 24;
        const artifacts = this.scene.artifactManager?.artifacts || [];
        console.log("Artefacts actifs:", artifacts);
        artifacts.forEach((a, i) => {
            const txt = this.scene.add
                .text(
                    centerX,
                    startY + i * lineSpacing,
                    `✅ ${a.name || a.id}  →  ${a.desc || a.effect}`,
                    { fontSize: "16px", fill: "#7fffaa", fontFamily: "monospace" }
                )
                .setOrigin(0.5)
                .setDepth(901);
            this.statsOverlayElements.push(txt);
        });
        const statY = startY + artifacts.length * lineSpacing + 40;
        const totalCollected = Object.entries(this.scene.collectedResources)
            .map(([k, v]) => `${this.scene.translate(k)}: ${Math.floor(v)}`)
            .join(" / ");
        const totalProduced = Object.values(this.scene.unitStats.produced).reduce(
            (a, b) => a + b,
            0
        );
        const totalLost = Object.values(this.scene.unitStats.lost).reduce(
            (a, b) => a + b,
            0
        );
        const stats = [
            `${
                this.scene.translate("overlay_waves_survived") || "⏱️ Vagues tenues"
            } : ${this.scene.waveManager?.waveNumber || 0}`,
            `${
                this.scene.translate("overlay_resources_collected") ||
                "⚙️ Ressources collectées"
            } : ${totalCollected}`,
            `${
                this.scene.translate("overlay_units_produced") || "🦾 Unités produites"
            } : ${totalProduced}`,
            `${
                this.scene.translate("overlay_units_lost") || "⚰️ Unités perdues"
            } : ${totalLost}`,
        ];
        stats.forEach((line, i) => {
            const txt = this.scene.add
                .text(centerX, statY + i * lineSpacing, line, {
                    fontSize: "16px",
                    fill: "#ffffff",
                    fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(901);
            this.statsOverlayElements.push(txt);
        });
        const resumeBtn = this.scene.add
            .text(
                centerX,
                height - 100,
                `[ ${this.scene.translate("resume_button") || "Reprendre"} ]`,
                { fontSize: "22px", fill: "#00ff00", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(902);
        resumeBtn.on("pointerdown", () => this.closeStatsOverlay());
        this.statsOverlayElements.push(resumeBtn);
        const quitBtn = this.scene.add
            .text(
                centerX,
                height - 60,
                `[ ${this.scene.translate("quit_button") || "Abandonner"} ]`,
                { fontSize: "22px", fill: "#ff4444", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(902);
        quitBtn.on("pointerdown", () => {
            this.scene.cameras.main.fadeOut(500, 0, 0, 0);
            this.scene.time.delayedCall(500, () => {
                this.scene.scene.start("MainMenuScene");
            });
        });
        this.statsOverlayElements.push(quitBtn);
        this.scene.setTimeScale(0);
    }
    closeStatsOverlay() {
        this.statsOverlayElements.forEach((e) => e.destroy());
        this.statsOverlayElements = [];
        this.menuOpen = false;
        this.scene.setTimeScale(1);
    }
    updateBaseLife(current, max) {
        const ratio = Phaser.Math.Clamp(current / max, 0, 1);
        this.baseLifeFill.setScale(ratio, 1);
    }
    createHUD() {
        const offsetX = 40;
        const offsetY = this.scene.scale.height - 360;
        this.resourceIcons = [];

        this.scene.add.image(70, 10, "base_icon").setDepth(100).setOrigin(0, 0)
        this.baseLifeBg = this.scene.add.image(110, 20, "empty_base_life").setOrigin(0, 0).setDepth(99);
        this.baseLifeFill = this.scene.add.image(110, 20, "base_life").setOrigin(0, 0).setDepth(100);

        this.baseMaxWidth = this.baseLifeFill.width;

        this.scene.add.rectangle(0, this.scene.scale.height-400, this.scene.scale.width, 500, 0x0e151c).setOrigin(0, 0)

        const menuBtn = this.scene.add.image(this.scene.scale.width-50, 10, `menu_btn`).setInteractive().setOrigin(0, 0).setDepth(100)
        menuBtn.on("pointerdown", () => {
            console.log("clicked")
            if (!this.menuOpen) this.showStatsOverlay();
            else this.closeStatsOverlay();
        })

        this.scene.add
            .image(offsetX-20, offsetY-35, `resourceContainer`)
            .setDisplaySize(100, 350)
            .setOrigin(0, 0)
            .setDepth(100);

        const spacing = 40;
        this.scene.gameData.resources.forEach((res, index) => {
            const icon = this.scene.add
                .image(offsetX, offsetY + index * spacing, `icon_${res.id}`)
                .setOrigin(0, 0.5)
                .setDisplaySize(24, 24)
                .setDepth(100);
            const text = this.scene.add
                .text(offsetX + 40, offsetY + index * spacing, "0", {
                    fontSize: "18px",
                    fill: "#ffffff",
                    fontFamily: "monospace",
                })
                .setOrigin(0, 0.5)
                .setDepth(100);
            icon.setInteractive();
            icon.on("pointerover", () => {
                this.showInfoPanel(res.name, res.description, icon.x + 20, icon.y);
            });
            icon.on("pointerout", () => {
                this.hideInfoPanel();
            });
            text.setInteractive();
            text.on("pointerover", () => {
                this.showInfoPanel(res.name, res.description, text.x + 20, text.y);
            });
            text.on("pointerout", () => {
                this.hideInfoPanel();
            });
            this.resourceIcons.push({ id: res.id, icon, text });
        });
    }
    updateHUD(resources, units, unitCapMap = {}) {
        this.resourceIcons.forEach(({ id, text }) => {
            const value = resources[id] || 0;
            text.setText(Math.floor(value).toString());
        });
        const unitLines = Object.entries(units)
            .map(([key, val]) => {
                const max = unitCapMap[key] || 0;
                const unitName =
                    this.scene.gameData.units.find((u) => u.id === key)?.name || key;
                return max > 0 ? `${unitName}: ${val}/${max}` : `${unitName}: ${val}`;
            })
            .join("   ");
        if (!this.unitText) {
            this.unitText = this.scene.add
                .text(20, this.scene.scale.height - 60, "", {
                    fontSize: "20px",
                    fill: "#ffffff",
                    fontFamily: "monospace",
                })
                .setVisible(false)
                .setDepth(100);
        }
        this.unitText.setText(
            this.scene.translate("units_label") + `:\n  ${unitLines}`
        );

        // Do not recreate sprites on every resource/HUD update.
        this.updateVisionUpgradeButton();
    }
    createInfoPanel() {
        this.infoPanel = this.scene.add
            .rectangle(0, 0, 10, 10, 2236962, 0.9)
            .setStrokeStyle(2, 16777215)
            .setOrigin(0, 1)
            .setVisible(false)
            .setDepth(600);
        this.infoText = this.scene.add
            .text(0, 0, "", {
                fontSize: "14px",
                fill: "#ffffff",
                fontFamily: "monospace",
                wordWrap: { width: 200, useAdvancedWrap: true },
                align: "left",
                lineSpacing: 4,
            })
            .setOrigin(0, 1)
            .setVisible(false)
            .setDepth(601);
    }
    showInfoPanel(title, description, x, y) {
        if (!this.infoText || !this.infoPanel || !title || !description) return;
        const padding = 10;
        const maxWidth = 300;
        const fullText = `${title}\n\n${description}`;
        this.infoText.setText(fullText);
        this.infoText.setWordWrapWidth(maxWidth);
        this.infoText.setPosition(0, 0);
        this.infoText.setVisible(true);
        this.scene.children.bringToTop(this.infoText);
        const textBounds = this.infoText.getBounds();
        const panelWidth = textBounds.width + padding * 2;
        const panelHeight = textBounds.height + padding * 2;
        let panelX = x;
        let panelY = y - panelHeight;
        if (panelY < 0) {
            panelY = y;
        }
        if (panelX + panelWidth > this.scene.scale.width) {
            panelX = this.scene.scale.width - panelWidth - 10;
        }
        if (panelX < 10) {
            panelX = 10;
        }
        this.infoPanel.setSize(panelWidth, panelHeight);
        this.infoPanel.setPosition(panelX, panelY);
        this.infoPanel.setOrigin(0, 0);
        this.infoPanel.setVisible(true);
        this.infoText.setPosition(panelX + padding, panelY + padding);
        this.infoText.setOrigin(0, 0);
        this.scene.children.bringToTop(this.infoPanel);
        this.scene.children.bringToTop(this.infoText);
    }
    hideInfoPanel() {
        this.infoPanel.setVisible(false);
        this.infoText.setVisible(false);
    }
    hideWavePreview() {
        if (this.wavePreviewPanel) this.wavePreviewPanel.destroy();
        if (this.wavePreviewText) this.wavePreviewText.destroy();
        this.wavePreviewPanel = null;
        this.wavePreviewText = null;
    }
    createWaveCounter(position) {
        const { x, y } = position;
        this.scene.add
            .image(x + 10, y, "wave_border")
            .setOrigin(0, 0)
            .setDisplaySize(100, 25)
            .setDepth(50);

        this.waveCounterY = y + 13;
        this.waveText = this.scene.add
            .text(x + 60, this.waveCounterY, this.scene.translate("wave_counter", { wave: 0 }), {
                fontSize: "14px",
                fill: "#84F7FF",
                fontFamily: "inter",
            })
            .setOrigin(0.5)
            .setDepth(51);
    }

    updateWaveCounter(waveNumber) {
        if (!this.waveText) return;
        this.waveText.setText(this.scene.translate("wave_counter", { wave: waveNumber }));
        this.scene.children.bringToTop(this.waveText);
    }

    createVisionUpgradeButton() {
        // The HUD is initialized before Vision; the first refresh happens after
        // the game has created Vision and applied any starting talents.
        const x = 260;
        const y = 56;
        this.visionUpgradeButton = this.scene.add
            .rectangle(x, y, 180, 46, 0x263b48)
            .setStrokeStyle(1, 0x577c91)
            .setInteractive()
            .setDepth(101);
        this.visionUpgradeLabel = this.scene.add
            .text(x, y - 11, this.scene.translate('upgrade_vision'), {
                fontFamily: 'monospace', fontSize: '15px', color: '#84f7ff'
            })
            .setOrigin(0.5)
            .setDepth(102);
        this.visionUpgradeCost = this.scene.add
            .text(x, y + 12, '', {
                fontFamily: 'monospace', fontSize: '12px', color: '#c8d9e2'
            })
            .setOrigin(0.5)
            .setDepth(102);

        this.visionUpgradeButton.on('pointerdown', () => {
            this.scene.vision?.tryUpgradeVision();
        });
        this.visionUpgradeButton.on('pointerover', () => {
            const vision = this.scene.vision;
            if (!vision) return;
            const maxLevel = vision.levelPatterns.length - 1;
            const description = [
                this.scene.translate('current_level_text', { level: vision.level + 1 }),
                vision.level >= maxLevel
                    ? this.scene.translate('vision_max')
                    : this.scene.translate('upgrade_cost_text', {
                        cost: vision.getUpgradeCost(vision.level)
                    })
            ].join('\n');
            this.showInfoPanel(
                this.scene.translate('upgrade_vision_title'),
                description,
                this.visionUpgradeButton.x - 80,
                this.visionUpgradeButton.y + 60
            );
        });
        this.visionUpgradeButton.on('pointerout', () => this.hideInfoPanel());
        this.updateVisionUpgradeButton();
    }

    updateVisionUpgradeButton() {
        const vision = this.scene.vision;
        if (!vision || !this.visionUpgradeButton) return;

        const maxLevel = vision.levelPatterns.length - 1;
        const maxed = vision.level >= maxLevel;
        const cost = maxed ? 0 : vision.getUpgradeCost(vision.level);
        const affordable = !maxed && (this.scene.resources.compute_units || 0) >= cost;

        this.visionUpgradeCost.setText(
            maxed
                ? this.scene.translate('vision_max')
                : `${cost} CU · ${vision.level + 1} → ${vision.level + 2}`
        );
        this.visionUpgradeButton
            .setFillStyle(affordable ? 0x155765 : 0x26313a)
            .setStrokeStyle(1, affordable ? 0x84f7ff : 0x577c91);
        this.visionUpgradeLabel.setColor(affordable ? '#84f7ff' : '#a0afb8');
        this.visionUpgradeCost.setColor(affordable ? '#ffffff' : '#a0afb8');
    }

    createTimeControlButtons() {
        const speeds = [
            { speed: 1, label: "×1" },
            { speed: 2, label: "×2" },
            { speed: 3, label: "×3" },
            { speed: 5, label: "×5" },
            { speed: 0, label: "Ⅱ" },
        ];
        const width = 42;
        const gap = 6;
        const totalWidth = width * speeds.length + gap * (speeds.length - 1);
        // Keep the speed controls on screen, away from the top-right menu.
        // Placing them below the timeline avoids hiding flags on narrow desktops.
        const startX = Math.max(12, this.scene.scale.width - 60 - totalWidth);
        const centerY = 69;
        this.timeButtons = [];

        speeds.forEach(({ speed, label }, index) => {
            const x = startX + index * (width + gap) + width / 2;
            const background = this.scene.add
                .rectangle(x, centerY, width, 28, 0x263b48)
                .setStrokeStyle(1, 0x577c91)
                .setInteractive()
                .setDepth(51);
            const text = this.scene.add
                .text(x, centerY, label, {
                    fontSize: "16px",
                    fill: "#c8d9e2",
                    fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(52);

            background.on("pointerdown", () => this.scene.setTimeScale(speed));
            this.timeButtons.push({ speed, background, text });
        });

        this.highlightSelectedSpeed(this.scene.timeScale ?? 1);
        return { x: Math.max(12, startX - 120), y: 56 };
    }

    highlightSelectedSpeed(speed) {
        this.timeButtons.forEach((button) => {
            const selected = button.speed === speed;
            button.background
                .setFillStyle(selected ? 0x166f88 : 0x263b48)
                .setStrokeStyle(1, selected ? 0x84f7ff : 0x577c91);
            button.text.setColor(selected ? "#ffffff" : "#c8d9e2");
        });
    }

    showRewardPopupWithChoices(rewards, onAllRewardsChosen = () => {}) {
        this.lastTimeScale = this.scene.timeScale;
        const resourcePacks = rewards.packs.filter((p) => p.type === "resource");
        const buildingPacks = rewards.packs.filter((p) => p.type === "building");
        const restoreTimeScale = () => {
            this.scene.setTimeScale(this.lastTimeScale);
        };
        const showBuildingAndArtifactIfNeed = () => {
            if (buildingPacks.length > 0) {
                this.showRewardPackSelection(
                    buildingPacks,
                    "building",
                    (buildingChoices) => {
                        buildingChoices.forEach(({ id }) => {
                            this.scene.buildingManager.addCardById(id);
                        });
                        if (rewards.artifactReward) {
                            this.showRewardPackSelection(
                                [{ type: "artifact", options: rewards.artifactReward }],
                                "artifact",
                                (choices) => {
                                    choices.forEach(({ id }) =>
                                        this.scene.artifactManager.addArtifact(id)
                                    );
                                    onAllRewardsChosen(restoreTimeScale);
                                }
                            );
                        } else {
                            onAllRewardsChosen(restoreTimeScale);
                        }
                    }
                );
            } else {
                if (rewards.artifactReward) {
                    this.showRewardPackSelection(
                        [{ type: "artifact", options: rewards.artifactReward }],
                        "artifact",
                        (choices) => {
                            choices.forEach(({ id }) =>
                                this.scene.artifactManager.addArtifact(id)
                            );
                            onAllRewardsChosen(restoreTimeScale);
                        }
                    );
                } else {
                    onAllRewardsChosen(restoreTimeScale);
                }
            }
        };
        if (resourcePacks.length > 0) {
            this.showRewardPackSelection(
                resourcePacks,
                "resource",
                (resourceChoices) => {
                    resourceChoices.forEach(({ id, quantity }) => {
                        this.scene.addResource(id, quantity || 1);
                    });
                    showBuildingAndArtifactIfNeed();
                }
            );
        } else {
            showBuildingAndArtifactIfNeed();
        }
    }
    showRewardPackSelection(packs, type, onDone) {
        this.scene.setTimeScale(0);
        const overlay = this.scene.add
            .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0, 0.6)
            .setOrigin(0)
            .setDepth(200);
        const panelHeight = 180 + packs.length * 100;
        const panel = this.scene.add
            .rectangle(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2,
                550,
                panelHeight,
                2236962,
                0.95
            )
            .setStrokeStyle(3, 16777215)
            .setDepth(201);
        const titleText = {
            resource: this.scene.translate("reward_choose_resources"),
            building: this.scene.translate("reward_choose_buildings"),
            artifact: this.scene.translate("reward_choose_artifact"),
        };
        const title = this.scene.add
            .text(panel.x, panel.y - 120, titleText[type] || "Récompenses", {
                fontSize: "22px",
                fill: "#ffffff",
                fontFamily: "monospace",
            })
            .setOrigin(0.5)
            .setDepth(202);
        const selectedChoices = [];
        let yOffset = -60;
        packs.forEach((pack, packIndex) => {
            const label = this.scene.add
                .text(panel.x - 240, panel.y + yOffset, `Pack ${packIndex + 1}`, {
                    fontSize: "18px",
                    fill: "#ffff00",
                    fontFamily: "monospace",
                })
                .setOrigin(0, 0.5)
                .setDepth(202);
            const group = [];
            pack.options.forEach((id, i) => {
                const x = panel.x - 100 + i * 120;
                const y = panel.y + yOffset + 40;
                let labelText;
                if (type === "resource") {
                    const res = this.scene.gameData.resources.find((r) => r.id === id);
                    labelText = `${res?.name || id} +${pack.quantity}`;
                } else if (type === "building") {
                    labelText = this.scene.buildingManager.buildingMap[id]?.name || id;
                } else if (type === "artifact") {
                    const artifact = pack.options[i];
                    labelText = artifact.name || artifact.id;
                }
                const btn = this.scene.add
                    .rectangle(x, y, 100, 50, 4473924)
                    .setStrokeStyle(2, 16777215)
                    .setInteractive()
                    .setDepth(202);
                const txt = this.scene.add
                    .text(x, y, labelText, {
                        fontSize: "12px",
                        fill: "#ffffff",
                        wordWrap: { width: 90 },
                        align: "center",
                        fontFamily: "monospace",
                    })
                    .setOrigin(0.5)
                    .setDepth(203);
                btn.on("pointerdown", () => {
                    group.forEach((b) => b.setFillStyle(4473924));
                    btn.setFillStyle(8947848);
                    selectedChoices[packIndex] = { id, quantity: pack.quantity };
                });
                if (type === "building") {
                    btn.on("pointerover", () => {
                        const info = this.scene.getDescription(id);
                        this.showInfoPanel(info.name, info.desc, btn.x + 40, btn.y);
                    });
                    btn.on("pointerout", () => {
                        this.hideInfoPanel();
                    });
                } else if (type === "artifact") {
                    btn.on("pointerover", () =>
                        this.showInfoPanel(id.name, id.desc, btn.x + 40, btn.y)
                    );
                    btn.on("pointerout", () => this.hideInfoPanel());
                }
                group.push(btn);
            });
            yOffset += 100;
        });
        const confirmBtn = this.scene.add
            .text(
                panel.x,
                panel.y + panelHeight / 2 - 40,
                this.scene.translate("confirm_button"),
                { fontSize: "20px", fill: "#00ff00", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(202);
        confirmBtn.on("pointerdown", () => {
            [
                overlay,
                panel,
                title,
                confirmBtn,
                ...this.scene.children.list.filter(
                    (o) => o.depth >= 202 && o.depth <= 210
                ),
            ].forEach((o) => o.destroy());
            const finalChoices = selectedChoices.filter((c) => c && c.id);
            onDone(finalChoices);
        });
    }
    showWavePreviewWithRewards(composition, rewards, x, y) {
        this.hideWavePreview();
        if (composition === undefined) {
            return;
        }
        const enemyLines = Object.entries(composition).map(([id, count]) => {
            const enemy = this.scene.gameData.enemies.find((e) => e.id === id);
            return `- ${enemy?.name || id} x${count}`;
        });
        const rewardLines = [];
        rewardLines.push(this.scene.translate("rewards_label"));
        if (rewards?.packs) {
            rewards.packs.forEach((pack) => {
                if (pack.type === "resource") {
                    rewardLines.push(
                        this.scene.translate("resource_pack_label", {
                            quantity: pack.quantity,
                        })
                    );
                } else if (pack.type === "building") {
                    rewardLines.push(this.scene.translate("building_pack_label"));
                }
            });
        }
        if (rewards?.artifactReward) {
            const names = rewards.artifactReward
                .map((a) => a.name || a.id)
                .join(", ");
            rewardLines.push(this.scene.translate("artifact_reward_label"));
        }
        const fullText = [...enemyLines, "", ...rewardLines].join("\n");
        this.wavePreviewPanel = this.scene.add
            .rectangle(
                x + 20,
                y + 30,
                300,
                fullText.split("\n").length * 20 + 20,
                2236962,
                0.9
            )
            .setStrokeStyle(2, 16777215)
            .setOrigin(0, 0)
            .setDepth(1000);
        this.wavePreviewText = this.scene.add
            .text(x + 30, y + 40, fullText, {
                fontSize: "14px",
                fill: "#ffffff",
                fontFamily: "monospace",
            })
            .setDepth(1001);
    }
    showWaveDraftPopup(choices, then = () => {}) {
        this.lastTimeScale = this.scene.timeScale;
        this.scene.setTimeScale(0);
        const overlay = this.scene.add
            .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0, 0.6)
            .setOrigin(0)
            .setDepth(400);
        const panel = this.scene.add
            .rectangle(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2,
                700,
                500,
                2236962,
                0.95
            )
            .setStrokeStyle(3, 16777215)
            .setDepth(401);
        const title = this.scene.add
            .text(
                panel.x,
                panel.y - 210,
                this.scene.translate("choose_next_waves_title") ||
                "Choisissez les prochaines vagues",
                { fontSize: "24px", fill: "#ffffff", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setDepth(402);
        let selectedChoiceIndex = null;
        const buttons = [];
        choices.forEach((choice, i) => {
            const x = panel.x - 200 + i * 200;
            const y = panel.y;
            const btn = this.scene.add
                .rectangle(x, y, 180, 350, 4473924)
                .setStrokeStyle(2, 16777215)
                .setInteractive()
                .setDepth(403);
            const txt = this.scene.add
                .text(x, y - 150, choice.label, {
                    fontSize: "18px",
                    fill: "#ffff00",
                    fontFamily: "monospace",
                })
                .setOrigin(0.5)
                .setDepth(404);
            let content = choice.waves
                .map((wave, idx) => {
                    const enemies = Object.entries(wave.composition || wave)
                        .map(([id, count]) => {
                            const enemy = this.scene.gameData.enemies.find(
                                (e) => e.id === id
                            );
                            const name =
                                enemy?.name || this.scene.translate(`enemy_${id}`) || id;
                            return `${name} x${count}`;
                        })
                        .join("\n");
                    const packs = wave.rewards?.packs || [];
                    const lines = packs.map((p) => {
                        if (p.type === "resource") {
                            return `💠 ${p.options.length} res x${Math.floor(p.quantity)}`;
                        }
                        if (p.type === "building") {
                            return `🏗️ ${p.options.length} bâtiments`;
                        }
                        return "";
                    });
                    if (wave.rewards?.artifactReward) {
                        lines.push(`🔮 1 artefact`);
                    }
                    const rewardText = lines.join("\n");
                    const rewardLabel =
                        this.scene.translate("rewards_label") || "Récompenses";
                    return `🌊 ${this.scene.translate("wave_label")} ${
                        idx + 1
                    }\n${enemies}\n\n🎁 ${rewardLabel} \n${rewardText}`;
                })
                .join("\n\n\n");
            const detailText = this.scene.add
                .text(x, y - 120, content, {
                    fontSize: "12px",
                    fill: "#ffffff",
                    fontFamily: "monospace",
                    align: "left",
                    wordWrap: { width: 160 },
                })
                .setOrigin(0.5, 0)
                .setDepth(404);
            btn.on("pointerdown", () => {
                selectedChoiceIndex = i;
                buttons.forEach((b) => b.btn.setFillStyle(4473924));
                btn.setFillStyle(8947848);
            });
            buttons.push({ btn, txt, detailText });
        });
        const confirmBtn = this.scene.add
            .text(
                panel.x,
                panel.y + 220,
                this.scene.translate("confirm_button") || "[ Valider ]",
                { fontSize: "20px", fill: "#00ff00", fontFamily: "monospace" }
            )
            .setOrigin(0.5)
            .setInteractive()
            .setDepth(405);
        confirmBtn.on("pointerdown", () => {
            if (selectedChoiceIndex === null) return;
            const chosen = choices[selectedChoiceIndex];
            console.log("chosen.waves: ", chosen.waves);
            chosen.waves.forEach((w) => {
                const { composition, rewards } = w;
                const waveId = this.scene.waveManager.currentWaveId++;
                this.scene.waveManager.waves[waveId] = {
                    alive: -1,
                    composition: composition,
                    rewards: rewards,
                };
                this.scene.waveManager.selectedWaves.push(w);
                console.log(`Nouvelle vague planifiée (draft) id=${waveId}`);
                then();
            });
            [
                overlay,
                panel,
                title,
                confirmBtn,
                ...buttons.flatMap((b) => [b.btn, b.txt, b.detailText]),
            ].forEach((o) => o.destroy());
            this.scene.setTimeScale(this.lastTimeScale);
        });
    }
}
