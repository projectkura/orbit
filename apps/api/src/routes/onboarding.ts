import { ZodError } from "zod"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { drizzleDb } from "../lib/db/connection"
import { users } from "../lib/db/schema"
import { requireSession } from "../lib/auth/request-auth"

const userOnboardingSchema = z.object({
  acceptedTermsOfService: z.literal(true),
  acceptedPrivacyPolicy: z.literal(true),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(100, "First name must be 100 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(100, "Last name must be 100 characters or fewer."),
})

export async function handleOnboarding(request: Request) {
  const user = await requireSession(request)

  if (request.method === "GET") {
    return Response.json({
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
      tosAcceptedAt: user.tosAcceptedAt ?? null,
      privacyAcceptedAt: user.privacyAcceptedAt ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    })
  }

  if (request.method === "POST") {
    try {
      const body = userOnboardingSchema.parse(await request.json())
      const now = new Date()
      const firstName = body.firstName.trim()
      const lastName = body.lastName.trim()

      await drizzleDb
        .update(users)
        .set({
          name: firstName,
          firstName,
          lastName,
          tosAcceptedAt: now,
          privacyAcceptedAt: now,
          onboardingCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id))

      return Response.json({
        ok: true,
        user: {
          ...user,
          name: firstName,
          firstName,
          lastName,
          tosAcceptedAt: now,
          privacyAcceptedAt: now,
          onboardingCompletedAt: now,
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            message:
              error.issues[0]?.message ?? "Invalid onboarding payload.",
          },
          { status: 400 }
        )
      }

      throw error
    }
  }

  return new Response("Method not allowed", { status: 405 })
}
