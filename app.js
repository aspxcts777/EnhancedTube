const { setupTitlebar, attachTitlebarToWindow } = require("custom-electron-titlebar/main");
const { app, BrowserWindow, Menu, ipcMain, shell, session, systemPreferences, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { mainMenu } = require('./contextmenu');
const { loadConfig, saveConfig } = require('./config');
const { getThemeCss, getThemeJs } = require('./theme'); 

// --- 1. CONFIG & FLAGS ---
const appID = 'com.aspxcts.enhancedtube';
app.setAppUserModelId(appID);
app.setName('EnhancedTube');
let cfg = loadConfig();
setupTitlebar();

// FORCE THEME MODE AT STARTUP
if (cfg.theme_mode === 'dark') nativeTheme.themeSource = 'dark';
else if (cfg.theme_mode === 'light') nativeTheme.themeSource = 'light';
else nativeTheme.themeSource = 'system';

// Performance Flags
if (cfg.use_av1) app.commandLine.appendSwitch('enable-features', 'AV1');
if (cfg.UseSkiaRenderer) app.commandLine.appendSwitch('enable-skia-renderer');
if (cfg.use_vaapi) {
    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
    app.commandLine.appendSwitch('enable-accelerated-video-decode');
}
if (cfg.force_angle_d3d11) app.commandLine.appendSwitch('use-angle', 'd3d11');
if (cfg.enable_gpu) {
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
}
if (cfg.enable_zero_copy) app.commandLine.appendSwitch('enable-zero-copy');
if (cfg.ignore_gpu_blocklist) app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (cfg.enable_quic) app.commandLine.appendSwitch('enable-quic');

let mainWindow;
// Track open windows
let aboutWindow = null;
let optionsWindow = null;
let appearanceWindow = null;

// --- 2. THEME INJECTION ---
function injectTheme() {
    if (!mainWindow) return;

    // A. Determine Accent Color
    let accent = cfg.text_color || "#ff0000";
    if (cfg.sync_theme && process.platform === 'win32') {
        accent = '#' + systemPreferences.getAccentColor();
    }

    // B. Determine Mode (Dark/Light)
    let isDark = true;
    if (cfg.theme_mode === 'light') isDark = false;
    else if (cfg.theme_mode === 'system') isDark = nativeTheme.shouldUseDarkColors;
    
    // C. Get CSS & JS Content
    const cssContent = getThemeCss(cfg, accent, isDark);
    const themeJsContent = getThemeJs(accent); 

    // D. Inject Everything
    const js = `
        (function() {
            // 1. Inject CSS
            let styleId = "eyt-style";
            let old = document.getElementById(styleId);
            if (old) old.remove();
            let s = document.createElement("style");
            s.id = styleId;
            s.textContent = ${JSON.stringify(cssContent)};
            (document.head || document.documentElement).appendChild(s);
            
            // 2. Inject JS Hunter
            ${themeJsContent}
        })();
    `;

    mainWindow.webContents.executeJavaScript(js).catch(e => console.log("Theme Error:", e));
}

// --- 3. HELPER: Apply Theme Mode Logic ---
function applyThemeMode(mode) {
    if (mode === 'dark') nativeTheme.themeSource = 'dark';
    else if (mode === 'light') nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'system';
}

// --- 4. SHORTS REDIRECT ---
function handleUrlChange(event, url) {
    if (cfg.replace_shorts && url.includes('/shorts/')) {
        const videoId = url.split('/shorts/')[1].split('?')[0];
        mainWindow.loadURL(`https://www.youtube.com/watch?v=${videoId}`);
    }
}

// --- 5. WINDOW POPUP HELPER ---
function createPopup(file, width, height, title) {
    const win = new BrowserWindow({
        width, height, title,
        parent: mainWindow, modal: true, autoHideMenuBar: true, resizable: false,
        backgroundColor: '#000000',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    win.loadFile(file);
    return win;
}

// --- 6. MAIN APP LIFECYCLE ---
app.whenReady().then(() => {
    
    const userAgent = 'Chrome';
    mainWindow = new BrowserWindow({
        width: 1280, height: 720, title: "EnhancedTube",
        backgroundColor: cfg.oled ? '#000000' : '#0f0f0f',
        icon: path.join(__dirname, 'icon.ico'), 
        webPreferences: { nodeIntegration: false, contextIsolation: true },
        alwaysOnTop: cfg.always_on_top || false,
        webPreferences: {
        sandbox: false,
    }
    });
    mainWindow.webContents.setUserAgent(userAgent);
    app.setLoginItemSettings({ openAtLogin: cfg.start_on_boot || false, path: app.getPath('exe') });
    Menu.setApplicationMenu(mainMenu);
    mainWindow.loadURL('https://www.youtube.com');

    // Events
    mainWindow.webContents.on('did-finish-load', injectTheme);
    mainWindow.webContents.on('will-navigate', handleUrlChange);
    mainWindow.webContents.on('did-navigate-in-page', handleUrlChange);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.includes('youtube.com')) { shell.openExternal(url); return { action: 'deny' }; }
        return { action: 'allow' };
    });

    // Listen for System Theme Changes
    nativeTheme.on('updated', () => {
        if (cfg.theme_mode === 'system') injectTheme();
    });

    // --- WINDOW OPENING LISTENERS ---
    mainWindow.on('open-appearance', () => { 
        if (appearanceWindow) { appearanceWindow.focus(); return; }
        appearanceWindow = createPopup('appearance.html', 400, 600, 'Appearance');
        appearanceWindow.on('closed', () => { appearanceWindow = null; });
    });

    mainWindow.on('open-options', () => { 
        if (optionsWindow) { optionsWindow.focus(); return; }
        optionsWindow = createPopup('options.html', 450, 650, 'Options');
        optionsWindow.on('closed', () => { optionsWindow = null; });
    });

    mainWindow.on('open-about', () => { 
        if (aboutWindow) { aboutWindow.focus(); return; }
        aboutWindow = createPopup('about.html', 400, 400, 'About');
        aboutWindow.on('closed', () => { aboutWindow = null; });
    });
    
    mainWindow.on('closed', () => { 
        appearanceWindow = null; optionsWindow = null; aboutWindow = null; 
    });
});

// --- 7. IPC HANDLERS ---
ipcMain.handle('get-system-accent', () => {
    return process.platform === 'win32' ? '#' + systemPreferences.getAccentColor() : '#ff0000';
});

// Save Settings Handler
ipcMain.on('save-appearance', (event, newCfg) => {
    cfg = { ...cfg, ...newCfg };
    saveConfig(cfg);

    // 1. Force Browser Mode (fixes Light Mode bug)
    applyThemeMode(cfg.theme_mode);

    if (mainWindow) {
        mainWindow.setAlwaysOnTop(cfg.always_on_top || false);
        
        // 2. RELOAD PAGE (The Fix)
        // This ensures YouTube re-reads the Light/Dark mode setting properly
        mainWindow.reload(); 
    }
    app.setLoginItemSettings({ openAtLogin: cfg.start_on_boot || false, path: app.getPath('exe') });
});

ipcMain.on('get-config', (event) => { event.returnValue = cfg; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });