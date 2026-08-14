import { describe, expect, it } from "vitest";

import {
  buildTrackedAffiliatePath,
  disclosureLabel,
  hostAllowed,
  resolveAffiliateDestination,
  validateAffiliateDestination,
} from "@/domain/affiliate/affiliate-link-service";
import {
  commerceGroupsForTopic,
  isCommerceGroupRelevant,
} from "@/domain/affiliate/commerce-relevance";
import { defaultLocale, PUBLIC_LANGUAGE_SWITCHER } from "@/lib/i18n/config";

describe("affiliate link service", () => {
  it("rejects javascript and data schemes", () => {
    expect(() => validateAffiliateDestination("javascript:alert(1)")).toThrow();
    expect(() => validateAffiliateDestination("data:text/html,hi")).toThrow();
  });

  it("allowlists hosts", () => {
    expect(hostAllowed("www.coursera.org", ["coursera.org"])).toBe(true);
    expect(hostAllowed("evil.com", ["coursera.org"])).toBe(false);
  });

  it("resolves allowlisted destinations", () => {
    const url = resolveAffiliateDestination({
      template: "https://www.coursera.org/learn/python",
      allowedHosts: ["coursera.org"],
    });
    expect(url).toContain("coursera.org");
  });

  it("rejects non-allowlisted hosts", () => {
    expect(() =>
      resolveAffiliateDestination({
        template: "https://evil.example/phish",
        allowedHosts: ["coursera.org"],
      }),
    ).toThrow(/allowlisted/);
  });

  it("builds tracked paths without open redirects", () => {
    const path = buildTrackedAffiliatePath({
      campaignKey: "coursera-next-step",
      placementKey: "COURSE_DETAIL_RELATED_LEARNING",
      courseSlug: "azure-fundamentals",
      locale: "vi",
    });
    expect(path.startsWith("/go/affiliate?")).toBe(true);
    expect(path).toContain("campaign=coursera-next-step");
  });

  it("returns Vietnamese disclosure by default for vi", () => {
    expect(disclosureLabel("vi")).toBe("Liên kết tiếp thị");
    expect(disclosureLabel("en")).toBe("Affiliate link");
  });
});

describe("commerce relevance", () => {
  it("maps programming to learning gear groups", () => {
    expect(commerceGroupsForTopic("programming")).toContain("BOOK");
    expect(isCommerceGroupRelevant("BOOK", "programming")).toBe(true);
    expect(isCommerceGroupRelevant("LAB_NETWORKING_DEVICE", "design")).toBe(
      false,
    );
  });
});

describe("M20.14 vietnamese-only direction", () => {
  it("defaults locale to vi and hides public switcher", () => {
    expect(defaultLocale).toBe("vi");
    expect(PUBLIC_LANGUAGE_SWITCHER).toBe(false);
  });
});
