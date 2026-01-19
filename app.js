const { app, BrowserWindow, Menu, ipcMain, shell, systemPreferences, nativeTheme, nativeImage, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { mainMenu } = require('./contextmenu');
const { loadConfig, saveConfig } = require('./config'); 
const { getThemeCss, getThemeJs } = require('./theme'); 

const appId = 'com.aspxcts.enhancedtube';
app.setAppUserModelId(appId);
app.setName('EnhancedTube');

// --- 1. IDENTITIES ---
// Desktop: Used for the main app (looks like Chrome on Mac/Windows)
const USER_AGENT_DESKTOP = process.platform === 'darwin' 
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Mobile: Used ONLY for the login popup (looks like Android)
const USER_AGENT_MOBILE = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

// Set global default
app.userAgentFallback = USER_AGENT_DESKTOP;

// --- 2. STEALTH FLAGS ---
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-site-isolation-trials');

// --- 3. PROTOCOL ---
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
    let mainWindow;
    let loginWindow = null; // Track the special login window
    let aboutWindow = null;
    let optionsWindow = null;
    let appearanceWindow = null;
    let isPlaying = false; 
    let cfg = loadConfig();

    // --- SECOND INSTANCE ---
    app.on('second-instance', (event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            const url = commandLine.find(arg => arg.startsWith('enhancedtube://'));
            if (url) loadDeepLink(url);
        }
    });

    // --- CONFIG FLAGS ---
    if (cfg.theme_mode === 'dark') nativeTheme.themeSource = 'dark';
    else if (cfg.theme_mode === 'light') nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'system';
    if (cfg.use_av1) app.commandLine.appendSwitch('enable-features', 'AV1');
    if (cfg.UseSkiaRenderer) app.commandLine.appendSwitch('enable-skia-renderer');
    if (cfg.use_vaapi) { app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder'); app.commandLine.appendSwitch('enable-accelerated-video-decode'); }
    if (cfg.force_angle_d3d11) app.commandLine.appendSwitch('use-angle', 'd3d11');
    if (cfg.enable_gpu) { app.commandLine.appendSwitch('enable-gpu-rasterization'); app.commandLine.appendSwitch('enable-accelerated-2d-canvas'); }
    if (cfg.enable_zero_copy) app.commandLine.appendSwitch('enable-zero-copy');

    // --- HELPERS ---
    function getIcon(name) {
        const iconPath = path.join(__dirname, 'assets', `${name}.png`);
        try {
            let img = nativeImage.createFromPath(iconPath);
            return img.isEmpty() ? null : img.resize({ width: 32, height: 32 }); 
        } catch (e) { return null; }
    }

    function updateThumbar() {
        if (!mainWindow) return;
        if (process.platform !== 'win32') return;

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
        targetUrl = targetUrl.replace(/([^:]\/)\/+/g, "$1");
        if (targetUrl === 'https://www.youtube.com' || targetUrl === 'https://www.youtube.com/') targetUrl = 'https://www.youtube.com';
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) mainWindow.loadURL(targetUrl);
    }

    function injectTheme() {
        if (!mainWindow) return;
        let accent = cfg.text_color || "#ff0000";
        if (cfg.sync_theme && process.platform === 'win32') {
            let sysColor = systemPreferences.getAccentColor(); 
            if (sysColor && sysColor.substring(0, 6) !== "000000") accent = '#' + sysColor.substring(0, 6);
        }
        let isDark = (cfg.theme_mode === 'light') ? false : true;
        mainWindow.webContents.insertCSS(getThemeCss(cfg, accent, isDark)).catch(e => {});
        mainWindow.webContents.executeJavaScript(getThemeJs(accent)).catch(e => {});
    }

    // --- SPECIAL LOGIN WINDOW HANDLER ---
    function openLoginWindow(targetUrl) {
        if (loginWindow) {
            loginWindow.focus();
            return;
        }

        loginWindow = new BrowserWindow({
            width: 500, height: 700,
            title: "Sign In - EnhancedTube",
            parent: mainWindow, modal: true,
            icon: path.join(__dirname, 'icon.ico'),
            webPreferences: { 
                nodeIntegration: false, 
                contextIsolation: true,
                // REMOVED 'partition' so it shares cookies with the main window automatically
                sandbox: false
            }
        });

        // 1. Force Mobile Identity
        loginWindow.webContents.setUserAgent(USER_AGENT_MOBILE);
        loginWindow.setMenu(null);
        loginWindow.loadURL(targetUrl);

        // 2. Watch for GENUINE success
        loginWindow.webContents.on('did-navigate', (event, url) => {
            // Check if we have landed on the Home Page
            // (Mobile usually redirects to m.youtube.com, Desktop to www.youtube.com)
            const isHome = url === 'https://www.youtube.com/' || 
                           url === 'https://m.youtube.com/' || 
                           url.startsWith('https://www.youtube.com/?') ||
                           url.startsWith('https://m.youtube.com/?');

            // If we are home, and NOT on a login/account page...
            if (isHome && !url.includes('login') && !url.includes('account')) {
                setTimeout(() => {
                    if (loginWindow) {
                        loginWindow.close();
                        mainWindow.reload(); // Reload main app to apply login
                    }
                }, 1500); // Increased wait to 1.5s to ensure cookies are written to disk
            }
        });

        loginWindow.on('closed', () => { loginWindow = null; });
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

    // --- APP READY ---
    app.whenReady().then(async () => {
        
        // 1. GLOBAL HEADER STRIPPING
        // We do NOT set User-Agent here anymore. We let the Window decide that.
        // We only use this to delete the "I am Electron" flags.
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            delete details.requestHeaders['Sec-CH-UA'];
            delete details.requestHeaders['Sec-CH-UA-Mobile'];
            delete details.requestHeaders['Sec-CH-UA-Platform'];
            delete details.requestHeaders['Sec-CH-UA-Model'];
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        });

        // 2. CREATE MAIN WINDOW
        mainWindow = new BrowserWindow({
            width: 1280, height: 720, title: "EnhancedTube",
            backgroundColor: cfg.oled ? '#000000' : '#0f0f0f',
            icon: path.join(__dirname, 'icon.ico'),
            webPreferences: { nodeIntegration: false, contextIsolation: true },
            alwaysOnTop: cfg.always_on_top || false
        });

        // 3. SET DESKTOP IDENTITY
        mainWindow.webContents.setUserAgent(USER_AGENT_DESKTOP);
        app.setLoginItemSettings({ openAtLogin: cfg.start_on_boot || false, path: app.getPath('exe') });
        Menu.setApplicationMenu(mainMenu);

        // 4. LOAD APP
        let startUrl = 'https://www.youtube.com';
        if (process.platform === 'win32' && process.argv.length >= 2) {
            const deepLink = process.argv.find(arg => arg.startsWith('enhancedtube://'));
            if (deepLink) startUrl = deepLink.replace('enhancedtube://', 'https://');
        }
        mainWindow.loadURL(startUrl);

        mainWindow.webContents.on('will-navigate', (event, url) => {
            const urlLower = url.toLowerCase();
            const isGoogleLogin = url.includes('accounts.google.com') || url.includes('accounts.youtube.com');
            const isSessionManagement = 
                urlLower.includes('logout') || 
                urlLower.includes('signout') ||
                urlLower.includes('setsid') || 
                urlLower.includes('clearsid');

            if (isGoogleLogin && !isSessionManagement) {
                event.preventDefault();
                openLoginWindow(url);
            }
        });

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            const urlLower = url.toLowerCase();
            const isGoogleLogin = url.includes('accounts.google.com') || url.includes('accounts.youtube.com');
            const isSessionManagement = 
                urlLower.includes('logout') || 
                urlLower.includes('signout') ||
                urlLower.includes('setsid') || 
                urlLower.includes('clearsid');

            // 1. Login Popups -> Open in Mobile Window (BUT NOT if logging out)
            if (isGoogleLogin && !isSessionManagement) {
                openLoginWindow(url);
                return { action: 'deny' };
            }

            // 2. Redirects -> Open in Browser
            if (url.includes('youtube.com/redirect')) { 
                shell.openExternal(url); 
                return { action: 'deny' }; 
            }

            // 3. External Links -> Open in Browser
            if (!url.includes('youtube.com') && !url.includes('youtu.be')) { 
                shell.openExternal(url); 
                return { action: 'deny' }; 
            }
            
            return { action: 'allow' };
        });

        mainWindow.webContents.on('did-finish-load', () => { injectTheme(); updateThumbar(); });

        // ... (Keep existing Playback Polling, Taskbar, and IPC handlers) ...
        setInterval(async () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            try {
                const playing = await mainWindow.webContents.executeJavaScript(`!!(document.querySelector('video') && !document.querySelector('video').paused && !document.querySelector('video').ended)`);
                if (playing !== isPlaying) { isPlaying = playing; updateThumbar(); }
            } catch (e) {}
        }, 500); 

        if (process.platform === 'win32') {
            app.setUserTasks([
                { program: process.execPath, arguments: 'enhancedtube://www.youtube.com/feed/subscriptions', iconPath: process.execPath, iconIndex: 0, title: 'Subscriptions', description: 'Go to Subscriptions' },
                { program: process.execPath, arguments: 'enhancedtube://www.youtube.com/feed/library', iconPath: process.execPath, iconIndex: 0, title: 'Library', description: 'Go to Library' }
            ]);
        }

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
        setInterval(async () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            try {
                // Returns true ONLY if a video exists AND is playing
                const playing = await mainWindow.webContents.executeJavaScript(
                    `!!(document.querySelector('video') && !document.querySelector('video').paused && !document.querySelector('video').ended)`
                );
                
                // Only update the buttons if the state has changed
                if (playing !== isPlaying) {
                    isPlaying = playing;
                    updateThumbar();
                }
            } catch (e) {}
        }, 500);
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