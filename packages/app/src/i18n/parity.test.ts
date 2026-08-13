import { describe, expect, test } from "bun:test"
import { dict as en } from "./en"
import { dict as ar } from "./ar"
import { dict as br } from "./br"
import { dict as bs } from "./bs"
import { dict as da } from "./da"
import { dict as de } from "./de"
import { dict as es } from "./es"
import { dict as fr } from "./fr"
import { dict as ja } from "./ja"
import { dict as ko } from "./ko"
import { dict as no } from "./no"
import { dict as pl } from "./pl"
import { dict as ru } from "./ru"
import { dict as uk } from "./uk"
import { dict as th } from "./th"
import { dict as tr } from "./tr"
import { dict as zh } from "./zh"
import { dict as zht } from "./zht"

const englishLocales: ReadonlyArray<Record<string, string>> = [ar, br, bs, da, de, es, fr, ja, ko, no, pl, ru, uk, th, tr]
const locales = [...englishLocales] as const

// The marketplace panel is fully localized only for Chinese (zh/zh-TW). The
// other locales fall back to English. Keys that are identical by design are
// excluded from the "differs from English" assertion: the API-key sample and
// the repo URL placeholder are the same string in every locale.
const cnLocales: Record<string, string>[] = [zh, zht]

const enRecord = en as Record<string, string>

const cnSameByDesign = new Set([
  "settings.skills.skillhub.dialog.placeholder",
  "settings.skills.repoPlaceholder",
])

const skillsKeys = Object.keys(enRecord).filter(
  (key) => key.startsWith("settings.skills.") && !cnSameByDesign.has(key),
)

describe("i18n parity", () => {
  test("non-Chinese locales define every marketplace skills key", () => {
    for (const locale of locales) {
      for (const key of skillsKeys) {
        expect(locale[key], `${key} missing`).toBeDefined()
      }
    }
  })

  test("Chinese locales translate marketplace skills strings", () => {
    for (const locale of cnLocales) {
      for (const key of skillsKeys) {
        expect(locale[key], `${key} should be translated in Chinese`).not.toBe(enRecord[key])
      }
    }
  })
})