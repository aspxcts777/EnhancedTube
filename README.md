# EnhancedTube

**EnhancedTube** is a powerful, customizable, and high-performance YouTube desktop client built with Electron. It enhances the standard YouTube experience with advanced theming, built-in ad management, performance tuning, and desktop-native features.

## 📥 Download

Get the latest installer for Windows, Linux and MacOS:
**[Download Latest Release](https://github.com/Aspxcts777/EnhancedTube/releases)**

---

## 🚀 Features

### 🎨 Custom Appearance & Theming

* **Dynamic Accent Colors:** Change the default YouTube "Red" to any color you like.
* **OLED Mode:** A "True Black" mode optimized for OLED screens to save battery and reduce eye strain.
* **Theme Synchronization:** Automatically syncs with your system's Light/Dark mode preferences.

### 🚫 Enhanced Ad Management ("Ad Nuke")

* **Auto-Skip:** Automatically clicks "Skip Ad" buttons the instant they appear.
* **Overlay Removal:** Closes popup banner ads automatically.
* **Speed-Up:** Detects unskippable video ads and accelerates them (16x speed) while muting audio, effectively skipping them.

### ⚡ Performance & Optimization

Accessible via the **Options** menu, you can toggle advanced Electron flags to squeeze the most out of your hardware:

* **Hardware Acceleration:** Enable VAAPI and GPU Rasterization.
* **AV1 Codec Support:** Toggle support for the efficient AV1 video codec.
* **Zero Copy:** Optimizes memory usage during video playback.
* **QUIC Protocol:** Enables experimental QUIC protocol support for potentially faster loading.

### 🖥️ Desktop Integration

* **Always on Top:** Keep the player visible while you work in other windows.
* **Start on Boot:** Option to launch EnhancedTube automatically when your computer starts.
* **Native Context Menu:** Quickly access Appearance, Options, and Navigation tools via right-click.
* **Shorts Control:** Toggle options to replace or manage YouTube Shorts (configurable in Options).

## 🛠️ Installation & Build

### Prerequisites

* [Node.js](https://nodejs.org/) (v14 or later recommended)
* npm (comes with Node.js)

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/Aspxcts777/EnhancedTube.git
cd EnhancedTube

```


2. Install dependencies:
```bash
npm install

```


3. Start the application:
```bash
npm start

```



### Building for Production

To create a standalone executable (installer) for your system (Windows/macOS/Linux):

```bash
npm run dist

```

The output files (e.g., `.exe` installer) will be located in the `dist/` folder.

## ⚙️ Configuration

You can access the settings menus by **Right-Clicking** anywhere in the app or using the **App Menu** in the top left.

* **Appearance:** Manage colors, OLED mode, and theme syncing.
* **Options:** Manage performance flags, ad-blocker settings, and startup behavior.

## 🤝 Credits

* **Created by:** [Aspxcts777](https://github.com/Aspxcts777)
* **Built with:** [Electron](https://www.electronjs.org/)

## 📄 License

This project is licensed under the MIT License.

EnhancedTube
Copyright (c) 2026 Aspxcts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

Any Person or User who is sharing this project must credit Aspxcts (Aspxcts777) 
with proper credits including linking the original project.

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
