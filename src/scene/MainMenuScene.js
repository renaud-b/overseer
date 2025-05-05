class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    preload() {
        this.load.image('background', 'assets/background.png');
        const lang = window.selectedLanguage || 'en';
        const assets = {
            'en': '/ipfs/QmZofYpipse1sKMx3XXZwmvMU4VHE5ofgGNbAdg17rHFGp', // game_texts_en.json
            'fr': '/ipfs/Qmdsk7ZTq4t6WmhTfUZrYzAmqVPeSwEVs84v2D4tzoToye', // game_texts_fr.json
            'es': '/ipfs/QmbACgTSvzUZhePYnANCz5wjDJotMfBPatCH4NpvpZgFgD', // game_texts_es.json
            'jp': '/ipfs/QmawNsDeTEbYcbfDRZFo8kMT2pit8fCcg1hGqQdKkfMbZR' // game_texts_jp.json
        }
        this.load.json('gameTexts', assets[lang]);

    }

    translate(key, replacements = {}) {
        const text = this.gameData.menu[key] || key;
        return Object.entries(replacements).reduce((acc, [k, v]) => {
            return acc.replace(new RegExp(`{${k}}`, 'g'), v);
        }, text);
    }

    create() {
        this.gameData = this.cache.json.get('gameTexts');
        const { width, height } = this.scale;

        // Fond
        this.add.image(width / 2, height / 2, 'background')
            .setDisplaySize(width, height)
            .setOrigin(0.5);

        // Fonctions utilitaires
        const createMenuButton = (y, textKey, callback) => {
            const button = this.add.text(width / 2, y, this.translate(textKey), {
                fontSize: '32px',
                fill: '#ccc',
                fontFamily: 'Arial',
            })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true }) // curseur main
                .on('pointerdown', callback)
                .on('pointerover', () => {
                    button.setStyle({ fill: '#fff' });
                    button.setScale(1.1);
                })
                .on('pointerout', () => {
                    button.setStyle({ fill: '#ccc' });
                    button.setScale(1);
                });

            return button;
        };

        // Boutons
        createMenuButton(height / 2 - 90, "start", () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('MainScene');
            });
        });
        createMenuButton(height / 2 - 30, "options", () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('OptionsScene')
            });
        });
        createMenuButton(height / 2 + 30, "talents", () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(500, () => {
                this.scene.start('OverseerCoreScene', {fromMenu: true})
            });
        });
        createMenuButton(height / 2 + 90, "quit", () => window.close());
    }
}
