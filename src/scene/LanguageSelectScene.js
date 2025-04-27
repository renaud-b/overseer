class LanguageSelectScene extends Phaser.Scene {
    constructor() {
        super('LanguageSelectScene');
    }

    preload() {
        // Un joli fond animé ? 🌌
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // 🔥 Liste des langues disponibles
        const languages = [
            { code: 'en', label: '🇬🇧 English' },
            { code: 'fr', label: '🇫🇷 Français' },
            { code: 'es', label: '🇪🇸 Español' },
            { code: 'jp', label: '🇯🇵 日本語' }
        ];

        // 📝 Titre
        this.add.text(centerX, centerY - 150, 'Select your language', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // 📜 Génération dynamique des boutons
        languages.forEach((lang, index) => {
            const button = this.add.text(centerX, centerY - 30 + index * 60, lang.label, {
                fontSize: '22px',
                fill: '#00ff00',
                fontFamily: 'monospace'
            }).setOrigin(0.5).setInteractive();

            button.on('pointerover', () => {
                button.setFill('#88ff88');
            });

            button.on('pointerout', () => {
                button.setFill('#00ff00');
            });

            button.on('pointerdown', () => {
                window.selectedLanguage = lang.code;
                this.scene.start('MainScene');
            });
        });
    }
}
