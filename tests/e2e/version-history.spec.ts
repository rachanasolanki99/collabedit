import { test, expect } from "@playwright/test";
import { registerAndLogin, createDocument, typeInEditor, uniqueEmail } from "./helpers";

test.describe("version history", () => {
  test("captures a snapshot and restores it after further edits", async ({ page }) => {
    await registerAndLogin(page, uniqueEmail("versions"));
    await createDocument(page);

    await typeInEditor(page, "Original draft content. ");
    await expect(page.getByRole("status")).toContainText(/synced/i, { timeout: 15_000 });

    await page.click('button:has-text("History")');
    await page.fill("#snapshot-label", "First draft");
    await page.click('button:has-text("Capture")');
    await expect(page.getByText("First draft")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    await typeInEditor(page, "Later unwanted edits. ");
    await expect(page.locator(".ProseMirror")).toContainText("Later unwanted edits.");

    page.on("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("History")');
    await expect(page.getByText("First draft")).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Restore")');

    await expect(page.locator(".ProseMirror")).toContainText("Original draft content.", {
      timeout: 10_000,
    });
    await expect(page.locator(".ProseMirror")).not.toContainText("Later unwanted edits.");
  });
});
