const { app, BrowserWindow, Menu, ipcMain, shell, systemPreferences, nativeTheme, nativeImage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { mainMenu } = require('./contextmenu');
const { loadConfig, saveConfig } = require('./config'); 
const { getThemeCss, getThemeJs } = require('./theme'); 

const appId = 'com.aspxcts.enhancedtube';
app.setAppUserModelId(appId);
app.setName('EnhancedTube');

// --- PROTOCOL REGISTRATION ---
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('enhancedtube', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('enhancedtube');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            
            // --- CATCH JUMP LIST CLICKS ---
            // When you click a taskbar task, it sends an argument like "enhancedtube://..."
            const url = commandLine.find(arg => arg.startsWith('enhancedtube://'));
            if (url) loadDeepLink(url);
        }
    });

    let cfg = loadConfig();
    
    if (cfg.theme_mode === 'dark') nativeTheme.themeSource = 'dark';
    else if (cfg.theme_mode === 'light') nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'system';

    // Optimization Flags
    if (cfg.use_av1) app.commandLine.appendSwitch('enable-features', 'AV1');
    if (cfg.UseSkiaRenderer) app.commandLine.appendSwitch('enable-skia-renderer');
    if (cfg.use_vaapi) { app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder'); app.commandLine.appendSwitch('enable-accelerated-video-decode'); }
    if (cfg.force_angle_d3d11) app.commandLine.appendSwitch('use-angle', 'd3d11');
    if (cfg.enable_gpu) { app.commandLine.appendSwitch('enable-gpu-rasterization'); app.commandLine.appendSwitch('enable-accelerated-2d-canvas'); }
    if (cfg.enable_zero_copy) app.commandLine.appendSwitch('enable-zero-copy');
    if (cfg.ignore_gpu_blocklist) app.commandLine.appendSwitch('ignore-gpu-blocklist');
    if (cfg.enable_quic) app.commandLine.appendSwitch('enable-quic');

    let mainWindow;
    let aboutWindow = null;
    let optionsWindow = null;
    let appearanceWindow = null;
    let isPlaying = false; 

    // --- TASKBAR CONTROLS ---
    function getIcon(name) {
        const iconPath = path.join(__dirname, 'assets', `${name}.png`);
        try {
            let img = nativeImage.createFromPath(iconPath);
            if (img.isEmpty()) return null;
            return img.resize({ width: 32, height: 32 }); 
        } catch (e) { return null; }
    }

    function updateThumbar() {
        if (!mainWindow) return;

        const buttons = [
            {
                tooltip: 'Previous',
                icon: getIcon('previous'),
                click: () => {
                    mainWindow.webContents.executeJavaScript(`
                        (function(){
                            var btn = document.querySelector('.ytp-prev-button');
                            if (btn && btn.style.display !== 'none' && !btn.getAttribute('aria-disabled')) {
                                btn.click();
                            } else {
                                var v = document.querySelector('video');
                                if (v) v.currentTime = 0;
                            }
                        })()
                    `);
                },
                flags: ['dismissonclick']
            },
            {
                tooltip: isPlaying ? 'Pause' : 'Play',
                icon: isPlaying ? getIcon('pause') : getIcon('play'),
                click: () => {
                    mainWindow.webContents.executeJavaScript("document.querySelector('.ytp-play-button').click()");
                    isPlaying = !isPlaying;
                    updateThumbar(); 
                },
                flags: ['dismissonclick']
            },
            {
                tooltip: 'Next',
                icon: getIcon('next'),
                click: () => mainWindow.webContents.executeJavaScript("document.querySelector('.ytp-next-button').click()"),
                flags: ['dismissonclick']
            }
        ];

        try { mainWindow.setThumbarButtons(buttons); } catch(e) {}
    }

    function loadDeepLink(deepLink) {
        let targetUrl = deepLink.replace('enhancedtube://', 'https://');
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
            mainWindow.loadURL(targetUrl);
        }
    }

    function injectTheme() {
        if (!mainWindow) return;

        let accent = cfg.text_color || "#ff0000";
        if (cfg.sync_theme && process.platform === 'win32') {
            let sysColor = systemPreferences.getAccentColor(); 
            if (sysColor && sysColor.substring(0, 6) !== "000000") {
                accent = '#' + sysColor.substring(0, 6);
            }
        }

        let isDark = true;
        if (cfg.theme_mode === 'light') isDark = false;
        else if (cfg.theme_mode === 'system') isDark = nativeTheme.shouldUseDarkColors;
        
        mainWindow.webContents.insertCSS(getThemeCss(cfg, accent, isDark)).catch(e => {});
        mainWindow.webContents.executeJavaScript(getThemeJs(accent)).catch(e => {});
    }

    function handleUrlChange(event, url) {
        if (cfg.replace_shorts && url.includes('/shorts/')) {
            const videoId = url.split('/shorts/')[1].split('?')[0];
            mainWindow.loadURL(`https://www.youtube.com/watch?v=${videoId}`);
        }
    }

    function createPopup(file, width, height, title) {
        const win = new BrowserWindow({
            width, height, title,
            parent: mainWindow, modal: true, autoHideMenuBar: true, resizable: false,
            backgroundColor: '#000000',
            webPreferences: { nodeIntegration: true, contextIsolation: false },
            icon: path.join(__dirname, 'icon.ico')
        });
        win.setMenu(null);
        win.loadFile(file);
        return win;
    }

    app.whenReady().then(() => {
        if (process.platform === 'win32') {
            app.setUserTasks([
                {
                    program: process.execPath,
                    arguments: 'enhancedtube://www.youtube.com/feed/subscriptions',
                    iconPath: process.execPath,
                    iconIndex: 0,
                    title: 'Subscriptions',
                    description: 'Go to Subscriptions'
                },
                {
                    program: process.execPath,
                    arguments: 'enhancedtube://www.youtube.com/feed/library',
                    iconPath: process.execPath,
                    iconIndex: 0,
                    title: 'Library',
                    description: 'Go to Library'
                },
                {
                    program: process.execPath,
                    arguments: 'enhancedtube://www.youtube.com/feed/trending',
                    iconPath: process.execPath,
                    iconIndex: 0,
                    title: 'Trending',
                    description: 'See what is trending'
                }
            ]);
        }

        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

        mainWindow = new BrowserWindow({
            width: 1280, height: 720, title: "EnhancedTube",
            backgroundColor: cfg.oled ? '#000000' : '#0f0f0f',
            icon: path.join(__dirname, 'icon.ico'),
            webPreferences: { 
                nodeIntegration: false, 
                contextIsolation: true 
            },
            alwaysOnTop: cfg.always_on_top || false
        });

        mainWindow.webContents.setUserAgent(userAgent);
        app.setLoginItemSettings({ openAtLogin: cfg.start_on_boot || false, path: app.getPath('exe') });
        Menu.setApplicationMenu(mainMenu);
        
        let startUrl = 'https://www.youtube.com';
        if (process.platform === 'win32' && process.argv.length >= 2) {
            const deepLink = process.argv.find(arg => arg.startsWith('enhancedtube://'));
            if (deepLink) startUrl = deepLink.replace('enhancedtube://', 'https://');
        }
        
        mainWindow.loadURL(startUrl, { userAgent: userAgent });

        mainWindow.webContents.on('did-finish-load', () => {
            injectTheme();
            updateThumbar(); 
        });

        setInterval(async () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            try {
                const playing = await mainWindow.webContents.executeJavaScript(
                    `!!(document.querySelector('video') && !document.querySelector('video').paused && !document.querySelector('video').ended)`
                );
                if (playing !== isPlaying) {
                    isPlaying = playing;
                    updateThumbar();
                }
            } catch (e) {}
        }, 500); 

        mainWindow.webContents.on('will-navigate', handleUrlChange);
        mainWindow.webContents.on('did-navigate-in-page', handleUrlChange);
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (!url.includes('youtube.com')) { shell.openExternal(url); return { action: 'deny' }; }
            return { action: 'allow' };
        });

        nativeTheme.on('updated', () => { if (cfg.theme_mode === 'system') injectTheme(); });

        mainWindow.on('open-appearance', () => { 
            if (appearanceWindow) appearanceWindow.focus(); 
            else { appearanceWindow = createPopup('appearance.html', 400, 600, 'Appearance'); appearanceWindow.on('closed', () => appearanceWindow = null); }
        });
        mainWindow.on('open-options', () => { 
            if (optionsWindow) optionsWindow.focus(); 
            else { optionsWindow = createPopup('options.html', 450, 650, 'Options'); optionsWindow.on('closed', () => optionsWindow = null); }
        });
        mainWindow.on('open-about', () => { 
            if (aboutWindow) aboutWindow.focus(); 
            else { aboutWindow = createPopup('about.html', 400, 400, 'About'); aboutWindow.on('closed', () => aboutWindow = null); }
        });
        mainWindow.on('closed', () => { appearanceWindow = null; optionsWindow = null; aboutWindow = null; });
    });

    ipcMain.handle('get-system-accent', () => {
        if (process.platform === 'win32') {
            let color = systemPreferences.getAccentColor();
            if (color && color.substring(0, 6) !== "000000") return '#' + color.substring(0, 6);
        }
        return '#ff0000'; 
    });

    ipcMain.on('save-appearance', (event, newCfg) => {
        cfg = { ...cfg, ...newCfg };
        saveConfig(cfg);
        if (cfg.theme_mode === 'dark') nativeTheme.themeSource = 'dark';
        else if (cfg.theme_mode === 'light') nativeTheme.themeSource = 'light';
        else nativeTheme.themeSource = 'system';
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(cfg.always_on_top || false);
            mainWindow.reload(); 
        }
        app.setLoginItemSettings({ openAtLogin: cfg.start_on_boot || false, path: app.getPath('exe') });
    });

    ipcMain.on('get-config', (event) => { event.returnValue = cfg; });
    app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}