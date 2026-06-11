import { json } from "./utils"

export function handleHealth() {
  return json({ ok: true, service: "api" })
}
