import { Effect, Queue, Stream } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerResponse } from "effect/unstable/http"
import * as Sse from "effect/unstable/encoding/Sse"
import { RootHttpApi } from "../api"
import { InvalidRequestError } from "../errors"
import { randomUUID } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import * as net from "node:net"
import { Client, type ConnectConfig } from "ssh2"
import { EventEmitter } from "node:events"

const DEFAULT_SSH_PORT = 22
const DEFAULT_REMOTE_PORT = 4096
const DEFAULT_LOCAL_PORT = 4097

interface SSHSession {
  id: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  client?: Client
  connected: boolean
  tunnelServer?: net.Server // Local tunnel server
  localPort?: number
}

// Log event for SSE
interface LogEvent {
  type: "log" | "step" | "error" | "complete" | "heartbeat"
  message?: string
  step?: string
  progress?: number
  success?: boolean
  localPort?: number
  remotePort?: number
  directUrl?: string
  serverPassword?: string
}

// In-memory session storage
const sessions = new Map<string, SSHSession>()

// In-memory log emitters for SSE (using Node.js EventEmitter instead of Effect Queue)
const logEmitters = new Map<string, EventEmitter>()

function expandTilde(pathStr: string): string {
  if (pathStr.startsWith("~/")) {
    return pathStr.replace("~", process.env.HOME || process.env.USERPROFILE || "~")
  }
  return pathStr
}

// Read private key file if it's a file path
function readPrivateKey(keyPath: string): string {
  const expandedPath = expandTilde(keyPath)
  try {
    return fs.readFileSync(expandedPath, "utf8")
  } catch {
    // If it's not a file path, assume it's the key content itself
    return keyPath
  }
}

// Send log event to emitter if exists
function sendLog(sessionId: string, event: LogEvent) {
  const emitter = logEmitters.get(sessionId)
  console.log("[SSH Deploy] sendLog called:", { sessionId, eventType: event.type, emitterExists: !!emitter })
  if (emitter) {
    emitter.emit("log", event)
    console.log("[SSH Deploy] Log event emitted")
  }
}

// Connect to SSH server using ssh2 library
function connectSSH(session: SSHSession): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    const config: ConnectConfig = {
      host: session.host,
      port: session.port,
      username: session.username,
      readyTimeout: 30000,
      // Keep the connection alive during long installs so the tunnel survives NAT idle timeouts
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    }

    // Set authentication method
    if (session.privateKey) {
      try {
        config.privateKey = readPrivateKey(session.privateKey)
      } catch (err) {
        reject(new Error(`Failed to read private key: ${err}`))
        return
      }
    } else if (session.password) {
      config.password = session.password
    } else {
      // Try default SSH key
      const defaultKeyPath = path.join(os.homedir(), ".ssh", "id_rsa")
      if (fs.existsSync(defaultKeyPath)) {
        try {
          config.privateKey = fs.readFileSync(defaultKeyPath, "utf8")
        } catch {
          // Ignore error
        }
      }
    }

    console.log("[SSH Deploy] Connecting to:", session.host, "with username:", session.username)

    client
      .on("ready", () => {
        console.log("[SSH Deploy] Connected successfully")
        resolve(client)
      })
      .on("error", (err) => {
        console.error("[SSH Deploy] Connection error:", err.message)
        reject(err)
      })
      .connect(config)
  })
}

// Execute command on SSH server
function execSSH(
  client: Client,
  command: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    console.log("[SSH Deploy] Executing command:", command.slice(0, 100))

    let stdout = ""
    let stderr = ""
    let finished = false

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true
        resolve({ stdout, stderr: "Command timed out", code: 1 })
      }
    }, timeout)

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer)
        resolve({ stdout: "", stderr: err.message, code: 1 })
        return
      }

      stream
        .on("close", (code: number) => {
          if (!finished) {
            finished = true
            clearTimeout(timer)
            console.log("[SSH Deploy] Command finished:", { code, stdout: stdout.slice(0, 100) })
            resolve({ stdout, stderr, code: code ?? 0 })
          }
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString()
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString()
        })
    })
  })
}

// Establish a local TCP server that forwards each incoming connection through
// SSH to the remote loongcode port. Reused by both install and start handlers.
function establishTunnel(session: SSHSession, client: Client): Promise<{ localPort?: number; error?: string }> {
  if (session.tunnelServer && session.localPort) return Promise.resolve({ localPort: session.localPort })

  return new Promise((resolve) => {
    const tryPort = (portToTry: number): void => {
      const server = net.createServer((localSocket) => {
        client.forwardOut(
          localSocket.remoteAddress ?? "127.0.0.1",
          localSocket.remotePort ?? 0,
          "127.0.0.1",
          DEFAULT_REMOTE_PORT,
          (err, channel) => {
            if (err) {
              console.error("[SSH Deploy] Forward error:", err)
              sendLog(session.id, { type: "log", message: `Tunnel forward error: ${err.message}` })
              localSocket.destroy()
              return
            }
            // Pipe data between local socket and remote channel
            localSocket.pipe(channel).pipe(localSocket)
            localSocket.on("error", (e) => {
              console.error("[SSH Deploy] Local socket error:", e)
              channel.destroy()
            })
            channel.on("error", (e: Error) => {
              console.error("[SSH Deploy] Channel error:", e)
              localSocket.destroy()
            })
          },
        )
      })

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && portToTry < DEFAULT_LOCAL_PORT + 100) {
          tryPort(portToTry + 1)
          return
        }
        resolve({ error: err.code === "EADDRINUSE" ? "No available local port" : err.message })
      })

      server.listen(portToTry, "127.0.0.1", () => {
        const localPort = (server.address() as net.AddressInfo).port
        console.log("[SSH Deploy] Local tunnel listening on port", localPort)
        session.tunnelServer = server
        session.localPort = localPort
        resolve({ localPort })
      })
    }

    tryPort(DEFAULT_LOCAL_PORT)
  })
}

// Verify the remote server answers a health request directly on its public interface.
// Used as a fallback when SSH port forwarding is disabled on the server.
function checkDirectRemote(host: string, port: number): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const socket = net.connect(port, host, () => {
      socket.write(`GET /global/health HTTP/1.1\r\nHost: ${host}:${port}\r\nConnection: close\r\n\r\n`)
    })

    let data = ""
    const finish = (ok: boolean, why?: string) => {
      socket.destroy()
      resolve({ ok, reason: why })
    }

    socket.on("data", (chunk) => {
      data += chunk.toString()
      if (!data.includes("\r\n")) return
      if (/^HTTP\/[\d.]+ 200/.test(data) || data.includes('"healthy":true')) {
        finish(true)
        return
      }
      finish(false, `unexpected response: ${data.slice(0, 120)}`)
    })

    socket.on("end", () => {
      const ok = /^HTTP\/[\d.]+ 200/.test(data) || data.includes('"healthy":true')
      resolve({
        ok,
        reason: ok ? undefined : data ? `unexpected response: ${data.slice(0, 120)}` : "connection closed without response",
      })
    })

    socket.on("error", (e) => {
      console.error("[SSH Deploy] Direct remote health check error:", e)
      resolve({ ok: false, reason: e.message })
    })

    setTimeout(() => finish(false, "timed out waiting for response"), 5000)
  })
}

// Verify the remote server answers a health request through the tunnel
async function verifyTunnel(localPort: number, attempts = 10): Promise<{ ok: boolean; reason?: string }> {
  let reason = "no response"
  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise((r) => setTimeout(r, 2000))
    const result = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      const socket = net.connect(localPort, "127.0.0.1", () => {
        socket.write(`GET /global/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`)
      })
      let data = ""
      const finish = (ok: boolean, why?: string) => {
        socket.destroy()
        resolve({ ok, reason: why })
      }
      socket.on("data", (chunk) => {
        data += chunk.toString()
        // Decide as soon as a full status line arrives instead of waiting for
        // the peer to close the socket
        if (!data.includes("\r\n")) return
        if (/^HTTP\/[\d.]+ 200/.test(data) || data.includes('"healthy":true')) {
          finish(true)
          return
        }
        finish(false, `unexpected response: ${data.slice(0, 120)}`)
      })
      socket.on("end", () => {
        const ok = /^HTTP\/[\d.]+ 200/.test(data) || data.includes('"healthy":true')
        resolve({ ok, reason: ok ? undefined : data ? `unexpected response: ${data.slice(0, 120)}` : "connection closed without response" })
      })
      socket.on("error", (e) => {
        console.error("[SSH Deploy] Tunnel health check error:", e)
        resolve({ ok: false, reason: e.message })
      })
      setTimeout(() => finish(false, "timed out waiting for response"), 5000)
    })
    if (result.ok) return { ok: true }
    reason = result.reason ?? reason
    console.log("[SSH Deploy] Tunnel verification attempt", attempt + 1, "of", attempts, "failed:", reason)
  }
  return { ok: false, reason }
}

// Helper to create a bad request error effect
const badRequest = (message: string) => new InvalidRequestError({ message })

// SSE event data
function sseEvent(data: unknown): Sse.Event {
  return {
    _tag: "Event",
    event: "message",
    id: undefined,
    data: JSON.stringify(data),
  }
}

export const sshDeployHandlers = HttpApiBuilder.group(RootHttpApi, "ssh-deploy", (handlers) =>
  Effect.gen(function* () {
    const connect = Effect.fn("SshDeploy.connect")(function* (ctx: { payload: any }) {
      console.log("[SSH Deploy] Connect request received:", { ...ctx.payload, password: "***" })

      const payload = ctx.payload

      // Validate required fields
      if (!payload.host) {
        return yield* Effect.fail(badRequest("Host is required"))
      }
      if (!payload.username) {
        return yield* Effect.fail(badRequest("Username is required"))
      }

      const sessionId = randomUUID()

      const session: SSHSession = {
        id: sessionId,
        host: payload.host,
        port: payload.port ?? DEFAULT_SSH_PORT,
        username: payload.username,
        password: payload.password,
        privateKey: payload.privateKey,
        connected: false,
      }

      // Test connection using ssh2 library
      console.log("[SSH Deploy] Testing connection to:", session.host)

      const client = yield* Effect.tryPromise({
        try: () => connectSSH(session),
        catch: (error) => {
          const err = error as Error
          let errorMsg = err.message

          // Provide more helpful error messages
          if (err.message.includes("Authentication")) {
            errorMsg = "Authentication failed. Please check your username and password/key."
          } else if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Connection refused. Please check if SSH server is running on the target host."
          } else if (err.message.includes("ETIMEDOUT") || err.message.includes("timed out")) {
            errorMsg = "Connection timed out. Please check if the host is reachable."
          } else if (err.message.includes("ENOTFOUND")) {
            errorMsg = "Host not found. Please check the hostname or IP address."
          }

          return badRequest(`Connection failed: ${errorMsg}`)
        },
      })

      // Test execute a simple command
      const testResult = yield* Effect.tryPromise({
        try: () => execSSH(client, "echo CONNECTION_OK", 10000),
        catch: (error) => badRequest(`Command execution failed: ${error}`),
      })

      if (testResult.stdout.includes("CONNECTION_OK")) {
        session.client = client
        session.connected = true
        sessions.set(sessionId, session)

        // If the SSH connection drops, the tunnel dies with it — clean up instead
        // of leaving a half-open local server that accepts connections but cannot forward.
        client.on("close", () => {
          console.log("[SSH Deploy] SSH connection closed for session:", sessionId)
          session.connected = false
          session.tunnelServer?.close()
          session.tunnelServer = undefined
          session.localPort = undefined
        })
        client.on("error", (err) => {
          console.error("[SSH Deploy] SSH connection error for session:", sessionId, err.message)
        })

        // Create log emitter for this session
        const emitter = new EventEmitter()
        logEmitters.set(sessionId, emitter)
        console.log("[SSH Deploy] Log emitter created for session:", sessionId)

        console.log("[SSH Deploy] Connection successful, sessionId:", sessionId)
        return { sessionId }
      }

      // Close connection if test failed
      client.end()
      return yield* Effect.fail(badRequest(`Connection test failed: ${testResult.stderr || "Unknown error"}`))
    })

    const install = Effect.fn("SshDeploy.install")(function* (ctx: { payload: { sessionId: string } }) {
      console.log("[SSH Deploy] Install request received for session:", ctx.payload.sessionId)

      const { sessionId } = ctx.payload
      const session = sessions.get(sessionId)

      if (!session || !session.client) {
        return yield* Effect.fail(badRequest("Session not found or not connected"))
      }

      const client = session.client

      // Run installation in background using plain async
      void (async () => {
        console.log("[SSH Deploy] Starting installation for:", session.host)

        try {
          // Detect OS
          console.log("[SSH Deploy] Sending step: detecting-os")
          sendLog(sessionId, { type: "step", step: "detecting-os", progress: 5 })
          const osResult = await execSSH(client, "cat /etc/os-release 2>/dev/null || echo UNKNOWN")
          const os = osResult.stdout.toLowerCase().includes("nixos")
            ? "nixos"
            : osResult.stdout.toLowerCase().includes("ubuntu") || osResult.stdout.toLowerCase().includes("debian")
              ? "ubuntu"
              : osResult.stdout.toLowerCase().includes("centos") || osResult.stdout.toLowerCase().includes("rhel")
                ? "centos"
                : "unknown"

          console.log("[SSH Deploy] Detected OS:", os)
          sendLog(sessionId, { type: "log", message: `Detected OS: ${os}` })

          // Check/install Node.js
          console.log("[SSH Deploy] Sending step: installing-nodejs")
          sendLog(sessionId, { type: "step", step: "installing-nodejs", progress: 10 })
          const nodeResult = await execSSH(client, "which node || echo NOT_FOUND")
          if (nodeResult.stdout.includes("NOT_FOUND")) {
            console.log("[SSH Deploy] Node.js not found, installing...")
            sendLog(sessionId, { type: "log", message: "Installing Node.js..." })
            if (os === "ubuntu") {
              await execSSH(
                client,
                "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs",
                300000,
              )
            } else if (os === "centos") {
              await execSSH(
                client,
                "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs",
                300000,
              )
            } else if (os === "nixos") {
              await execSSH(client, "nix-env -iA nixpkgs.nodejs", 300000)
            }
            sendLog(sessionId, { type: "log", message: "Node.js installed successfully" })
          } else {
            sendLog(sessionId, { type: "log", message: "Node.js already installed" })
          }

          // Install ripgrep (runtime dependency used by the server for code search)
          console.log("[SSH Deploy] Checking ripgrep")
          sendLog(sessionId, { type: "log", message: "Checking ripgrep (runtime dependency)..." })
          if (os === "ubuntu") {
            await execSSH(client, "command -v rg >/dev/null || sudo -E apt-get install -y ripgrep", 120000)
          } else if (os === "centos") {
            await execSSH(client, "command -v rg >/dev/null || sudo -E yum install -y ripgrep", 120000)
          } else if (os === "nixos") {
            await execSSH(client, "command -v rg >/dev/null || nix-env -iA nixpkgs.ripgrep", 120000)
          }
          sendLog(sessionId, { type: "log", message: "ripgrep ready" })

          // Install LoongCode
          console.log("[SSH Deploy] Sending step: installing-loongcode")
          sendLog(sessionId, { type: "step", step: "installing-loongcode", progress: 50 })
          console.log("[SSH Deploy] Installing LoongCode...")
          sendLog(sessionId, { type: "log", message: "Installing LoongCode..." })
          const installResult = await execSSH(client, "npm install -g loongcode", 120000)
          if (installResult.code !== 0) {
            sendLog(sessionId, { type: "error", message: `Failed to install LoongCode: ${installResult.stderr}` })
            return
          }
          sendLog(sessionId, { type: "log", message: "LoongCode installed successfully" })

          // Get npm global bin path
          sendLog(sessionId, { type: "log", message: "Finding loongcode binary path..." })
          const npmPrefixResult = await execSSH(client, "npm config get prefix 2>/dev/null || echo /usr/local", 10000)
          const npmPrefix = npmPrefixResult.stdout.trim()
          const loongcodeBin = `${npmPrefix}/bin/loongcode`
          sendLog(sessionId, { type: "log", message: `Binary path: ${loongcodeBin}` })

          // Verify binary exists
          const binCheckResult = await execSSH(client, `test -f ${loongcodeBin} && echo EXISTS || echo NOT_FOUND`, 10000)
          if (binCheckResult.stdout.includes("NOT_FOUND")) {
            // Try to find it in node_modules
            const findResult = await execSSH(client, `find ${npmPrefix}/lib/node_modules -name "loongcode" -type f 2>/dev/null | head -1`, 10000)
            if (findResult.stdout.trim()) {
              sendLog(sessionId, { type: "log", message: `Found binary: ${findResult.stdout.trim()}` })
            } else {
              sendLog(sessionId, { type: "error", message: "Could not find loongcode binary after installation" })
              return
            }
          }

          // Start service
          console.log("[SSH Deploy] Sending step: starting-serve")
          sendLog(sessionId, { type: "step", step: "starting-serve", progress: 80 })
          sendLog(sessionId, { type: "log", message: "Starting LoongCode server..." })

          // Kill existing process (bracket trick prevents pkill/pgrep from matching its own command line)
          await execSSH(client, `pkill -f "[l]oongcode serve" || true`, 10000)

          // Start loongcode serve using full path with proper environment
          // Use setsid to create a new session so the process survives SSH disconnect
          // Source shell profile to get proper PATH
          const startCmd = `nohup /bin/bash -c "source ~/.bashrc 2>/dev/null || source ~/.profile 2>/dev/null || true; export PATH=${npmPrefix}/bin:\\$PATH; ${loongcodeBin} serve --hostname 0.0.0.0 --port ${DEFAULT_REMOTE_PORT}" > /tmp/loongcode-serve.log 2>&1 & disown`
          sendLog(sessionId, { type: "log", message: `Running: ${startCmd}` })
          await execSSH(client, startCmd, 10000)

          // Wait for the remote server to actually answer health requests.
          // NOTE: do not grep `ss` output for the bare port number — the Recv-Q/Send-Q
          // columns often contain "4096" and cause a false positive.
          sendLog(sessionId, { type: "log", message: "Waiting for server to start..." })
          let serverUp = false
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000))
            const healthResult = await execSSH(
              client,
              `curl -s -m 3 http://127.0.0.1:${DEFAULT_REMOTE_PORT}/global/health 2>/dev/null || echo NOT_READY`,
              10000,
            )
            if (healthResult.stdout.includes('"healthy":true')) {
              serverUp = true
              break
            }
            // Check if process is still running
            const procResult = await execSSH(client, `pgrep -f "[l]oongcode serve" || echo NOT_RUNNING`, 10000)
            if (procResult.stdout.includes("NOT_RUNNING")) {
              // Process died, check the log
              const logResult = await execSSH(client, "cat /tmp/loongcode-serve.log 2>/dev/null || echo 'No log file'", 10000)
              sendLog(sessionId, { type: "error", message: `Server process exited. Log: ${logResult.stdout.slice(0, 1000)}` })
              return
            }
            sendLog(sessionId, { type: "log", message: `Waiting for server on port ${DEFAULT_REMOTE_PORT}... (${i + 1}/30)` })
          }

          if (!serverUp) {
            const logResult = await execSSH(client, "cat /tmp/loongcode-serve.log 2>/dev/null || echo 'No log file'", 10000)
            sendLog(sessionId, { type: "error", message: `Server not responding on port ${DEFAULT_REMOTE_PORT}. Log: ${logResult.stdout.slice(0, 1000)}` })
            return
          }

          sendLog(sessionId, { type: "log", message: `Server responding on port ${DEFAULT_REMOTE_PORT}` })

          // Prefer a direct remote connection: we started with --hostname 0.0.0.0, so
          // if the host/firewall allows it, this is the fastest and simplest path.
          sendLog(sessionId, { type: "log", message: "Checking direct remote connection..." })
          console.log("[SSH Deploy] Checking direct remote connection")
          const directCheck = await checkDirectRemote(session.host, DEFAULT_REMOTE_PORT)

          if (directCheck.ok) {
            sendLog(sessionId, { type: "log", message: "Direct remote connection is available" })
            sendLog(sessionId, {
              type: "complete",
              success: true,
              directUrl: `http://${session.host}:${DEFAULT_REMOTE_PORT}`,
              remotePort: DEFAULT_REMOTE_PORT,
            })
            console.log("[SSH Deploy] Installation complete via direct connection")
            return
          }

          sendLog(sessionId, { type: "log", message: `Direct connection unavailable (${directCheck.reason}); trying SSH tunnel...` })

          // Establish SSH tunnel (local port forwarding)
          sendLog(sessionId, { type: "log", message: "Establishing SSH tunnel..." })
          console.log("[SSH Deploy] Establishing SSH tunnel")

          const tunnelResult = await establishTunnel(session, client)

          if (!tunnelResult.localPort) {
            sendLog(sessionId, { type: "error", message: tunnelResult.error ?? "Failed to establish SSH tunnel" })
            return
          }

          sendLog(sessionId, { type: "log", message: `SSH tunnel established on localhost:${tunnelResult.localPort}` })
          console.log("[SSH Deploy] Tunnel established on port", tunnelResult.localPort)

          // Verify the remote server answers through the tunnel before reporting success
          sendLog(sessionId, { type: "log", message: "Verifying tunnel connection..." })
          const tunnelCheck = await verifyTunnel(tunnelResult.localPort)

          if (!tunnelCheck.ok) {
            // Cross-check via SSH whether the server answers locally on the remote host,
            // to tell a dead server apart from broken SSH forwarding
            const remoteCheck = await execSSH(
              client,
              `curl -s -m 3 http://127.0.0.1:${DEFAULT_REMOTE_PORT}/global/health 2>/dev/null || echo NOT_READY`,
              10000,
            )
            if (!remoteCheck.stdout.includes('"healthy":true')) {
              sendLog(sessionId, {
                type: "complete",
                success: false,
                message: `Tunnel verification failed: the remote server is not responding on port ${DEFAULT_REMOTE_PORT} (${tunnelCheck.reason}). Check /tmp/loongcode-serve.log on the remote host.`,
              })
              return
            }

            const detail = `the remote server answers locally, but direct connection failed (${directCheck.reason}) and SSH port forwarding also failed (${tunnelCheck.reason}). Check that AllowTcpForwarding is enabled in sshd_config, or open port ${DEFAULT_REMOTE_PORT} in the remote firewall.`
            sendLog(sessionId, { type: "complete", success: false, message: `Connection verification failed: ${detail}` })
            return
          }

          sendLog(sessionId, { type: "log", message: "Remote server is ready!" })

          // Complete
          console.log("[SSH Deploy] Sending complete event")
          sendLog(sessionId, {
            type: "complete",
            success: true,
            localPort: tunnelResult.localPort,
            remotePort: DEFAULT_REMOTE_PORT,
          })

          console.log("[SSH Deploy] Installation complete")
        } catch (err) {
          console.error("[SSH Deploy] Installation error:", err)
          sendLog(sessionId, { type: "error", message: err instanceof Error ? err.message : "Unknown error" })
        }
      })()

      return true
    })

    const start = Effect.fn("SshDeploy.start")(function* (ctx: { payload: { sessionId: string } }) {
      console.log("[SSH Deploy] Start request received for session:", ctx.payload.sessionId)

      const { sessionId } = ctx.payload
      const session = sessions.get(sessionId)

      if (!session || !session.client) {
        return yield* Effect.fail(badRequest("Session not found or not connected"))
      }

      const client = session.client

      // Kill existing loongcode serve process (bracket trick avoids pkill matching itself)
      yield* Effect.tryPromise({
        try: () => execSSH(client, `pkill -f "[l]oongcode serve" || true`, 10000),
        catch: (error) => badRequest(`Failed to kill existing process: ${error}`),
      })

      // Start loongcode serve via a login shell so the global npm bin dir is on PATH
      yield* Effect.tryPromise({
        try: () =>
          execSSH(
            client,
            `nohup bash -lc "loongcode serve --hostname 0.0.0.0 --port ${DEFAULT_REMOTE_PORT}" > /tmp/loongcode-serve.log 2>&1 &`,
            10000,
          ),
        catch: (error) => badRequest(`Failed to start service: ${error}`),
      })

      // Wait for service to start
      yield* Effect.sleep("3 seconds")

      // Establish port forwarding tunnel (local server + forwardOut per connection)
      console.log("[SSH Deploy] Establishing tunnel")

      const tunnelResult = yield* Effect.tryPromise({
        try: () => establishTunnel(session, client),
        catch: (error) => badRequest(`Failed to establish tunnel: ${error}`),
      })

      if (!tunnelResult.localPort) {
        return yield* Effect.fail(badRequest(tunnelResult.error ?? "Failed to establish tunnel"))
      }

      console.log("[SSH Deploy] Tunnel established on port", tunnelResult.localPort)

      return true
    })

    const disconnect = Effect.fn("SshDeploy.disconnect")(function* (ctx: { payload: { sessionId: string } }) {
      console.log("[SSH Deploy] Disconnect request received for session:", ctx.payload.sessionId)

      const { sessionId } = ctx.payload
      const session = sessions.get(sessionId)

      if (session) {
        // Close tunnel server
        if (session.tunnelServer) {
          session.tunnelServer.close()
          console.log("[SSH Deploy] Tunnel server closed")
        }
        // Close SSH connection
        if (session.client) {
          session.client.end()
        }
        sessions.delete(sessionId)
        logEmitters.delete(sessionId)
      }

      return true
    })

    // SSE logs endpoint using handleRaw
    const logs = Effect.fn("SshDeploy.logs")(function* (ctx: { query: { sessionId: string } }) {
      return yield* logsResponse(ctx.query.sessionId)
    })

    return handlers
      .handle("connect", connect)
      .handle("install", install)
      .handle("start", start)
      .handle("disconnect", disconnect)
      .handleRaw("logs", logs)
  }),
)

function logsResponse(sessionId: string) {
  return Effect.gen(function* () {
    console.log("[SSH Deploy] Logs endpoint called with sessionId:", sessionId)

    if (!sessionId) {
      return HttpServerResponse.jsonUnsafe({ error: "sessionId is required" }, { status: 400 })
    }

    const emitter = logEmitters.get(sessionId)

    if (!emitter) {
      // Session not found, return error
      return HttpServerResponse.jsonUnsafe({ error: "Session not found" }, { status: 404 })
    }

    console.log("[SSH Deploy] Creating SSE stream for session:", sessionId)

    // Create log stream from EventEmitter using Stream.callback (same pattern as event.ts)
    const logStream = Stream.callback<LogEvent>((queue) => {
      const onLog = (event: LogEvent) => {
        Queue.offerUnsafe(queue, event)
      }
      emitter.on("log", onLog)
      return Effect.acquireRelease(
        Effect.sync(() => {
          // Listener is already registered above
        }),
        () => Effect.sync(() => {
          emitter.off("log", onLog)
        }),
      )
    })

    // Create heartbeat stream (same pattern as event.ts)
    const heartbeat = Stream.tick("10 seconds").pipe(
      Stream.drop(1),
      Stream.map(() => ({ type: "heartbeat" as const })),
    )

    // Merge log stream with heartbeat
    const output = logStream.pipe(
      Stream.merge(heartbeat, { haltStrategy: "left" }),
      Stream.map(sseEvent),
    )

    // Start with initial heartbeat, then output
    const stream = Stream.make(sseEvent({ type: "heartbeat" })).pipe(
      Stream.concat(output),
      Stream.pipeThroughChannel(Sse.encode()),
      Stream.encodeText,
    )

    return HttpServerResponse.stream(stream, {
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    })
  })
}