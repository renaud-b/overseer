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

// Langue UI
const savedLang = localStorage.getItem('selectedLanguage');
if (savedLang) {
    window.selectedLanguage = savedLang;
    config.scene = [MainMenuScene, OptionsScene, MainScene, OverseerCoreScene];
} else {
    config.scene = [HomeScene, OptionsScene, MainMenuScene, MainScene, OverseerCoreScene];
}

// Clavier
const savedLayout = localStorage.getItem('keyboardLayout');
if (savedLayout) {
    window.keyboardLayout = savedLayout;
} else {
    const userLang = navigator.language || navigator.userLanguage || '';
    const isFrench = userLang.toLowerCase().startsWith('fr');
    const defaultLayout = isFrench ? 'azerty' : 'qwerty';
    window.keyboardLayout = defaultLayout;
    localStorage.setItem('keyboardLayout', defaultLayout);
}


const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
