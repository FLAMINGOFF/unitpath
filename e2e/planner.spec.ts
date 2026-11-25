import { expect, test } from "@playwright/test";

const entryYear = new Date().getFullYear();

test("setup persists a completed unit and updates progress", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("checkbox", { name: /FIT1045 Introduction/ }).check();
  await page.getByRole("button", { name: "Open my planner" }).click();
  await expect(
    page
      .getByRole("region", { name: `${entryYear} · Semester 1` })
      .getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: `${entryYear} · Semester 1` })
      .getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(
    page.getByRole("region", { name: "Credit point summary" }),
  ).toContainText("6/ 144");
});

test("JSON export and import round-trip, while malformed files are rejected", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("checkbox", { name: /FIT1045 Introduction/ }).check();
  await page.getByRole("link", { name: "Data", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  await page.getByRole("button", { name: "Clear local plan" }).click();
  await page.locator("input[type=file]").setInputFiles(await download.path());
  await expect(page.getByRole("status")).toContainText(
    "Plan imported successfully",
  );
  await page.getByRole("link", { name: "Planner", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "FIT1045", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Data", exact: true }).click();
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
  await page.getByRole("link", { name: "Data", exact: true }).click();
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

test("auto schedule fills an empty plan and the result survives a reload", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByLabel("Campus").selectOption("Clayton");
  await page.getByRole("link", { name: "Planner", exact: true }).click();
  await page.getByRole("button", { name: "Auto schedule" }).click();
  const dialog = page.getByRole("dialog", { name: "Auto schedule preview" });
  await expect(dialog).toContainText("Every required unit found a term.");
  await dialog.getByRole("button", { name: "Apply suggestion" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "FIT3048", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Elective slot").first()).toBeVisible();
  const errors = page
    .locator(".ledger-strip div")
    .filter({ hasText: "Errors" });
  await expect(errors.locator("dd")).toHaveText("0");
});

test("a unit placed in a term it is not offered shows an error badge", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByLabel("Campus").selectOption("Clayton");
  await page.getByRole("link", { name: "Planner", exact: true }).click();
  await page
    .getByRole("button", { name: `Add unit to ${entryYear} · Semester 2` })
    .click();
  await page
    .getByRole("button", { name: `Add FIT1057 to ${entryYear} · Semester 2` })
    .click();
  const term = page.getByRole("region", { name: `${entryYear} · Semester 2` });
  await expect(term.getByText("Error", { exact: true })).toBeVisible();
  await expect(term).toContainText("not offered in S2 at Clayton");
});

test("a term above the unit limit shows a warning badge", async ({ page }) => {
  await page.goto("/plan");
  for (const code of ["FIT1045", "FIT1047", "FIT1049", "FIT1057", "FIT1093"])
    await page
      .getByRole("button", { name: `Add ${code} to ${entryYear} · Semester 1` })
      .click();
  const term = page.getByRole("region", { name: `${entryYear} · Semester 1` });
  await expect(term).toContainText("5/4");
  await expect(term).toContainText("Above your 4-unit limit");
});

test("entry year and Handbook version stay independent", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Entry year").selectOption("2029");
  await expect(page.getByLabel("Handbook version")).toHaveValue("2026");
  await expect(
    page.getByText("No 2029 handbook data yet; using 2026."),
  ).toBeVisible();
  await page.getByLabel("Handbook version").selectOption("2026");
  await expect(page.getByLabel("Entry year")).toHaveValue("2029");
});
