import { describe, expect, it } from "vitest";
import { MAX_INSCRIPTION, validateOrder } from "./order.js";

const validOrder = {
  firstName: "Dana",
  lastName: "Reyes",
  quantity: 12,
  fragranceIds: ["a", "b", "c"],
  inscription: "",
};

const check = (patch) => validateOrder({ ...validOrder, ...patch });

describe("quantity edge cases", () => {
  it.each([0, -1, -0, 0.5, 1.0000001, 1001, 1_000_000, NaN, Infinity, -Infinity, null])("rejects %s", (quantity) => {
    expect(check({ quantity }).quantity).toBeTruthy();
  });

  it.each([1, 2, 999, 1000])("accepts %s (up to the 1,000 cap)", (quantity) => {
    expect(check({ quantity }).quantity).toBeUndefined();
  });
});

describe("name edge cases", () => {
  it.each(["", " ", "\t", "\n", "   \t\n  "])("rejects whitespace-only %j", (value) => {
    expect(check({ firstName: value }).firstName).toBeTruthy();
    expect(check({ lastName: value }).lastName).toBeTruthy();
  });

  it.each(["O'Brien", "Zoë", "李", "Anne-Marie", "<script>alert(1)</script>", "a".repeat(500)])("accepts %j", (value) => {
    expect(check({ firstName: value, lastName: value })).toEqual({});
  });
});

describe("scent edge cases", () => {
  it.each([[[]], [["a"]], [["a", "b"]], [["a", "b", "c", "d"]]])("rejects the wrong count %j", (ids) => {
    expect(check({ fragranceIds: ids }).fragranceIds).toContain("exactly 3");
  });

  it.each([[["a", "a", "b"]], [["a", "b", "a"]], [["a", "a", "a"]], [["a", "a"]]])(
    "reports duplicates, not the count, for %j",
    (ids) => {
      expect(check({ fragranceIds: ids }).fragranceIds).toBe("Pick 3 different scents.");
    },
  );

  it("treats ids as case-sensitive, like the database does", () => {
    expect(check({ fragranceIds: ["a", "A", "b"] }).fragranceIds).toBeUndefined();
  });
});

describe("inscription edge cases", () => {
  it("accepts empty and spaces-only (trimmed to nothing)", () => {
    expect(check({ inscription: "" }).inscription).toBeUndefined();
    expect(check({ inscription: "     " }).inscription).toBeUndefined();
  });

  it("accepts exactly the maximum and rejects one over", () => {
    expect(check({ inscription: "x".repeat(MAX_INSCRIPTION) }).inscription).toBeUndefined();
    expect(check({ inscription: "x".repeat(MAX_INSCRIPTION + 1) }).inscription).toBeTruthy();
  });

  it("measures after trimming, so padding never causes a rejection", () => {
    expect(check({ inscription: ` ${"x".repeat(MAX_INSCRIPTION)} ` }).inscription).toBeUndefined();
  });

  it("counts UTF-16 units: an emoji is 2, so 41 emoji exceed 80 (known limit)", () => {
    expect(check({ inscription: "😀".repeat(40) }).inscription).toBeUndefined();
    expect(check({ inscription: "😀".repeat(41) }).inscription).toBeTruthy();
  });
});

describe("several problems at once", () => {
  it("reports every failing field and nothing else", () => {
    const errors = validateOrder({
      firstName: "",
      lastName: " ",
      quantity: 0,
      fragranceIds: [],
      inscription: "x".repeat(81),
    });

    expect(Object.keys(errors)).toEqual(["firstName", "lastName", "quantity", "fragranceIds", "inscription"]);
  });

  it("keeps the form's first-error order stable", () => {
    const errors = validateOrder({ ...validOrder, firstName: "", quantity: 0 });

    expect(Object.values(errors)[0]).toBe("Enter the client's first name.");
  });
});
