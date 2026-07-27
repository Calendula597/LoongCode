import { ButtonV2 } from "@loongcode/ui/v2/button-v2"
import { Dialog, DialogFooter } from "@loongcode/ui/v2/dialog-v2"
import { TextInputV2 } from "@loongcode/ui/v2/text-input-v2"
import { useDialog } from "@loongcode/ui/context/dialog"
import { type Component, Show, createSignal, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { useServerSDK } from "@/context/server-sdk"
import { ServerConnection, useServer } from "@/context/server"
import { useCheckServerHealth } from "@/utils/server-health"
import { XTermTerminal, writeLine, writeError, writeSuccess, writeInfo } from "./xterm-terminal"
import type { Terminal } from "xterm"
import "./settings-v2.css"

interface SSHDeployState {
  status: "idle" | "connecting" | "installing" | "starting" | "connected" | "error"
  sessionId?: string
  localPort?: number
  remotePort?: number
  errorMessage?: string
}

export const DialogSSHServer: Component<{}> = () => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSync = useServerSync()
  const serverSDK = useServerSDK()
  const server = useServer()
  const checkServerHealth = useCheckServerHealth()

  // Form state
  const [host, setHost] = createSignal("")
  const [port, setPort] = createSignal("22")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")

  // Deploy state
  const [deployState, setDeployState] = createSignal<SSHDeployState>({ status: "idle" })
  const [terminal, setTerminal] = createSignal<Terminal | null>(null)
  const [eventSource, setEventSource] = createSignal<EventSource | null>(null)

  onCleanup(() => eventSource()?.close())

  const isFormValid = () => host().trim() && username().trim()

  const handleConnect = async () => {
    if (!isFormValid()) return

    const term = terminal()
    if (!term) return

    setDeployState({ status: "connecting" })
    term.clear()
    writeInfo(term, language.t("ssh.deploy.connecting"))

    try {
      // Get the server URL from SDK
      const baseUrl = serverSDK().url
      const apiUrl = `${baseUrl}/ssh-deploy/connect`

      // Call SSH deploy API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host(),
          port: parseInt(port()) || 22,
          username: username(),
          password: password() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Connection failed")
      }

      setDeployState({ status: "installing", sessionId: data.sessionId })
      writeSuccess(term, language.t("ssh.deploy.connected"))

      // Start installation
      await startInstallation(data.sessionId, term)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      writeError(term, message)
      setDeployState({ status: "error", errorMessage: message })
    }
  }

  const startInstallation = async (sessionId: string, term: Terminal) => {
    writeInfo(term, language.t("ssh.deploy.step.detectingOS"))

    const baseUrl = serverSDK().url

    try {
      // Start installation
      await fetch(`${baseUrl}/ssh-deploy/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      // Subscribe to logs via SSE
      const source = new EventSource(`${baseUrl}/ssh-deploy/logs?sessionId=${sessionId}`)
      setEventSource(source)

      source.onmessage = async (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case "log":
            term.write(data.message + "\r\n")
            break
          case "step":
            handleStepChange(data.step, data.progress, term)
            break
          case "error":
            writeError(term, data.message)
            setDeployState({ status: "error", errorMessage: data.message })
            source.close()
            break
          case "complete": {
            source.close()
            if (!data.success) {
              const message = data.message || "Deployment failed"
              writeError(term, message)
              setDeployState({ status: "error", errorMessage: message })
              break
            }

            // Prefer a direct remote URL when SSH port forwarding is unavailable.
            // Otherwise use the local tunnel port.
            const serverUrl = data.directUrl ?? `http://127.0.0.1:${data.localPort}`
            writeInfo(term, "Verifying connection...")

            const http: ServerConnection.HttpBase = { url: serverUrl }
            if (data.serverPassword) {
              http.username = "loongcode"
              http.password = data.serverPassword
            }

            const result = await checkServerHealth(http)
            if (!result.healthy) {
              const message = "Server health check failed"
              writeError(term, message)
              setDeployState({ status: "error", errorMessage: message })
              break
            }
            writeInfo(term, "Connection verified")

            writeSuccess(term, language.t("ssh.deploy.complete"))
            setDeployState({
              status: "connected",
              sessionId,
              localPort: data.localPort,
              remotePort: data.remotePort,
            })

            server.add({
              type: "http",
              http,
              displayName: `SSH: ${host()}`,
            })

            writeInfo(
              term,
              data.directUrl
                ? `Connected directly to ${host()}:${data.remotePort}`
                : `Connected to ${host()}:${data.remotePort} via tunnel on localhost:${data.localPort}`,
            )
            break
          }
        }
      }

      source.onerror = () => {
        source.close()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      writeError(term, message)
      setDeployState({ status: "error", errorMessage: message })
    }
  }

  const handleStepChange = (step: string, progress: number, term: Terminal) => {
    const stepMessages: Record<string, string> = {
      "installing-nodejs": language.t("ssh.deploy.step.installingNodejs"),
      "installing-loongcode": language.t("ssh.deploy.step.installingLoongcode"),
      "installing-agentmemory": language.t("ssh.deploy.step.installingAgentmemory"),
      "starting-serve": language.t("ssh.deploy.step.startingServe"),
    }

    const message = stepMessages[step] || step
    writeInfo(term, `[${progress}%] ${message}`)
  }

  const handleTerminalReady = (term: Terminal) => {
    setTerminal(term)
    writeLine(term, language.t("ssh.deploy.terminalReady"))
  }

  const isConnecting = () =>
    ["connecting", "installing", "starting"].includes(deployState().status)

  return (
    <Dialog title={language.t("ssh.deploy.title")} fit class="settings-v2-ssh-dialog">
      <div class="flex w-full min-w-0 flex-1 flex-col gap-4 px-4">
        {/* Connection Form */}
        <div class="grid w-full grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("ssh.deploy.host")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full"
              value={host()}
              placeholder="192.168.1.100"
              disabled={isConnecting()}
              onInput={(e) => setHost(e.currentTarget.value)}
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("ssh.deploy.port")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full"
              value={port()}
              placeholder="22"
              disabled={isConnecting()}
              onInput={(e) => setPort(e.currentTarget.value)}
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("ssh.deploy.username")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full"
              value={username()}
              placeholder={language.t("ssh.deploy.usernamePlaceholder")}
              disabled={isConnecting()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("ssh.deploy.password")}</label>
            <TextInputV2
              type="password"
              appearance="large"
              class="!w-full"
              value={password()}
              placeholder={language.t("ssh.deploy.passwordPlaceholder")}
              disabled={isConnecting()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </div>
        </div>

        {/* Terminal Output */}
        <div class="flex flex-col gap-2">
          <label class="settings-v2-server-dialog-label">{language.t("ssh.deploy.output")}</label>
          <div class="h-64 w-full rounded-md border border-v2-border-main overflow-hidden">
            <XTermTerminal
              class="h-full"
              fontSize={12}
              scrollback={1000}
              onReady={handleTerminalReady}
            />
          </div>
        </div>

        {/* Status */}
        <Show when={deployState().status === "connected"}>
          <div class="flex items-center gap-2 text-green-500">
            <span class="i-carbon-checkmark-filled" />
            <span>
              {language.t("ssh.deploy.connectedTo")} {host()}:{deployState().remotePort}
            </span>
          </div>
        </Show>

        <Show when={deployState().status === "error"}>
          <div class="flex items-center gap-2 text-red-500">
            <span class="i-carbon-close-filled" />
            <span>{deployState().errorMessage}</span>
          </div>
        </Show>
      </div>

      <DialogFooter>
        <ButtonV2 variant="neutral" disabled={isConnecting()} onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2
          variant="contrast"
          disabled={!isFormValid() || isConnecting()}
          onClick={handleConnect}
        >
          {isConnecting()
            ? language.t("ssh.deploy.deploying")
            : language.t("ssh.deploy.connectAndDeploy")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}