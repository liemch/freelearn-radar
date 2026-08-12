import type {
  CourseStatus,
  PriceType,
} from "@/domain/course/types";
import { assertCourseStatusTransition } from "@/domain/course/transitions";

export type ExpirationDecision = {
  nextStatus: CourseStatus;
  reason: string;
  shouldUpdate: boolean;
};

/**
 * Decide course lifecycle updates from verification outcomes.
 * Never deletes historical courses.
 */
export function decideExpiration(input: {
  currentStatus: CourseStatus;
  observedPriceType: PriceType;
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  pricingConfidence: number;
}): ExpirationDecision {
  const { currentStatus, observedPriceType, availability, pricingConfidence } =
    input;

  if (currentStatus === "ARCHIVED" || currentStatus === "DRAFT") {
    return {
      nextStatus: currentStatus,
      reason: "Non-public lifecycle unchanged",
      shouldUpdate: false,
    };
  }

  if (availability === "UNAVAILABLE") {
    const nextStatus: CourseStatus = "UNAVAILABLE";
    if (canMove(currentStatus, nextStatus)) {
      return {
        nextStatus,
        reason: "Evidence indicates course unavailable",
        shouldUpdate: currentStatus !== nextStatus,
      };
    }
  }

  if (
    observedPriceType === "PAID" &&
    pricingConfidence >= 0.7 &&
    currentStatus === "PUBLISHED"
  ) {
    return {
      nextStatus: "EXPIRED",
      reason: "Free offer ended — course now paid",
      shouldUpdate: true,
    };
  }

  if (
    (observedPriceType === "FREE_FULL" ||
      observedPriceType === "FREE_AUDIT" ||
      observedPriceType === "TEMPORARILY_FREE" ||
      observedPriceType === "FREE_WITH_COUPON") &&
    pricingConfidence >= 0.7 &&
    (currentStatus === "EXPIRED" || currentStatus === "UNAVAILABLE")
  ) {
    return {
      nextStatus: "PUBLISHED",
      reason: "Free offer restored",
      shouldUpdate: true,
    };
  }

  return {
    nextStatus: currentStatus,
    reason: "No expiration transition",
    shouldUpdate: false,
  };
}

function canMove(from: CourseStatus, to: CourseStatus): boolean {
  try {
    assertCourseStatusTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
