import { revalidatePath, revalidateTag } from "next/cache";

import { SITE_BRANDING_CACHE_TAG } from "@/domain/branding/get-resolved-branding";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";

/**
 * After Admin branding mutations: bust tagged cache + ISR shells.
 */
export function revalidatePublicBranding(): void {
  revalidateTag(SITE_BRANDING_CACHE_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/vi");
  revalidatePath("/en");
  for (const topic of listTopicSlugs()) {
    revalidatePath(`/vi/free-courses/${topic}`);
    revalidatePath(`/en/free-courses/${topic}`);
  }
}
