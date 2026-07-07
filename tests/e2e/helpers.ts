import { Page, expect } from "@playwright/test";

let counter = 0;
export function uniqueEmail(prefix = "user"): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@e2e.dev`;
}

export async function registerAndLogin(page: Page, email: string, name = "E2E User") {
  await page.goto("/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click('button:has-text("Create account")');
  await page.waitForURL("**/documents");
}

export async function createDocument(page: Page): Promise<string> {
  await page.click('button:has-text("New document")');
  await page.waitForURL(/\/documents\/[^/]+$/);
  await expect(page.locator(".ProseMirror")).toBeVisible();
  return page.url();
}

export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type(text);
}
