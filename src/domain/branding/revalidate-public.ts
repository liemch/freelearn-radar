import { revalidatePath } from "next/cache";

import { listTopicSlugs } from "@/domain/discovery/topic-landings";

/**
 * Smallest post-M22 fix for stale SSG branding: after Admin uploads/edits,
 * revalidate public shells that may have baked default logos at build time.
 */
export function revalidatePublicBranding(): void {
  revalidatePath("/", "layout");
  revalidatePath("/vi");
  revalidatePath("/en");
  for (const topic of listTopicSlugs()) {
    revalidatePath(`/vi/free-courses/${topic}`);
    revalidatePath(`/en/free-courses/${topic}`);
  }
}
