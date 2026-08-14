/**
 * Commerce relevance mapping (plan §113.3).
 * Commission is never a signal — only learning-related product groups.
 */

export type CommerceProductGroup =
  | "BOOK"
  | "LAPTOP_TABLET"
  | "MONITOR"
  | "KEYBOARD_MOUSE"
  | "HEADSET_WEBCAM_MIC"
  | "LAPTOP_STAND"
  | "DESK_LIGHT"
  | "STUDY_ACCESSORY"
  | "LAB_NETWORKING_DEVICE"
  | "OTHER_LEARNING_RELATED";

const TOPIC_GROUPS: Record<string, CommerceProductGroup[]> = {
  programming: ["BOOK", "KEYBOARD_MOUSE", "LAPTOP_STAND", "LAPTOP_TABLET"],
  ai: ["BOOK", "LAPTOP_TABLET", "HEADSET_WEBCAM_MIC"],
  "data-science": ["BOOK", "MONITOR", "KEYBOARD_MOUSE"],
  cloud: ["BOOK", "LAB_NETWORKING_DEVICE", "LAPTOP_TABLET"],
  cybersecurity: ["BOOK", "LAB_NETWORKING_DEVICE", "HEADSET_WEBCAM_MIC"],
  devops: ["BOOK", "LAPTOP_TABLET", "KEYBOARD_MOUSE"],
  design: ["MONITOR", "LAPTOP_TABLET", "DESK_LIGHT"],
  business: ["BOOK", "STUDY_ACCESSORY", "LAPTOP_STAND"],
  marketing: ["BOOK", "HEADSET_WEBCAM_MIC", "STUDY_ACCESSORY"],
  "soft-skills": ["BOOK", "HEADSET_WEBCAM_MIC", "STUDY_ACCESSORY"],
};

export function commerceGroupsForTopic(
  topicOrCategorySlug: string | null | undefined,
): CommerceProductGroup[] {
  if (!topicOrCategorySlug) {
    return ["BOOK", "STUDY_ACCESSORY", "OTHER_LEARNING_RELATED"];
  }
  return (
    TOPIC_GROUPS[topicOrCategorySlug] ?? [
      "BOOK",
      "STUDY_ACCESSORY",
      "OTHER_LEARNING_RELATED",
    ]
  );
}

export function isCommerceGroupRelevant(
  group: CommerceProductGroup | null | undefined,
  topicOrCategorySlug: string | null | undefined,
): boolean {
  if (!group) return false;
  return commerceGroupsForTopic(topicOrCategorySlug).includes(group);
}
