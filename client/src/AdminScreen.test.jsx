import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminScreen } from "./AdminScreen";

const api = vi.hoisted(() => ({
  fetchFragrances: vi.fn(),
  addFragrance: vi.fn(),
  updateFragrance: vi.fn(),
  deleteFragrance: vi.fn(),
}));

vi.mock("./api", () => {
  class ApiError extends Error {
    status;
    fields;

    constructor(status, message, fields) {
      super(message);
      this.status = status;
      this.fields = fields;
    }
  }

  return { ...api, ApiError };
});

import { ApiError } from "./api";

const make = (id, name, category = "Smokey", extra = {}) => ({
  id,
  name,
  category,
  description: `${name} notes`,
  created_at: "",
  updated_at: "",
  ...extra,
});

const library = [make("1", "Campfire"), make("2", "Herb Garden", "Herbaceous"), make("3", "Lemon Zest", "Citrus")];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchFragrances.mockResolvedValue(library);
  api.addFragrance.mockResolvedValue({});
  api.updateFragrance.mockResolvedValue({});
  api.deleteFragrance.mockResolvedValue(undefined);

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const ready = async () => {
  render(<AdminScreen />);
  await screen.findByText("Campfire");
};

const field = (name) => [...document.querySelectorAll("input")].find((i) => name.test(i.getAttribute("aria-label") ?? ""));
const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";
const type = (el, value) => fireEvent.change(el, { target: { value } });
const openAdd = () => fireEvent.click(screen.getByRole("button", { name: "Add fragrance" }));

const fillNew = (name = "Rose Petal") => {
  type(field(/^Name$/), name);
  type(field(/^Category$/), "Floral");
  type(field(/^Description/), "Soft rose");
};

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("loading", () => {
  it("lists every scent with its category", async () => {
    await ready();

    expect(screen.getByText("Herb Garden")).toBeTruthy();
    expect(screen.getByText(/Citrus/)).toBeTruthy();
  });

  it("explains an empty library", async () => {
    api.fetchFragrances.mockResolvedValue([]);
    render(<AdminScreen />);

    await screen.findByText(/No fragrances yet/);
  });

  it("shows the load failure with a working Retry button", async () => {
    api.fetchFragrances.mockRejectedValueOnce(new Error("Missing or invalid session token."));
    render(<AdminScreen />);
    await screen.findByText("Something went wrong");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Campfire");
    expect(api.fetchFragrances).toHaveBeenCalledTimes(2);
  });
});

describe("search", () => {
  const search = () => screen.getByPlaceholderText("Search fragrances");

  it("filters by name, category and scent notes, ignoring case", async () => {
    await ready();

    type(search(), "CAMP");
    await waitFor(() => expect(screen.queryByText("Herb Garden")).toBeNull());

    type(search(), "citrus");
    await waitFor(() => expect(screen.queryByText("Campfire")).toBeNull());
    expect(screen.getByText("Lemon Zest")).toBeTruthy();

    type(search(), "garden notes");
    await waitFor(() => expect(screen.queryByText("Lemon Zest")).toBeNull());
    expect(screen.getByText("Herb Garden")).toBeTruthy();
  });

  it("says so when nothing matches, and recovers when cleared", async () => {
    await ready();

    type(search(), "zzz");
    expect(await screen.findByText("No fragrances match.")).toBeTruthy();

    type(search(), "");
    expect(await screen.findByText("Campfire")).toBeTruthy();
  });
});

describe("adding", () => {
  it("sends trimmed-by-server input and omits a blank image URL", async () => {
    await ready();
    openAdd();
    fillNew();

    save();

    await waitFor(() => expect(api.addFragrance).toHaveBeenCalledTimes(1));
    expect(api.addFragrance).toHaveBeenCalledWith({ name: "Rose Petal", category: "Floral", description: "Soft rose" });
  });

  it("includes a trimmed image URL when given", async () => {
    await ready();
    openAdd();
    fillNew();
    type(field(/^Image URL/), "  https://x.test/a.png  ");

    save();

    await waitFor(() => expect(api.addFragrance).toHaveBeenCalled());
    expect(api.addFragrance.mock.calls[0][0].image_url).toBe("https://x.test/a.png");
  });

  it("closes the form, confirms, and reloads the list after saving", async () => {
    await ready();
    openAdd();
    fillNew();

    save();

    expect(await screen.findByText("Added Rose Petal.")).toBeTruthy();
    expect(screen.queryByText("New fragrance")).toBeNull();
    expect(api.fetchFragrances).toHaveBeenCalledTimes(2);
  });

  it("disables Add fragrance while a form is open", async () => {
    await ready();
    openAdd();

    expect(isDisabled(screen.getByRole("button", { name: "Add fragrance" }))).toBe(true);
  });

  it("Cancel discards the form without saving", async () => {
    await ready();
    openAdd();
    fillNew();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.addFragrance).not.toHaveBeenCalled();
    expect(screen.queryByText("New fragrance")).toBeNull();
  });

  it("reopens blank after a cancelled attempt", async () => {
    await ready();
    openAdd();
    fillNew("Half typed");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    openAdd();

    expect(field(/^Name$/).value).toBe("");
  });

  it("ignores a double click on Save", async () => {
    let finish = () => undefined;
    api.addFragrance.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await ready();
    openAdd();
    fillNew();

    save();
    save();
    save();

    expect(api.addFragrance).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText("Added Rose Petal.");
  });
});

describe("server errors on save", () => {
  const duplicate = () => new ApiError(409, "A fragrance with this name already exists.", { name: "Already exists" });

  it("shows a duplicate name beside the Name field and keeps the form open", async () => {
    api.addFragrance.mockRejectedValueOnce(duplicate());
    await ready();
    openAdd();
    fillNew("campfire");

    save();

    expect(await screen.findByText("Already exists")).toBeTruthy();
    expect(screen.getByText("A fragrance with this name already exists.")).toBeTruthy();
    expect(field(/^Name$/).value).toBe("campfire");
  });

  it("clears the stale error as soon as the field is edited", async () => {
    api.addFragrance.mockRejectedValueOnce(duplicate());
    await ready();
    openAdd();
    fillNew("campfire");
    save();
    await screen.findByText("Already exists");

    type(field(/^Name$/), "campfire 2");

    expect(screen.queryByText("Already exists")).toBeNull();
    expect(screen.queryByText("A fragrance with this name already exists.")).toBeNull();
  });

  it("clears the error for the edited field only", async () => {
    api.addFragrance.mockRejectedValueOnce(
      new ApiError(400, "Bad", { name: "Name is required", category: "Category is required" }),
    );
    await ready();
    openAdd();
    save();
    await screen.findByText("Category is required");

    type(field(/^Name$/), "x");

    expect(screen.queryByText("Name is required")).toBeNull();
    expect(screen.getByText("Category is required")).toBeTruthy();
  });

  it("falls back to a plain message for a non-API failure", async () => {
    api.addFragrance.mockRejectedValueOnce(new TypeError("network down"));
    await ready();
    openAdd();
    fillNew();

    save();

    expect(await screen.findByText("Could not save. Try again.")).toBeTruthy();
  });

  it("lets the user fix the problem and save successfully", async () => {
    api.addFragrance.mockRejectedValueOnce(duplicate());
    await ready();
    openAdd();
    fillNew("campfire");
    save();
    await screen.findByText("Already exists");

    type(field(/^Name$/), "Campfire Two");
    save();

    expect(await screen.findByText("Added Campfire Two.")).toBeTruthy();
  });
});

describe("editing", () => {
  it("opens with the scent's current values", async () => {
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Edit Herb Garden" }));

    expect(field(/^Name$/).value).toBe("Herb Garden");
    expect(field(/^Category$/).value).toBe("Herbaceous");
    expect(screen.getByText("Edit fragrance")).toBeTruthy();
  });

  it("shows an existing image URL and sends updates to that id", async () => {
    api.fetchFragrances.mockResolvedValue([make("9", "Pic", "c", { image_url: "https://x.test/p.png" })]);
    render(<AdminScreen />);
    await screen.findByText("Pic");
    fireEvent.click(screen.getByRole("button", { name: "Edit Pic" }));
    expect(field(/^Image URL/).value).toBe("https://x.test/p.png");
    type(field(/^Category$/), "Green");

    save();

    await waitFor(() => expect(api.updateFragrance).toHaveBeenCalledTimes(1));
    expect(api.updateFragrance.mock.calls[0][0]).toBe("9");
    expect(api.updateFragrance.mock.calls[0][1].category).toBe("Green");
    expect(await screen.findByText("Saved Pic.")).toBeTruthy();
  });
});

describe("deleting", () => {
  it("asks first, and names the scent in the question", async () => {
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Delete Herb Garden" }));

    expect(screen.getByText("Delete Herb Garden?")).toBeTruthy();
    expect(api.deleteFragrance).not.toHaveBeenCalled();
  });

  it("Keep cancels without deleting", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Delete Herb Garden" }));

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(api.deleteFragrance).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete Herb Garden?")).toBeNull();
  });

  it("asks about one scent at a time", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Delete Campfire" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Lemon Zest" }));

    expect(screen.queryByText("Delete Campfire?")).toBeNull();
    expect(screen.getByText("Delete Lemon Zest?")).toBeTruthy();
  });

  it("deletes the right id, confirms, and reloads", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Delete Herb Garden" }));
    const question = screen.getByText("Delete Herb Garden?").parentElement;

    fireEvent.click(within(question).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(api.deleteFragrance).toHaveBeenCalledWith("2"));
    expect(await screen.findByText("Deleted Herb Garden.")).toBeTruthy();
    expect(api.fetchFragrances).toHaveBeenCalledTimes(2);
  });

  it("shows the failure with Retry when the delete is refused", async () => {
    api.deleteFragrance.mockRejectedValueOnce(new Error("Fragrance not found."));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Delete Campfire" }));
    const question = screen.getByText("Delete Campfire?").parentElement;

    fireEvent.click(within(question).getByRole("button", { name: "Delete" }));

    await screen.findByText("Fragrance not found.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText("Delete Campfire?")).toBeNull();
  });
});
