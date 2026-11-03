import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderScreen } from "./OrderScreen";

const createOrder = vi.fn();

vi.mock("./api", () => ({
  fetchFragrances: () =>
    Promise.resolve(
      ["Campfire", "Black Cedar", "Herb Garden"].map((name, i) => ({
        id: `f${i}`,
        name,
        description: "x",
        category: "Smokey",
        created_at: "",
        updated_at: "",
      })),
    ),
  createOrder: (...args) => createOrder(...args),
}));

beforeEach(() => {
  createOrder.mockReset();

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";
const start = () => screen.getByRole("button", { name: /start order/i });

const fillNames = () => {
  fireEvent.change(screen.getByPlaceholderText("Enter Customer First Name"), { target: { value: "Dana" } });
  fireEvent.change(screen.getByPlaceholderText("Enter Customer Lastname"), { target: { value: "Reyes" } });
};

describe("OrderScreen", () => {
  it("keeps Start Order disabled until 3 different scents are chosen, and says why", async () => {
    render(<OrderScreen boardId="1" />);
    await waitFor(() => expect(screen.getByText(/0 of 3 chosen/)).toBeTruthy());
    fillNames();

    expect(isDisabled(start())).toBe(true);

    fireEvent.click(start());
    expect(createOrder).not.toHaveBeenCalled();
    expect(screen.getAllByText("Pick exactly 3 scents.").length).toBeGreaterThan(0);
  });

  it("keeps Start Order disabled until both names are given", async () => {
    render(<OrderScreen boardId="1" />);
    await waitFor(() => expect(screen.getByText(/0 of 3 chosen/)).toBeTruthy());
    expect(isDisabled(start())).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Enter Customer First Name"), { target: { value: "Dana" } });

    expect(isDisabled(start())).toBe(true);
    expect(screen.getAllByText("Enter the client's last name.").length).toBeGreaterThan(0);
    expect(createOrder).not.toHaveBeenCalled();
  });
});
