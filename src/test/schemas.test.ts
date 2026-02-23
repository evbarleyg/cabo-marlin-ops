import { describe, expect, it } from "vitest";
import { conditionsEnvelopeSchema } from "@/lib/schemas";

describe("schema validation", () => {
  it("rejects malformed envelope payloads", () => {
    const malformed = {
      generated_at: "not-date",
      sources: [],
      data: {},
    };

    const result = conditionsEnvelopeSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });
});
