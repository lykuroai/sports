"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@spotomo/auth-client";
import { submitReview } from "@spotomo/domain-common";

const SCHEMA = "golf";

const schema = z.object({
  event_id: z.string().uuid(),
  reviewee_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function submitReviewAction(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const tags = formData.getAll("tags").map(String);

  await submitReview(supabase, SCHEMA, {
    eventId: parsed.data.event_id,
    reviewerId: user.id,
    revieweeId: parsed.data.reviewee_id,
    rating: parsed.data.rating,
    tags,
    comment: parsed.data.comment,
  });

  revalidatePath(`/events/${parsed.data.event_id}/review`);
}
