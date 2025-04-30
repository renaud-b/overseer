class HomeScene extends Phaser.Scene {
    constructor() {
        super('HomeScene');
    }

    preload() {

        this.load.image('homeBackground', 'assets/background.png');
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // 🌌 Fond
        this.add.image(0, 0, 'homeBackground')
            .setOrigin(0, 0)
            .setDisplaySize(this.scale.width, this.scale.height);

        // ✨ Titre principal du jeu
        this.add.text(centerX, centerY - 250, '🤖 OVERSEER', {
            fontSize: '48px',
            fill: '#00ffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // 📜 Sous-titre ou message
        this.add.text(centerX, centerY - 190, 'A tactical AI awakening', {
            fontSize: '20px',
            fill: '#aaaaaa',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // 🔥 Liste des langues disponibles
        const languages = [
            { code: 'en', label: '🇬🇧 English' },
            { code: 'fr', label: '🇫🇷 Français' },
            { code: 'es', label: '🇪🇸 Español' },
            { code: 'jp', label: '🇯🇵 日本語' }
        ];

        this.add.text(centerX, centerY - 80, 'Select your language', {
            fontSize: '26px',
            fill: '#ffffff',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // 📜 Boutons de langue
        languages.forEach((lang, index) => {
            const button = this.add.text(centerX, centerY + index * 60, lang.label, {
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
                localStorage.setItem('selectedLanguage', lang.code);
                this.scene.start('MainMenuScene');
            });
        });
    }
}
