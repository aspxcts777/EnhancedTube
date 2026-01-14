const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const configPath = path.join(app.getPath('userData'), 'config.json');

const defaults = {
    bar_color: "#0f0f0f",
    text_color: "#00aeff",
    oled: true
};

function loadConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            saveConfig(defaults);
            return defaults;
        }
        return JSON.parse(fs.readFileSync(configPath));
    } catch (e) {
        return defaults;
    }
}

function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 4));
}

module.exports = { loadConfig, saveConfig };