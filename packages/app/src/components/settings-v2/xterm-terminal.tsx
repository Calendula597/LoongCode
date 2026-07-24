import { Terminal } from "xterm"
import { onCleanup, onMount, createSignal, type Component } from "solid-js"
import "xterm/css/xterm.css"

export interface XTermTerminalProps {
  /** Initial content to write to terminal */
  initialContent?: string
  /** Called when terminal is ready */
  onReady?: (terminal: Terminal) => void
  /** Custom class name */
  class?: string
  /** Max scrollback lines */
  scrollback?: number
  /** Font size */
  fontSize?: number
  /** Font family */
  fontFamily?: string
}

/**
 * Simple fit addon implementation
 */
function fitTerminal(terminal: Terminal, container: HTMLElement) {
  const computedStyle = window.getComputedStyle(container)

  // Get the font metrics
  const fontSize = parseInt(computedStyle.fontSize) || 13
  const fontFamily = computedStyle.fontFamily || "Consolas, 'Courier New', monospace"

  // Calculate character size (approximate)
  const charWidth = fontSize * 0.6
  const charHeight = fontSize * 1.2

  // Get available dimensions
  const width = container.clientWidth
  const height = container.clientHeight

  // Calculate rows and cols
  const cols = Math.floor(width / charWidth)
  const rows = Math.floor(height / charHeight)

  // Resize terminal
  if (cols > 0 && rows > 0) {
    terminal.resize(cols, rows)
  }
}

/**
 * XTerm.js terminal component for SolidJS
 * Provides a read-only terminal display with ANSI color support
 */
export const XTermTerminal: Component<XTermTerminalProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let terminal: Terminal | undefined
  const [isReady, setIsReady] = createSignal(false)

  onMount(() => {
    if (!containerRef) return

    terminal = new Terminal({
      scrollback: props.scrollback ?? 5000,
      fontSize: props.fontSize ?? 13,
      fontFamily: props.fontFamily ?? "Consolas, 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#1e1e1e",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      cursorBlink: false,
      disableStdin: true, // Read-only
      convertEol: true,
    })

    terminal.open(containerRef)

    // Initial fit
    setTimeout(() => {
      if (containerRef && terminal) {
        fitTerminal(terminal, containerRef)
      }
    }, 0)

    if (props.initialContent) {
      terminal.write(props.initialContent)
    }

    setIsReady(true)
    props.onReady?.(terminal)

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef && terminal) {
        fitTerminal(terminal, containerRef)
      }
    })
    resizeObserver.observe(containerRef)

    onCleanup(() => {
      resizeObserver.disconnect()
      terminal?.dispose()
    })
  })

  return (
    <div
      ref={containerRef}
      class={`xterm-container w-full h-full ${props.class ?? ""}`}
      style={{ "background-color": "#1e1e1e" }}
    />
  )
}

/**
 * Helper to write colored text to terminal
 */
export function writeColored(terminal: Terminal, text: string, color?: string) {
  if (color) {
    terminal.write(`\x1b[${color}m${text}\x1b[0m`)
  } else {
    terminal.write(text)
  }
}

/**
 * Helper to write a line with timestamp
 */
export function writeLine(terminal: Terminal, text: string, color?: string) {
  const timestamp = new Date().toLocaleTimeString()
  terminal.write(`\x1b[90m[${timestamp}]\x1b[0m `)
  if (color) {
    terminal.write(`\x1b[${color}m${text}\x1b[0m\r\n`)
  } else {
    terminal.write(`${text}\r\n`)
  }
}

/**
 * Helper to write error message
 */
export function writeError(terminal: Terminal, text: string) {
  writeLine(terminal, text, "31") // Red
}

/**
 * Helper to write success message
 */
export function writeSuccess(terminal: Terminal, text: string) {
  writeLine(terminal, text, "32") // Green
}

/**
 * Helper to write warning message
 */
export function writeWarning(terminal: Terminal, text: string) {
  writeLine(terminal, text, "33") // Yellow
}

/**
 * Helper to write info message
 */
export function writeInfo(terminal: Terminal, text: string) {
  writeLine(terminal, text, "36") // Cyan
}

/**
 * Color codes for ANSI
 */
export const AnsiColors = {
  black: "30",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  magenta: "35",
  cyan: "36",
  white: "37",
  brightBlack: "90",
  brightRed: "91",
  brightGreen: "92",
  brightYellow: "93",
  brightBlue: "94",
  brightMagenta: "95",
  brightCyan: "96",
  brightWhite: "97",
} as const