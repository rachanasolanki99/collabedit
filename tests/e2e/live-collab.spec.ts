import { test, expect } from "@playwright/test";
import { registerAndLogin, createDocument, typeInEditor, uniqueEmail } from "./helpers";

test.describe("real-time collaboration", () => {
  test("edits propagate live between two connected users", async ({ browser }) => {
    const ownerEmail = uniqueEmail("owner");
    const editorEmail = uniqueEmail("editor");

    const editorCtx = await browser.newContext();
    const editorPage = await editorCtx.newPage();
    await registerAndLogin(editorPage, editorEmail, "Editor");

    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await registerAndLogin(ownerPage, ownerEmail, "Owner");
    const docUrl = await createDocument(ownerPage);
    await expect(ownerPage.getByRole("status")).toContainText(/synced/i, { timeout: 15_000 });

    await ownerPage.click('button:has-text("Share")');
    await ownerPage.fill("#invite-email", editorEmail);
    await ownerPage.selectOption('select[aria-label="Role for invited collaborator"]', "EDITOR");
    await ownerPage.click('button[aria-label="Add collaborator"]');
    await expect(ownerPage.getByText(editorEmail)).toBeVisible({ timeout: 10_000 });
    await ownerPage.keyboard.press("Escape");

    await editorPage.goto(docUrl);
    await expect(editorPage.locator(".ProseMirror")).toBeVisible();
    await expect(editorPage.getByRole("status")).toContainText(/synced/i, { timeout: 15_000 });

    await typeInEditor(ownerPage, "Hello from the owner. ");
    await expect(editorPage.locator(".ProseMirror")).toContainText("Hello from the owner.", {
      timeout: 15_000,
    });

    await typeInEditor(editorPage, "Reply from the editor. ");
    await expect(ownerPage.locator(".ProseMirror")).toContainText("Reply from the editor.", {
      timeout: 15_000,
    });

    await editorCtx.close();
    await ownerCtx.close();
  });
});
