import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const legacyDesktopEntry = "resources/linux/loongcode-desktop.desktop"

const channels = [
  { channel: "dev", appId: "ai.loongcode.desktop.dev" },
  { channel: "beta", appId: "ai.loongcode.desktop.beta" },
  { channel: "prod", appId: "ai.loongcode.desktop" },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.LOONGCODE_CHANNEL
    process.env.LOONGCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.LOONGCODE_CHANNEL
    else process.env.LOONGCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.rpm?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
  })
}

test("keeps a hidden prod launcher for old Linux pins", async () => {
  const previous = process.env.LOONGCODE_CHANNEL
  process.env.LOONGCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?compat=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.LOONGCODE_CHANNEL
  else process.env.LOONGCODE_CHANNEL = previous

  expect(
    config.deb?.fpm?.some((entry) =>
      entry.endsWith("loongcode-desktop.desktop=/usr/share/applications/loongcode-desktop.desktop"),
    ),
  ).toBe(true)
  expect(
    config.rpm?.fpm?.some((entry) =>
      entry.endsWith("loongcode-desktop.desktop=/usr/share/applications/loongcode-desktop.desktop"),
    ),
  ).toBe(true)

  const desktop = await Bun.file(legacyDesktopEntry).text()
  expect(desktop).toContain("Exec=/opt/Loongcode/ai.loongcode.desktop %U")
  expect(desktop).toContain("Icon=ai.loongcode.desktop")
  expect(desktop).toContain("StartupWMClass=ai.loongcode.desktop")
  expect(desktop).toContain("NoDisplay=true")
})
