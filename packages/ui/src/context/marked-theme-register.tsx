import { registerCustomTheme } from "@pierre/diffs"
import { LoongcodeTheme } from "./marked-theme"

let registered = false

export function registerLoongcodeTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("Loongcode", () => Promise.resolve(LoongcodeTheme))
}
