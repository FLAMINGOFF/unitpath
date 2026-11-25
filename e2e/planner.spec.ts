import { expect, test } from "@playwright/test";

test("setup persists a completed unit and updates progress", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("checkbox", { name: /FIT1045 Introduction/ }).check();
  await page.getByRole("button", { name: "Open my planner" }).click();
  await expect(
    page
      .getByRole("region", { name: "2026 · Semester 1" })
      .getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "2026 · Semester 1" })
      .getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByText("6 / 144", { exact: true })).toBeVisible();
});

test("JSON export and import round-trip, while malformed files are rejected", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("checkbox", { name: /FIT1045 Introduction/ }).check();
  await page.getByRole("link", { name: "Settings & data" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  await page.getByRole("button", { name: "Clear local plan" }).click();
  await page.locator("input[type=file]").setInputFiles(await download.path());
  await expect(page.getByRole("status")).toContainText(
    "Plan imported successfully",
  );
  await page.getByRole("link", { name: "Term planner" }).click();
  await expect(
    page.getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":2}'),
  });
  await expect(page.getByRole("alert")).toContainText("Import rejected");
});

test("share link restores a plan in a separate browser context", async ({
  page,
  browser,
}) => {
  await page.goto("/setup");
  await page.getByRole("checkbox", { name: /FIT1045 Introduction/ }).check();
  await page.getByRole("link", { name: "Settings & data" }).click();
  await page.getByRole("button", { name: "Generate share link" }).click();
  const url = await page
    .getByRole("textbox", { name: "Share link" })
    .inputValue();
  const fresh = await browser.newContext();
  const imported = await fresh.newPage();
  await imported.goto(url);
  await expect(
    imported.getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await fresh.close();
});

test("unverified Handbook rules block automatic placement", async ({
  page,
}) => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Auto schedule" }).click();
  const dialog = page.getByRole("dialog", { name: "Auto schedule preview" });
  await expect(dialog).toContainText("Teaching periods have not been verified");
  await expect(
    dialog.getByRole("button", { name: "Apply suggestion" }),
  ).toBeDisabled();
});
