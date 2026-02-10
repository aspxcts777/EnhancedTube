const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    
    let cfg = {};
    try {
        cfg = ipcRenderer.sendSync('get-config');
    } catch (e) { console.error("Could not fetch config:", e); }

    const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = true; 

    if (cfg.theme_mode === 'light') isDark = false;
    else if (cfg.theme_mode === 'system') isDark = isSystemDark;

    const barBg = isDark ? '#000000' : '#ffffff';
    const barText = isDark ? '#ffffff' : '#000000';
    const barBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';

    // --- 1. Custom Title Bar ---
    const titleBar = document.createElement('div');
    titleBar.id = 'title-bar'; 
    titleBar.style.cssText = `
        width: 100%;
        height: 32px;
        background: ${barBg};
        display: flex;
        align-items: center;
        padding-left: 10px;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 999999;
        -webkit-app-region: drag;
        border-bottom: ${barBorder};
        transition: background 0.3s ease;
    `;

    const menuBtn = document.createElement('button');
    menuBtn.innerText = 'EnhancedTube';
    menuBtn.id = 'menu-btn';
    menuBtn.style.cssText = `
        background: transparent;
        color: ${barText};
        border: none;
        cursor: pointer;
        font-family: 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        -webkit-app-region: no-drag;
        padding: 5px 10px;
        margin-right: 10px;
        opacity: 0.9;
    `;
    
    menuBtn.onclick = () => {
        ipcRenderer.send('show-context-menu');
    };

    titleBar.appendChild(menuBtn);
    document.body.prepend(titleBar);

});