import { registerCustomTheme } from "@pierre/diffs"
import { LoongCodeTheme } from "./marked-theme"

let registered = false

export function registerLoongCodeTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("LoongCode", () => Promise.resolve(LoongCodeTheme))
}
