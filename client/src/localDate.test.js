import { describe, expect, it } from "vitest";
import { localDate } from "./localDate";

describe("localDate", () => {
  it("uses the local calendar day, not UTC", () => {
    expect(localDate(new Date(2026, 9, 30, 17, 10))).toBe("2026-10-30");
  });

  it("pads month and day", () => {
    expect(localDate(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });
});
