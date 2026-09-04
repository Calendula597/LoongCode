export * as MemoryShared from "./shared"

import { Effect } from "effect"
import * as Stream from "effect/Stream"
import { LLM } from "@/session/llm"
import { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { SessionV1 } from "@loongcode/core/v1/session"
import { LLMEvent } from "@loongcode/llm"
import { MessageID, SessionID } from "@/session/schema"
import { ProviderV2 } from "@loongcode/core/provider"
import { ModelV2 } from "@loongcode/core/model"
import { createStructuredOutputTool } from "@/session/prompt"

export function resolveModel(spec: string, provider: Provider.Interface): Effect.Effect<Provider.Model> {
  const [providerID, modelID] = spec.split("/")
  if (!providerID || !modelID) return Effect.die(new Error(`Invalid model spec: ${spec}`))
  return provider.getModel(ProviderV2.ID.make(providerID), ModelV2.ID.make(modelID)).pipe(Effect.orDie)
}

export function memoryUser(model: Provider.Model, agent: string, sessionID: string): SessionV1.User {
  return {
    id: MessageID.ascending(),
    sessionID: SessionID.make(sessionID),
    role: "user",
    time: { created: Date.now() },
    agent,
    model: { providerID: model.providerID, modelID: model.id },
  }
}

export function runStructured(input: {
  llm: LLM.Interface
  model: Provider.Model
  agent: Agent.Info
  user: SessionV1.User
  sessionID: string
  schema: Record<string, any>
  system?: string[]
  small?: boolean
  prompt: string
  onSuccess: (output: unknown) => void
}): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* input.llm
      .stream({
        user: input.user,
        sessionID: input.sessionID,
        model: input.model,
        agent: input.agent,
        system: input.system ?? [],
        small: input.small ?? false,
        tools: {
          StructuredOutput: createStructuredOutputTool({
            schema: input.schema,
            onSuccess: input.onSuccess,
          }),
        },
        toolChoice: "required",
        messages: [{ role: "user", content: input.prompt }],
      })
      .pipe(
        Stream.filter(LLMEvent.is.toolCall),
        Stream.runCollect,
        Effect.orDie,
      )
  })
}
