import { test, expect } from "@playwright/test";
import { registerAndLogin, createDocument, typeInEditor, uniqueEmail } from "./helpers";

test.describe("roles & authorization", () => {
  test("a viewer gets a read-only editor and the write UI is hidden", async ({ browser }) => {
    const ownerEmail = uniqueEmail("owner");
    const viewerEmail = uniqueEmail("viewer");

    const viewerCtx = await browser.newContext();
    const viewerPage = await viewerCtx.newPage();
    await registerAndLogin(viewerPage, viewerEmail, "Viewer");

    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await registerAndLogin(ownerPage, ownerEmail, "Owner");
    const docUrl = await createDocument(ownerPage);
    await typeInEditor(ownerPage, "Owner content. ");

    await ownerPage.click('button:has-text("Share")');
    await ownerPage.fill("#invite-email", viewerEmail);
    await ownerPage.selectOption('select[aria-label="Role for invited collaborator"]', "VIEWER");
    await ownerPage.click('button[aria-label="Add collaborator"]');
    await expect(ownerPage.getByText(viewerEmail)).toBeVisible({ timeout: 10_000 });

    await viewerPage.goto(docUrl);
    await expect(viewerPage.getByText(/view-only access/i)).toBeVisible({ timeout: 15_000 });

    await expect(viewerPage.getByRole("toolbar", { name: /formatting/i })).toHaveCount(0);

    const editable = await viewerPage.locator(".ProseMirror").getAttribute("contenteditable");
    expect(editable).toBe("false");

    await viewerCtx.close();
    await ownerCtx.close();
  });
});
