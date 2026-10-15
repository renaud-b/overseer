    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#08121c',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    };
    const savedLang = localStorage.getItem('selectedLanguage');
    if (savedLang) {
        window.selectedLanguage = savedLang;
        config.scene = [VNextScene, MainMenuScene, GameScene, OptionsScene, TalentScene];
    } else {
        config.scene = [VNextScene, HomeScene, OptionsScene, MainMenuScene, GameScene, TalentScene];
    }
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
