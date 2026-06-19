"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { setBlock } from "@spotomo/domain-common";

export async function unblock(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await setBlock(supabase, {
    blockerId: user.id,
    blockedId: String(formData.get("blocked_id")),
    block: false,
  });
  revalidatePath("/blocks");
}
