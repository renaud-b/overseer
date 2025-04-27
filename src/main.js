const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1d1d1d',
    scene: [LanguageSelectScene, MainScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const jeu = new Phaser.Game(config);

window.addEventListener('resize', () => {
    jeu.scale.resize(window.innerWidth, window.innerHeight);
});
