#!/bin/bash
set -e
export PATH=/c/Users/lenovo/.bun/bin:$PATH
export LOONGCODE_CHANNEL=prod
cd packages/desktop
echo "=== Step 2: electron-vite build ==="
bun run build
echo "=== Step 3: electron-builder package:win ==="
bun run package:win
echo "=== Done ==="
ls -la dist/loongcode-desktop-win-x64.exe 2>/dev/null || echo "Installer not found in dist/"
