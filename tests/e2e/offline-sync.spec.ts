import { test, expect } from "@playwright/test";
import { registerAndLogin, createDocument, typeInEditor, uniqueEmail } from "./helpers";

test.describe("local-first offline sync engine", () => {
  test("persists edits locally and reconciles after going offline", async ({ page }) => {
    await registerAndLogin(page, uniqueEmail("offline"));
    await createDocument(page);

    await typeInEditor(page, "First line written online. ");
    await expect(page.getByRole("status")).toContainText(/synced/i, { timeout: 15_000 });

    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText("First line written online.");

    await page.context().setOffline(true);
    await typeInEditor(page, "Written while OFFLINE. ");
    await expect(page.getByRole("status")).toContainText(/offline/i, { timeout: 15_000 });
    await expect(page.locator(".ProseMirror")).toContainText("Written while OFFLINE.");

    await page.context().setOffline(false);
    await expect(page.getByRole("status")).toContainText(/synced/i, { timeout: 20_000 });
    await expect(page.locator(".ProseMirror")).toContainText("First line written online.");
    await expect(page.locator(".ProseMirror")).toContainText("Written while OFFLINE.");
  });
});
