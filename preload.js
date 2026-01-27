const { contextBridge, ipcRenderer } = require('electron');

// Wait for the page to load
window.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inject the Button CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #et-fab {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            background-color: #212121; /* Dark background */
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 50%;
            z-index: 9999;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, background-color 0.2s;
        }
        #et-fab:hover {
            transform: scale(1.1);
            background-color: #ff0000; /* Default Red Accent */
        }
    `;
    document.head.appendChild(style);

    // 2. Create the Button Element
    const btn = document.createElement('div');
    btn.id = 'et-fab';
    // Using an SVG Icon (Hamburger Menu)
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

    // 3. Handle Click (Send Signal to Main App)
    btn.onclick = () => {
        ipcRenderer.send('show-app-menu');
    };

    // 4. Append to Body
    document.body.appendChild(btn);

    // 5. Update Accent Color (Optional: Listen for theme changes from Main)
    ipcRenderer.on('update-accent', (event, color) => {
        const styleTag = document.getElementById('et-accent-style');
        if (styleTag) styleTag.remove();
        const newStyle = document.createElement('style');
        newStyle.id = 'et-accent-style';
        newStyle.innerHTML = `#et-fab:hover { background-color: ${color} !important; }`;
        document.head.appendChild(newStyle);
    });
});