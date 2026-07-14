<p align="center">
  <a href="https://modelhub.lgdg.cc">
    <img src="https://raw.githubusercontent.com/Clearlove7Zz/LoongCode/dev/packages/console/app/src/asset/logo-ornate-light.png" alt="Loongcode logo">
  </a>
</p>
<p align="center">AI-powered development tool by Loongcode.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/loongcode"><img alt="npm" src="https://img.shields.io/npm/v/loongcode?style=flat-square" /></a>
  <a href="https://github.com/Clearlove7Zz/LoongCode/releases"><img alt="Release" src="https://img.shields.io/github/v/release/Clearlove7Zz/LoongCode?style=flat-square" /></a>
</p>

<p align="center">
  English |
  <a href="README.zh.md">简体中文</a>
</p>

[![Loongcode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://modelhub.lgdg.cc)

---

### Installation

```bash
# YOLO
curl -fsSL https://modelhub.lgdg.cc/install | bash

# Package managers
npm i -g loongcode@latest        # or bun/pnpm/yarn
scoop install loongcode             # Windows
choco install loongcode             # Windows
brew install Clearlove7Zz/tap/loongcode # macOS and Linux (recommended, always up to date)
brew install loongcode              # macOS and Linux (official brew formula, updated less)
sudo pacman -S loongcode            # Arch Linux (Stable)
paru -S loongcode-bin               # Arch Linux (Latest from AUR)
mise use -g loongcode               # Any OS
nix run nixpkgs#loongcode           # or github:Clearlove7Zz/LoongCode for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

Loongcode is also available as a desktop application. Download directly from the [releases page](https://github.com/Clearlove7Zz/LoongCode/releases) or [modelhub.lgdg.cc/download](https://modelhub.lgdg.cc/download).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `loongcode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `loongcode-desktop-mac-x64.dmg`     |
| Windows               | `loongcode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

```bash
# macOS (Homebrew)
brew install --cask loongcode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/loongcode-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$LOONGCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.loongcode/bin` - Default fallback

```bash
# Examples
LOONGCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://modelhub.lgdg.cc/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://modelhub.lgdg.cc/install | bash
```

### Agents

Loongcode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://modelhub.lgdg.cc/docs/agents).

### Documentation

For more info on how to configure Loongcode, [**head over to our docs**](https://modelhub.lgdg.cc/docs).

### Contributing

If you're interested in contributing to Loongcode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Loongcode

If you are working on a project that's related to Loongcode and is using "loongcode" as part of its name, for example "loongcode-dashboard" or "loongcode-mobile", please add a note to your README to clarify that it is not built by the Loongcode team and is not affiliated with us in any way.

---

**Join our community** [X.com](https://x.com/loongcode)
