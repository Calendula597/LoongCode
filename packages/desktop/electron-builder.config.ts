import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// The Electron 42 packaging update briefly installed Linux launchers/icons under
// "loongcode-desktop". Keep that hidden desktop entry around so existing GNOME/KDE
// pins still resolve after the canonical app id changes back to ai.loongcode.desktop.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "loongcode-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/loongcode-desktop.desktop`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.LOONGCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "ai.loongcode.desktop.dev",
  beta: "ai.loongcode.desktop.beta",
  prod: "ai.loongcode.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "loongcode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.loongcode.desktop" becomes
  // "ai.loongcode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
    homepage: "https://github.com/Clearlove7Zz/LoongCode",
    author: {
      name: "Loongcode",
      email: "loongcode@example.com",
    },
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
    {
      // Runtime window/dock icons are loaded from <resources>/icons (see src/main/windows.ts)
      from: "resources/icons",
      to: "icons",
      filter: ["icon.ico", "icon.png", "icon.icns", "dock.png"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.png`,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: false,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: false,
  },
  protocols: {
    name: "Loongcode",
    schemes: ["loongcode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["tar.gz"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "Loongcode Dev",
        rpm: { packageName: "loongcode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "Loongcode Beta",
        protocols: { name: "Loongcode Beta", schemes: ["loongcode"] },
        publish: { provider: "github", owner: "Calendula597", repo: "LoongCode", channel: "latest" },
        rpm: { packageName: "loongcode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "Loongcode",
        protocols: { name: "Loongcode", schemes: ["loongcode"] },
        publish: { provider: "github", owner: "Calendula597", repo: "LoongCode", channel: "latest" },
        deb: { fpm: [legacyDesktopEntryFpm] },
        rpm: { packageName: "loongcode", fpm: [legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
