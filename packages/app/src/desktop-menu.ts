import type { Dictionary } from "@/context/language"

export type DesktopMenuPlatform = "macos" | "windows"

export type DesktopMenuLabelKey = keyof Dictionary

export type DesktopMenuAction =
  | "app.checkForUpdates"
  | "app.relaunch"
  | "edit.undo"
  | "edit.redo"
  | "edit.cut"
  | "edit.copy"
  | "edit.paste"
  | "edit.delete"
  | "edit.selectAll"
  | "view.reload"
  | "view.toggleDevTools"
  | "view.resetZoom"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.toggleFullscreen"
  | "window.new"
  | "window.close"
  | "window.minimize"
  | "window.toggleMaximize"

export type DesktopMenuRole =
  | "about"
  | "close"
  | "copy"
  | "cut"
  | "hide"
  | "hideOthers"
  | "paste"
  | "quit"
  | "redo"
  | "reload"
  | "resetZoom"
  | "selectAll"
  | "toggleDevTools"
  | "togglefullscreen"
  | "undo"
  | "unhide"
  | "windowMenu"
  | "zoomIn"
  | "zoomOut"

export type DesktopMenuItem = {
  type: "item"
  label?: string
  labelKey?: DesktopMenuLabelKey
  command?: string
  action?: DesktopMenuAction
  role?: DesktopMenuRole
  href?: string
  accelerator?: Partial<Record<DesktopMenuPlatform, string>>
  enabled?: "updater"
  platforms?: DesktopMenuPlatform[]
}

export type DesktopMenuSeparator = {
  type: "separator"
  platforms?: DesktopMenuPlatform[]
}

export type DesktopMenuEntry = DesktopMenuItem | DesktopMenuSeparator

export type DesktopMenu = {
  id: string
  label: string
  labelKey?: DesktopMenuLabelKey
  role?: DesktopMenuRole
  items?: DesktopMenuEntry[]
  platforms?: DesktopMenuPlatform[]
}

export const DESKTOP_MENU: DesktopMenu[] = [
  {
    id: "app",
    label: "Loongcode",
    platforms: ["macos"],
    items: [
      { type: "item", role: "about" },
      {
        type: "item",
        label: "Check for Updates...",
        labelKey: "desktopMenu.app.checkForUpdates",
        action: "app.checkForUpdates",
        enabled: "updater",
      },
      {
        type: "item",
        label: "Settings",
        labelKey: "desktopMenu.app.settings",
        command: "settings.open",
        accelerator: { macos: "Cmd+," },
      },
      { type: "item", label: "Reload Webview", labelKey: "desktopMenu.app.reloadWebview", action: "view.reload" },
      { type: "item", label: "Restart", labelKey: "desktopMenu.app.restart", action: "app.relaunch" },
      { type: "item", label: "Export Logs...", labelKey: "desktopMenu.app.exportLogs", command: "logs.export" },
      { type: "separator" },
      { type: "item", role: "hide" },
      { type: "item", role: "hideOthers" },
      { type: "item", role: "unhide" },
      { type: "separator" },
      { type: "item", role: "quit" },
    ],
  },
  {
    id: "file",
    label: "File",
    labelKey: "desktopMenu.file",
    items: [
      {
        type: "item",
        label: "New Session",
        labelKey: "desktopMenu.file.newSession",
        command: "session.new",
        accelerator: { macos: "Shift+Cmd+S" },
      },
      {
        type: "item",
        label: "Open Project...",
        labelKey: "desktopMenu.file.openProject",
        command: "project.open",
        accelerator: { macos: "Cmd+O" },
      },
      {
        type: "item",
        label: "Settings",
        labelKey: "desktopMenu.file.settings",
        command: "settings.open",
        accelerator: { windows: "Ctrl+," },
        platforms: ["windows"],
      },
      {
        type: "item",
        label: "New Window",
        labelKey: "desktopMenu.file.newWindow",
        action: "window.new",
        accelerator: { macos: "Cmd+Shift+N", windows: "Ctrl+Shift+N" },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Close Window",
        labelKey: "desktopMenu.file.closeWindow",
        action: "window.close",
        role: "close",
      },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    labelKey: "desktopMenu.edit",
    items: [
      {
        type: "item",
        label: "Undo",
        labelKey: "desktopMenu.edit.undo",
        action: "edit.undo",
        role: "undo",
        accelerator: { windows: "Ctrl+Z" },
      },
      {
        type: "item",
        label: "Redo",
        labelKey: "desktopMenu.edit.redo",
        action: "edit.redo",
        role: "redo",
        accelerator: { windows: "Ctrl+Y" },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Cut",
        labelKey: "desktopMenu.edit.cut",
        action: "edit.cut",
        role: "cut",
        accelerator: { windows: "Ctrl+X" },
      },
      {
        type: "item",
        label: "Copy",
        labelKey: "desktopMenu.edit.copy",
        action: "edit.copy",
        role: "copy",
        accelerator: { windows: "Ctrl+C" },
      },
      {
        type: "item",
        label: "Paste",
        labelKey: "desktopMenu.edit.paste",
        action: "edit.paste",
        role: "paste",
        accelerator: { windows: "Ctrl+V" },
      },
      { type: "item", label: "Delete", labelKey: "desktopMenu.edit.delete", action: "edit.delete" },
      {
        type: "item",
        label: "Select All",
        labelKey: "desktopMenu.edit.selectAll",
        action: "edit.selectAll",
        role: "selectAll",
        accelerator: { windows: "Ctrl+A" },
      },
    ],
  },
  {
    id: "view",
    label: "View",
    labelKey: "desktopMenu.view",
    items: [
      {
        type: "item",
        label: "Toggle Sidebar",
        labelKey: "desktopMenu.view.toggleSidebar",
        command: "sidebar.toggle",
        accelerator: { macos: "Cmd+B" },
      },
      {
        type: "item",
        label: "Toggle Terminal",
        labelKey: "desktopMenu.view.toggleTerminal",
        command: "terminal.toggle",
        accelerator: { macos: "Ctrl+`" },
      },
      {
        type: "item",
        label: "Toggle File Tree",
        labelKey: "desktopMenu.view.toggleFileTree",
        command: "fileTree.toggle",
      },
      { type: "separator" },
      { type: "item", label: "Reload", labelKey: "desktopMenu.view.reload", action: "view.reload", role: "reload" },
      {
        type: "item",
        label: "Toggle Developer Tools",
        labelKey: "desktopMenu.view.toggleDevTools",
        action: "view.toggleDevTools",
        role: "toggleDevTools",
      },
      { type: "separator" },
      {
        type: "item",
        label: "Actual Size",
        labelKey: "desktopMenu.view.actualSize",
        action: "view.resetZoom",
        role: "resetZoom",
        accelerator: { windows: "Ctrl+0" },
      },
      {
        type: "item",
        label: "Zoom In",
        labelKey: "desktopMenu.view.zoomIn",
        action: "view.zoomIn",
        role: "zoomIn",
        accelerator: { windows: "Ctrl++" },
      },
      {
        type: "item",
        label: "Zoom Out",
        labelKey: "desktopMenu.view.zoomOut",
        action: "view.zoomOut",
        role: "zoomOut",
        accelerator: { windows: "Ctrl+-" },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Toggle Full Screen",
        labelKey: "desktopMenu.view.toggleFullScreen",
        action: "view.toggleFullscreen",
        role: "togglefullscreen",
      },
    ],
  },
  {
    id: "go",
    label: "Go",
    labelKey: "desktopMenu.go",
    items: [
      {
        type: "item",
        label: "Back",
        labelKey: "desktopMenu.go.back",
        command: "common.goBack",
        accelerator: { macos: "Cmd+[" },
      },
      {
        type: "item",
        label: "Forward",
        labelKey: "desktopMenu.go.forward",
        command: "common.goForward",
        accelerator: { macos: "Cmd+]" },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Previous Session",
        labelKey: "desktopMenu.go.previousSession",
        command: "session.previous",
        accelerator: { macos: "Option+Up" },
      },
      {
        type: "item",
        label: "Next Session",
        labelKey: "desktopMenu.go.nextSession",
        command: "session.next",
        accelerator: { macos: "Option+Down" },
      },
      { type: "separator" },
      {
        type: "item",
        label: "Previous Project",
        labelKey: "desktopMenu.go.previousProject",
        command: "project.previous",
        accelerator: { macos: "Cmd+Option+Up" },
      },
      {
        type: "item",
        label: "Next Project",
        labelKey: "desktopMenu.go.nextProject",
        command: "project.next",
        accelerator: { macos: "Cmd+Option+Down" },
      },
    ],
  },
  {
    id: "window",
    label: "Window",
    labelKey: "desktopMenu.window",
    role: "windowMenu",
    items: [
      { type: "item", label: "Minimize", labelKey: "desktopMenu.window.minimize", action: "window.minimize" },
      {
        type: "item",
        label: "Maximize",
        labelKey: "desktopMenu.window.maximize",
        action: "window.toggleMaximize",
      },
      { type: "separator" },
      { type: "item", label: "Close Window", labelKey: "desktopMenu.window.closeWindow", action: "window.close" },
    ],
  },
  {
    id: "help",
    label: "Help",
    labelKey: "desktopMenu.help",
    items: [
      {
        type: "item",
        label: "Loongcode Documentation",
        labelKey: "desktopMenu.help.documentation",
        href: "https://modelhub.lgdg.cc/docs",
      },
      {
        type: "item",
        label: "Support Forum",
        labelKey: "desktopMenu.help.supportForum",
        href: "https://discord.com/invite/loongcode",
      },
      { type: "item", label: "Export Logs...", labelKey: "desktopMenu.help.exportLogs", command: "logs.export" },
      { type: "separator" },
      {
        type: "item",
        label: "Share Feedback",
        labelKey: "desktopMenu.help.shareFeedback",
        href: "https://github.com/Clearlove7Zz/LoongCode/issues/new?template=feature_request.yml",
      },
      {
        type: "item",
        label: "Report a Bug",
        labelKey: "desktopMenu.help.reportBug",
        href: "https://github.com/Clearlove7Zz/LoongCode/issues/new?template=bug_report.yml",
      },
    ],
  },
]

export function desktopMenuVisible(item: { platforms?: DesktopMenuPlatform[] }, platform: DesktopMenuPlatform) {
  return !item.platforms || item.platforms.includes(platform)
}
