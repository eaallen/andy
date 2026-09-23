import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMessagesPanel } from "../js/messages-panel.js";

describe("createMessagesPanel", () => {
  /** @type {HTMLElement} */
  let mount;
  /** @type {ReturnType<typeof createMessagesPanel>} */
  let panel;

  beforeEach(() => {
    mount = document.createElement("div");
    document.body.appendChild(mount);
    panel = createMessagesPanel(mount);
  });

  afterEach(() => {
    mount.remove();
  });

  it("starts hidden and appends the panel to the mount", () => {
    expect(panel.el.hidden).toBe(true);
    expect(panel.el.getAttribute("data-lab-messages")).toBe("");
    expect(mount.contains(panel.el)).toBe(true);
  });

  it("shows a string body with the requested variant", () => {
    panel.show({
      variant: "success",
      title: "Pass",
      body: "Circuit looks good.",
    });

    expect(panel.el.hidden).toBe(false);
    expect(panel.el.classList.contains("lab-messages-panel--success")).toBe(
      true,
    );
    expect(panel.el.getAttribute("role")).toBe("status");
    expect(
      panel.el.querySelector("[data-lab-messages-title]").textContent,
    ).toBe("Pass");
    expect(
      panel.el.querySelector("[data-lab-messages-body]").textContent,
    ).toBe("Circuit looks good.");
  });

  it("falls back to the info variant for unknown or missing variants", () => {
    panel.show({ title: "Note", body: "hello" });
    expect(panel.el.classList.contains("lab-messages-panel--info")).toBe(true);
    expect(panel.el.getAttribute("role")).toBe("status");

    panel.show({ variant: "wat", title: "Still", body: "info" });
    expect(panel.el.classList.contains("lab-messages-panel--info")).toBe(true);
    expect(panel.el.classList.contains("lab-messages-panel--success")).toBe(
      false,
    );
  });

  it("appends a Node body and uses alert role for failure", () => {
    const list = document.createElement("ul");
    const item = document.createElement("li");
    item.textContent = "Missing wire";
    list.appendChild(item);

    panel.show({
      variant: "failure",
      title: "Fail",
      body: list,
    });

    expect(panel.el.classList.contains("lab-messages-panel--failure")).toBe(
      true,
    );
    expect(panel.el.getAttribute("role")).toBe("alert");
    const body = panel.el.querySelector("[data-lab-messages-body]");
    expect(body.querySelector("ul")).toBe(list);
    expect(body.textContent).toBe("Missing wire");
  });

  it("replaces previous content on a second show", () => {
    panel.show({ variant: "info", title: "First", body: "one" });
    panel.show({
      variant: "success",
      title: "Second",
      body: "two",
    });

    expect(panel.el.classList.contains("lab-messages-panel--success")).toBe(
      true,
    );
    expect(panel.el.classList.contains("lab-messages-panel--info")).toBe(
      false,
    );
    expect(
      panel.el.querySelector("[data-lab-messages-title]").textContent,
    ).toBe("Second");
    expect(
      panel.el.querySelector("[data-lab-messages-body]").textContent,
    ).toBe("two");
  });

  it("dismisses via API, close button, and Escape", () => {
    panel.show({ variant: "info", title: "Hi", body: "there" });
    panel.dismiss();
    expect(panel.el.hidden).toBe(true);
    expect(
      panel.el.querySelector("[data-lab-messages-body]").textContent,
    ).toBe("");

    panel.show({ variant: "info", title: "Hi", body: "again" });
    panel.el
      .querySelector(".lab-messages-dismiss")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.el.hidden).toBe(true);

    panel.show({ variant: "info", title: "Hi", body: "escape me" });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(panel.el.hidden).toBe(true);
  });

  it("drags from the header and clamps inside the mount", () => {
    mount.style.position = "relative";
    mount.style.width = "400px";
    mount.style.height = "300px";
    panel.el.style.width = "120px";
    panel.show({ variant: "info", title: "Drag me", body: "body" });

    const header = panel.el.querySelector(".lab-messages-header");
    header.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: 300,
        clientY: 220,
      }),
    );
    header.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: 40,
        clientY: 30,
      }),
    );
    header.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
      }),
    );

    expect(panel.el.style.left).toBe("8px");
    expect(panel.el.style.top).toBe("8px");
    expect(panel.el.style.right).toBe("auto");
    expect(panel.el.style.bottom).toBe("auto");
  });

  it("does not start a drag from the dismiss button", () => {
    mount.style.position = "relative";
    mount.style.width = "400px";
    mount.style.height = "300px";
    panel.show({ variant: "info", title: "Stay", body: "put" });

    const dismissBtn = panel.el.querySelector(".lab-messages-dismiss");
    dismissBtn.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 2,
        button: 0,
        clientX: 350,
        clientY: 250,
      }),
    );

    expect(panel.el.style.left).toBe("");
    expect(panel.el.classList.contains("is-dragging")).toBe(false);
  });

  it("minimizes and restores the message body", () => {
    panel.show({ variant: "info", title: "Fail", body: "details" });
    const minimizeBtn = panel.el.querySelector(".lab-messages-minimize");
    const body = panel.el.querySelector("[data-lab-messages-body]");

    minimizeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.el.classList.contains("lab-messages-panel--minimized")).toBe(
      true,
    );
    expect(body.hidden).toBe(true);
    expect(minimizeBtn.getAttribute("aria-label")).toBe("Restore message");

    minimizeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.el.classList.contains("lab-messages-panel--minimized")).toBe(
      false,
    );
    expect(body.hidden).toBe(false);
    expect(minimizeBtn.getAttribute("aria-label")).toBe("Minimize message");
  });

  it("expands again when a new message is shown", () => {
    panel.show({ variant: "info", title: "Old", body: "one" });
    panel.el
      .querySelector(".lab-messages-minimize")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.el.classList.contains("lab-messages-panel--minimized")).toBe(
      true,
    );

    panel.show({ variant: "success", title: "New", body: "two" });
    expect(panel.el.classList.contains("lab-messages-panel--minimized")).toBe(
      false,
    );
    expect(
      panel.el.querySelector("[data-lab-messages-body]").hidden,
    ).toBe(false);
  });

  it("restores upward when the minimized bar is near the bottom", () => {
    mount.style.position = "relative";
    Object.defineProperty(mount, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(mount, "clientHeight", { configurable: true, value: 240 });
    mount.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 240,
        right: 400,
        width: 400,
        height: 240,
        toJSON: function () {},
      };
    };

    panel.show({
      variant: "failure",
      title: "Fail",
      body: "line one\nline two\nline three\nline four\nline five",
    });

    const minimizeBtn = panel.el.querySelector(".lab-messages-minimize");
    minimizeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    Object.defineProperty(panel.el, "offsetWidth", {
      configurable: true,
      value: 160,
    });
    Object.defineProperty(panel.el, "offsetHeight", {
      configurable: true,
      get: function () {
        return panel.el.classList.contains("lab-messages-panel--minimized")
          ? 40
          : 140;
      },
    });
    panel.el.getBoundingClientRect = function () {
      const height = panel.el.offsetHeight;
      const top = panel.el.style.top ? parseFloat(panel.el.style.top) : 192;
      const left = panel.el.style.left ? parseFloat(panel.el.style.left) : 232;
      return {
        x: left,
        y: top,
        top: top,
        left: left,
        bottom: top + height,
        right: left + 160,
        width: 160,
        height: height,
        toJSON: function () {},
      };
    };

    const header = panel.el.querySelector(".lab-messages-header");
    header.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 3,
        button: 0,
        clientX: 300,
        clientY: 210,
      }),
    );
    header.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 3,
        clientX: 300,
        clientY: 230,
      }),
    );
    header.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 3,
      }),
    );

    const minimizedTop = parseFloat(panel.el.style.top);
    expect(minimizedTop).toBeGreaterThan(150);

    minimizeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const restoredTop = parseFloat(panel.el.style.top);
    const restoredBottom = restoredTop + panel.el.offsetHeight;
    expect(restoredTop).toBeLessThan(minimizedTop);
    expect(restoredBottom).toBeLessThanOrEqual(232);
    expect(
      panel.el.querySelector("[data-lab-messages-body]").hidden,
    ).toBe(false);
  });
});
