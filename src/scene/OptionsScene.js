class OptionsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'OptionsScene' });
    }

    preload() {
        const lang = window.selectedLanguage || 'en';
        const assets = {
            'en': '/ipfs/QmZofYpipse1sKMx3XXZwmvMU4VHE5ofgGNbAdg17rHFGp', // game_texts_en.json
            'fr': '/ipfs/Qmdsk7ZTq4t6WmhTfUZrYzAmqVPeSwEVs84v2D4tzoToye', // game_texts_fr.json
            'es': '/ipfs/QmbACgTSvzUZhePYnANCz5wjDJotMfBPatCH4NpvpZgFgD', // game_texts_es.json
            'jp': '/ipfs/QmawNsDeTEbYcbfDRZFo8kMT2pit8fCcg1hGqQdKkfMbZR' // game_texts_jp.json
        }
        this.load.json('gameTexts', assets[lang]);

        this.load.image('background', 'assets/background.png');
    }

    translate(key, replacements = {}) {
        const text = this.gameData.menu[key] || key;
        return Object.entries(replacements).reduce((acc, [k, v]) => {
            return acc.replace(new RegExp(`{${k}}`, 'g'), v);
        }, text);
    }

    create() {
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.gameData = this.cache.json.get('gameTexts');
        const { width, height } = this.scale;

        // Fond
        this.add.image(width / 2, height / 2, 'background')
            .setDisplaySize(width, height)
            .setOrigin(0.5);


        const centerX = width / 2;
        let y = height / 5;

        // 🧪 Titre
        this.add.text(centerX, y, this.translate("options"), {
            fontSize: '36px',
            fill: '#fff'
        }).setOrigin(0.5);
        y += 60;

        // 🗑️ Bouton suppression des données
        const deleteButton = this.add.text(centerX, y, this.translate("delete_all_data"), {
            fontSize: '28px',
            fill: '#ccc'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => deleteButton.setStyle({ fill: '#fff', scale: 1.1 }))
            .on('pointerout', () => deleteButton.setStyle({ fill: '#ccc', scale: 1 }))
            .on('pointerdown', () => {
                localStorage.clear();
                alert(this.translate("data_deleted_success"));
            });
        y += 80;

        // 🌍 Sélecteur de langue
        this.add.text(centerX, y, this.translate("language_select") || 'Select language:', {
            fontSize: '24px',
            fill: '#fff'
        }).setOrigin(0.5);
        y += 40;

        const languages = [
            { code: 'en', label: '🇬🇧 English' },
            { code: 'fr', label: '🇫🇷 Français' },
            { code: 'es', label: '🇪🇸 Español' },
            { code: 'jp', label: '🇯🇵 日本語' }
        ];

        languages.forEach((lang, index) => {
            const langButton = this.add.text(centerX, y + index * 40, lang.label, {
                fontSize: '22px',
                fill: '#00ff00',
                fontFamily: 'monospace'
            }).setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            langButton.on('pointerover', () => langButton.setFill('#88ff88'));
            langButton.on('pointerout', () => langButton.setFill('#00ff00'));
            langButton.on('pointerdown', () => {
                // 🔄 Stockage
                window.selectedLanguage = lang.code;
                localStorage.setItem('selectedLanguage', lang.code);

                // 🧹 Supprimer l'ancien JSON de cache pour forcer reload
                this.cache.json.remove('gameTexts');

                // 🔄 Relancer la scène proprement
                this.cameras.main.fadeOut(500, 0, 0, 0);
                this.time.delayedCall(500, () => {
                    this.scene.restart();
                });

            });
        });

        // 🔙 Retour
        const backButton = this.add.text(centerX, height * 0.9, this.translate("back"), {
            fontSize: '24px',
            fill: '#888'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => backButton.setStyle({ fill: '#fff' }))
            .on('pointerout', () => backButton.setStyle({ fill: '#888' }))
            .on('pointerdown', () => {
                this.cameras.main.fadeOut(500, 0, 0, 0);
                this.time.delayedCall(500, () => {
                    this.scene.start('MainMenuScene')
                });
            });
    }
}
