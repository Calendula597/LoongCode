export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@loongcode/schema/event"
import { EventManifest } from "@loongcode/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)
