import { Resend } from "resend"
import {
  EMAIL_EVENT_DEFINITIONS,
  resendTemplateInfoSchema,
  type EmailEventConfig,
  type EmailEventKey,
  type OrbitEmailVariableKey,
  type ResendTemplateInfo,
} from "@orbit/shared"
import { apiEnv } from "../core/env"
import { getRuntimeInstanceConfig } from "../core/config-store"

export type OrbitEmailVariableValues = Partial<
  Record<OrbitEmailVariableKey, string>
>

export type SendEmailEventInput = {
  event: EmailEventKey
  to: string | string[]
  variables: OrbitEmailVariableValues
}

function getResendClient(): Resend {
  if (!apiEnv.resendApiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured for this Orbit instance."
    )
  }

  return new Resend(apiEnv.resendApiKey)
}

/**
 * Fetch a Resend template (including its variables) using the configured
 * server-side API key. The shape is normalised so the front-end can rely on a
 * stable contract.
 */
export async function fetchResendTemplate(
  templateId: string
): Promise<ResendTemplateInfo> {
  if (!templateId.trim()) {
    throw new Error("Template ID is required.")
  }

  const resend = getResendClient()
  const result = await resend.templates.get(templateId.trim())

  if ("error" in result && result.error) {
    throw new Error(
      result.error.message ??
        `Failed to load Resend template ${templateId}.`
    )
  }

  const data = "data" in result ? result.data : result

  return resendTemplateInfoSchema.parse({
    id:
      (data as { id?: string } | null | undefined)?.id ?? templateId,
    name: (data as { name?: string } | null | undefined)?.name,
    variables:
      (data as { variables?: unknown[] } | null | undefined)?.variables ?? [],
  })
}

function buildResendVariableValues(
  config: EmailEventConfig,
  values: OrbitEmailVariableValues
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [resendKey, orbitKey] of Object.entries(config.variableMappings)) {
    const value = values[orbitKey as OrbitEmailVariableKey]

    if (value !== undefined && value !== null) {
      result[resendKey] = String(value)
    }
  }

  return result
}

/**
 * Dispatch an email for a registered event using the user's Resend template
 * configuration. Returns `{ skipped: true }` when the event is disabled or the
 * configuration is incomplete so callers can stay fire-and-forget.
 */
export async function sendInstanceEmail(
  input: SendEmailEventInput
): Promise<{ skipped: true; reason: string } | { skipped: false; id: string }>
{
  const definition = EMAIL_EVENT_DEFINITIONS[input.event]

  if (!definition) {
    return { skipped: true, reason: `Unknown email event "${input.event}".` }
  }

  if (!apiEnv.resendApiKey) {
    return { skipped: true, reason: "Resend API key is not configured." }
  }

  const instanceConfig = await getRuntimeInstanceConfig()
  const eventConfig = instanceConfig.emailSettings[input.event]

  if (!eventConfig?.enabled) {
    return { skipped: true, reason: "Event is disabled." }
  }

  if (!eventConfig.templateId.trim()) {
    return { skipped: true, reason: "No template ID configured." }
  }

  if (!eventConfig.fromAddress.trim()) {
    return { skipped: true, reason: "No from address configured." }
  }

  const variables = buildResendVariableValues(eventConfig, input.variables)
  const resend = getResendClient()

  const result = await resend.emails.send({
    from: eventConfig.fromAddress,
    to: input.to,
    template: {
      id: eventConfig.templateId,
      variables,
    },
  } as Parameters<typeof resend.emails.send>[0])

  if ("error" in result && result.error) {
    throw new Error(
      result.error.message ?? "Failed to dispatch email through Resend."
    )
  }

  const data = ("data" in result ? result.data : result) as {
    id?: string
  } | null

  return { skipped: false, id: data?.id ?? "" }
}

/**
 * Best-effort wrapper that swallows errors so transactional flows aren't
 * blocked when an email fails to dispatch.
 */
export async function sendInstanceEmailSafe(input: SendEmailEventInput) {
  try {
    const outcome = await sendInstanceEmail(input)

    if (outcome.skipped) {
      console.log(
        `[email] Skipped "${input.event}" (${outcome.reason}).`
      )
    } else {
      console.log(
        `[email] Sent "${input.event}" (resend id=${outcome.id}).`
      )
    }
  } catch (error) {
    console.error(`[email] Failed to send "${input.event}":`, error)
  }
}
