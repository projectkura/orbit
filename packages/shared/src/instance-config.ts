import { z } from "zod"

export const instanceConfigSchema = z.object({
  domain: z.string().trim().default(""),
  publicSignups: z.boolean().default(false),
  homePageEnabled: z.boolean().default(true),
  onboardingComplete: z.boolean().default(false),
})

export type InstanceConfig = z.infer<typeof instanceConfigSchema>

export const defaultInstanceConfig: InstanceConfig = {
  domain: "",
  publicSignups: false,
  homePageEnabled: true,
  onboardingComplete: false,
}

export const instanceConfigUpdateSchema = instanceConfigSchema.pick({
  domain: true,
  publicSignups: true,
  homePageEnabled: true,
})

export type InstanceConfigUpdate = z.infer<typeof instanceConfigUpdateSchema>

export const storedInstanceConfigSchema = z.object({
  config: instanceConfigSchema,
  version: z.number().int().positive(),
  updatedAt: z.string(),
})

export type StoredInstanceConfig = z.infer<typeof storedInstanceConfigSchema>

export function normalizeInstanceConfig(input: unknown): InstanceConfig {
  return instanceConfigSchema.parse({
    ...defaultInstanceConfig,
    ...(typeof input === "object" && input !== null ? input : {}),
  })
}
