import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderScreen } from "./OrderScreen";

const { createOrder, fetchFragrances } = vi.hoisted(() => ({ createOrder: vi.fn(), fetchFragrances: vi.fn() }));

vi.mock("./api", () => ({ createOrder, fetchFragrances }));

vi.mock("@vibe/core", async (importOriginal) => {
  const actual = await importOriginal();

  const Dropdown = ({ options, value, onChange }) => (
    <div>
      <ul aria-label="menu">
        {options.map((o) => (
          <li key={o.value}>
            <button type="button" onClick={() => onChange([...value, o])}>
              {`add ${o.label}`}
            </button>
          </li>
        ))}
      </ul>
      {value.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => onChange(value.filter((x) => x.value !== v.value))}
        >
          {`remove ${v.label}`}
        </button>
      ))}
    </div>
  );

  return { ...actual, Dropdown };
});

const catalogue = ["Campfire", "Black Cedar", "Herb Garden", "Mint Leaf", "Wild Sage"].map((name, i) => ({
  id: `f${i}`,
  name,
  description: "x",
  category: "c",
  created_at: "",
  updated_at: "",
}));

beforeEach(() => {
  createOrder.mockReset().mockResolvedValue({ id: "901", name: "Order" });
  fetchFragrances.mockReset().mockResolvedValue(catalogue);

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const first = () => screen.getByPlaceholderText("Enter Customer First Name");
const last = () => screen.getByPlaceholderText("Enter Customer Lastname");
const quantity = () => document.querySelector('input[type="number"]');

const byAria = (name) => [...document.querySelectorAll("input")].find((i) => name.test(i.getAttribute("aria-label") ?? ""));
const inscription = () => byAria(/Inscription Request/i);

const start = () => screen.getByRole("button", { name: /start order/i });
const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";
const type = (el, value) => fireEvent.change(el, { target: { value } });

const ready = async () => {
  render(<OrderScreen boardId="42" />);
  await screen.findByText("add Campfire");
};

const pick = (...names) => names.forEach((n) => fireEvent.click(screen.getByText(`add ${n}`)));

const fillValid = () => {
  type(first(), "Dana");
  type(last(), "Reyes");
  pick("Campfire", "Black Cedar", "Herb Garden");
};

describe("loading states", () => {
  it("shows an error with Retry, and Retry reloads the catalogue", async () => {
    fetchFragrances.mockRejectedValueOnce(new Error("Missing or invalid session token."));
    render(<OrderScreen boardId="42" />);
    await screen.findByText("Could not load the fragrances");
    expect(screen.getByText("Missing or invalid session token.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("add Campfire");
    expect(fetchFragrances).toHaveBeenCalledTimes(2);
  });

  it("explains an empty catalogue instead of showing an empty picker", async () => {
    fetchFragrances.mockResolvedValue([]);
    render(<OrderScreen boardId="42" />);

    await screen.findByText(/No fragrances yet/);
    expect(screen.queryByText(/chosen/)).toBeNull();
  });
});

describe("choosing scents", () => {
  it("counts the chosen scents", async () => {
    await ready();
    expect(screen.getByText(/0 of 3 chosen/)).toBeTruthy();

    pick("Campfire");

    expect(screen.getByText(/1 of 3 chosen/)).toBeTruthy();
  });

  it("offers nothing new once 3 are chosen, so a 4th is impossible", async () => {
    await ready();

    pick("Campfire", "Black Cedar", "Herb Garden");

    expect(screen.queryByText("add Mint Leaf")).toBeNull();
    expect(screen.queryByText("add Wild Sage")).toBeNull();
    expect(screen.getByText(/3 of 3 chosen/)).toBeTruthy();
  });

  it("brings the other scents back when one is removed", async () => {
    await ready();
    pick("Campfire", "Black Cedar", "Herb Garden");

    fireEvent.click(screen.getByText("remove Black Cedar"));

    expect(screen.getByText("add Mint Leaf")).toBeTruthy();
    expect(screen.getByText(/2 of 3 chosen/)).toBeTruthy();
  });
});

describe("validation messages", () => {
  it("shows nothing red until the designer starts typing", async () => {
    await ready();

    expect(screen.queryByText("Enter the client's first name.")).toBeNull();
    expect(isDisabled(start())).toBe(true);
  });

  it.each(["", "   ", "\t"])("keeps Start Order disabled for a whitespace-only name %j", async (value) => {
    await ready();
    fillValid();

    type(first(), value);

    expect(isDisabled(start())).toBe(true);
    expect(screen.getAllByText("Enter the client's first name.").length).toBeGreaterThan(0);

    fireEvent.click(start());
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-3", "1.5", "1001"])("keeps Start Order disabled for quantity %j", async (value) => {
    await ready();
    fillValid();

    type(quantity(), value);

    expect(isDisabled(start())).toBe(true);
    expect(screen.getAllByText("Enter a whole number of boxes, from 1 to 1,000.").length).toBeGreaterThan(0);

    fireEvent.click(start());
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("disables Start Order for an inscription over 80 characters, and enables it at exactly 80", async () => {
    await ready();
    fillValid();

    type(inscription(), "x".repeat(81));

    expect(isDisabled(start())).toBe(true);
    expect(screen.getAllByText(/Keep the inscription to 80/).length).toBeGreaterThan(0);

    type(inscription(), "x".repeat(80));

    expect(isDisabled(start())).toBe(false);

    fireEvent.click(start());
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
  });

  it("keeps Start Order disabled with only two scents", async () => {
    await ready();
    type(first(), "Dana");
    type(last(), "Reyes");

    pick("Campfire", "Black Cedar");

    expect(isDisabled(start())).toBe(true);
    expect(screen.getAllByText("Pick exactly 3 scents.").length).toBeGreaterThan(0);

    fireEvent.click(start());
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("clears the messages once the fields are fixed", async () => {
    await ready();

    type(first(), " ");
    expect(screen.getAllByText("Enter the client's first name.").length).toBeGreaterThan(0);

    fillValid();

    expect(screen.queryByText("Enter the client's first name.")).toBeNull();
    expect(isDisabled(start())).toBe(false);
  });
});

describe("the running total", () => {
  it.each([
    ["1", "1 box, 3 candles"],
    ["12", "12 boxes, 36 candles"],
  ])("quantity %s reads '%s'", async (value, expected) => {
    await ready();

    type(quantity(), value);

    expect(screen.getByText(new RegExp(expected))).toBeTruthy();
  });

  it.each(["", "0", "2.5"])("shows no total for quantity %j", async (value) => {
    await ready();

    type(quantity(), value);

    expect(screen.queryByText(/candles/)).toBeNull();
  });

  it("counts the trimmed inscription length", async () => {
    await ready();

    type(inscription(), "  hello  ");

    expect(screen.getByText(/^5\/80 characters/)).toBeTruthy();
  });
});

describe("submitting", () => {
  it("creates one item with the chosen scents in order, then resets the form", async () => {
    await ready();
    fillValid();
    type(quantity(), "3");

    fireEvent.click(start());

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    const args = createOrder.mock.calls[0][0];
    expect(args.boardId).toBe("42");
    expect(args.fragranceIds).toEqual(["f0", "f1", "f2"]);
    expect(args.quantity).toBe(3);
    expect(args.receivedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await waitFor(() => expect(first().value).toBe(""));
    expect(last().value).toBe("");
    expect(quantity().value).toBe("1");
    expect(screen.getByText(/0 of 3 chosen/)).toBeTruthy();
    expect(await screen.findByText(/Order created on the board \(item 901\)/)).toBeTruthy();
  });

  it("ignores a double click while the first request is still running", async () => {
    let finish = () => undefined;
    createOrder.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ id: "1", name: "Order" }))));
    await ready();
    fillValid();

    fireEvent.click(start());
    fireEvent.click(start());
    fireEvent.click(start());

    expect(createOrder).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(first().value).toBe(""));
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("shows the failure, keeps the form filled, and lets Try again succeed", async () => {
    createOrder.mockRejectedValueOnce(new Error("Column not found"));
    await ready();
    fillValid();
    fireEvent.click(start());

    await screen.findByText("The order was not created");
    expect(screen.getByText("Column not found")).toBeTruthy();
    expect(first().value).toBe("Dana");
    expect(screen.getByText(/3 of 3 chosen/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("The order was not created")).toBeNull());
    expect(first().value).toBe("");
  });

  it("falls back to a plain message when the failure is not an Error", async () => {
    createOrder.mockRejectedValueOnce("nope");
    await ready();
    fillValid();

    fireEvent.click(start());

    expect(await screen.findByText("The order could not be created.")).toBeTruthy();
  });

  it("can be submitted again after a success without leftover state", async () => {
    await ready();
    fillValid();
    fireEvent.click(start());
    await waitFor(() => expect(first().value).toBe(""));

    fillValid();
    fireEvent.click(start());

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
  });
});
