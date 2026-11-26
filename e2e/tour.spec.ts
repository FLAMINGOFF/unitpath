import { expect, test } from "@playwright/test";

test("first visit opens the guide, which walks every page and can be reopened", async ({
  page,
}) => {
  await page.goto("/setup");
  const guide = page.getByRole("dialog");
  await expect(guide).toContainText("Plan your Monash degree in five stops.");
  await guide.getByRole("button", { name: "Start tour" }).click();
  await expect(guide).toContainText("The data is unofficial and unverified.");

  const stops: [RegExp, string][] = [
    [/\/setup$/, "Pick your course and Handbook year."],
    [/\/setup$/, "Set your first term and campus."],
    [/\/setup$/, "Tick what you’ve already done."],
    [/\/plan$/, "Your route, one column per semester."],
    [/\/plan$/, "Add units from the catalogue."],
    [/\/plan$/, "Let Auto schedule draft the rest."],
    [/\/progress$/, "See how far along you are."],
    [/\/graph$/, "Find out what unlocks what."],
    [/\/settings$/, "Back up, move or share your plan."],
  ];
  for (const [url, title] of stops) {
    await page.keyboard.press("ArrowRight");
    await expect(guide.getByRole("heading")).toHaveText(title);
    await expect(page).toHaveURL(url);
  }
  await guide.getByRole("button", { name: "Next" }).click();
  await expect(guide).toContainText("Reopen it any time from Guide.");
  await guide.getByRole("button", { name: "Finish" }).click();
  await expect(guide).toBeHidden();
  await expect(page).toHaveURL(/\/setup$/);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Guide" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Plan your Monash degree in five stops.",
  );
});

test("Escape skips the guide, keeps focus usable and remembers the step", async ({
  page,
}) => {
  await page.goto("/setup");
  const guide = page.getByRole("dialog");
  await guide.getByRole("button", { name: "Start tour" }).click();
  await guide.getByRole("button", { name: "Next" }).click();
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await expect(page.getByRole("button", { name: "Guide" })).toBeFocused();

  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Guide" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Pick your course and Handbook year.",
  );
});
