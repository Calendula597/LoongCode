const list = await fetch("http://127.0.0.1:9222/json").then((r) => r.json())
const page = list.find((t) => t.type === "page" && t.url.includes("5173"))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, resolve)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
const evaluate = async (expr) => {
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
  if (res.result?.exceptionDetails) console.log("EX:", JSON.stringify(res.result.exceptionDetails).slice(0, 300))
  return res.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send("Runtime.enable")
await send("Page.enable")
await send("Page.reload")
await sleep(6000)

await evaluate(`(() => {
  const els = [...document.querySelectorAll('button, [role="button"], div, span')].filter((el) => (el.textContent ?? "").trim() === "设置")
  if (!els.length) return "not-found"
  let el = els[0]
  while (el && el.tagName !== "BUTTON" && el.getAttribute("role") !== "button") el = el.parentElement
  ;(el ?? els[0]).click()
  return "clicked"
})()`)
await sleep(1500)

const diag = await evaluate(`(() => {
  const root = document.querySelector(".settings-v2")
  if (!root) return { present: false, body: document.body.innerText.slice(0, 200) }
  const list = root.querySelector("[data-slot='tabs-v2-list']")
  const lr = list.getBoundingClientRect()
  const cs = getComputedStyle(list)
  const wrappers = [...list.querySelectorAll("[data-slot='tabs-v2-trigger-wrapper']")].slice(0, 6).map((el) => {
    const b = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return { text: el.textContent?.trim().slice(0, 20), w: Math.round(b.width), h: Math.round(b.height), bg: s.backgroundColor, color: s.color, borderRadius: s.borderRadius }
  })
  const isDirectChild = list.parentElement === root
  return {
    present: true,
    isDirectChild,
    parentTag: list.parentElement?.tagName,
    parentAttrs: list.parentElement ? [...list.parentElement.attributes].map((a) => a.name + "=" + a.value).join(" ").slice(0, 200) : null,
    listRect: { w: Math.round(lr.width), h: Math.round(lr.height) },
    flexDir: cs.flexDirection,
    bg: cs.backgroundColor,
    padding: cs.padding,
    borderRight: cs.borderRightColor,
    wrappers,
  }
})()`)
console.log(JSON.stringify(diag, null, 2))
ws.close()
process.exit(0)
