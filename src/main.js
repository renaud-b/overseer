const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1d1d1d',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const savedLang = localStorage.getItem('selectedLanguage');
if (savedLang) {
    window.selectedLanguage = savedLang;
    config.scene = [MainMenuScene, OptionsScene, MainScene, OverseerCoreScene]; // saute HomeScene
} else {
    config.scene = [HomeScene, OptionsScene, MainMenuScene, MainScene, OverseerCoreScene];
}

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
