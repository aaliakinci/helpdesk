import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.DEMO_SEED_PASSWORD;

test.skip(!password, "DEMO_SEED_PASSWORD is required for authenticated accessibility tests.");

test("staff routes have no serious accessibility violations or horizontal overflow", async ({
  page,
}) => {
  await login(page, "agent@demo.helpdesk.test");
  await assertRoute(page, "/workspace");
  const skipLink = page.locator('[id$=".skip-link"]');
  await skipLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.locator('[id$=".notifications.toggle"]').click();
  await expect(page.locator('[id$=".notifications.panel"]')).toBeVisible();
  await assertRoute(page, "/workspace/tickets/new");
  await assertRoute(page, "/workspace/queues");
  await assertRoute(page, "/account");
});

test("requester portal stays accessible and responsive", async ({ page }) => {
  await login(page, "requester@demo.helpdesk.test");
  await assertRoute(page, "/portal");
  await assertRoute(page, "/portal/tickets/new");
  await assertRoute(page, "/account");
});

test("auditor workspace is accessible and exposes no mutation controls", async ({ page }) => {
  await login(page, "auditor@demo.helpdesk.test");
  await assertRoute(page, "/audit");
  await expect(page.locator('[id$=".read-only"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  await assertRoute(page, "/account");
});

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password ?? "");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("main")).toBeVisible();
}

async function assertRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
  if (route.endsWith("/tickets/new")) {
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, `${route} must not create horizontal overflow`).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking, `${route} serious/critical accessibility violations`).toEqual([]);
}
