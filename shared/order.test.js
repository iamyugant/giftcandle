import { describe, expect, it } from "vitest";
import { validateOrder } from "./order.js";

const validOrder = {
  firstName: "Dana",
  lastName: "Reyes",
  quantity: 12,
  fragranceIds: ["a", "b", "c"],
  inscription: "",
};

const errorsFor = (patch) => validateOrder({ ...validOrder, ...patch });

describe("validateOrder", () => {
  it("accepts a complete order", () => {
    expect(validateOrder(validOrder)).toEqual({});
  });

  it("requires exactly 3 scents", () => {
    expect(errorsFor({ fragranceIds: ["a", "b"] }).fragranceIds).toBeTruthy();
    expect(errorsFor({ fragranceIds: ["a", "b", "c", "d"] }).fragranceIds).toBeTruthy();
    expect(errorsFor({ fragranceIds: [] }).fragranceIds).toBeTruthy();
  });

  it("rejects the same scent twice", () => {
    expect(errorsFor({ fragranceIds: ["a", "a", "b"] }).fragranceIds).toBeTruthy();
  });

  it("requires a whole number of kits from 1 to 1,000", () => {
    for (const quantity of [null, 0, -3, 1.5, Number.NaN, 1001]) {
      expect(errorsFor({ quantity }).quantity, String(quantity)).toBeTruthy();
    }
    expect(errorsFor({ quantity: 1 }).quantity).toBeUndefined();
    expect(errorsFor({ quantity: 1000 }).quantity).toBeUndefined();
  });

  it("requires both names, ignoring spaces", () => {
    expect(errorsFor({ firstName: "   " }).firstName).toBeTruthy();
    expect(errorsFor({ lastName: "" }).lastName).toBeTruthy();
  });

  it("trims the inscription before checking its length", () => {
    expect(errorsFor({ inscription: `  ${"x".repeat(80)}  ` }).inscription).toBeUndefined();
    expect(errorsFor({ inscription: "x".repeat(81) }).inscription).toBeTruthy();
  });
});
