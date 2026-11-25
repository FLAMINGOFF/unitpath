import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { fixtureCatalog } from "../test/fixtures/catalog";

const created: string[] = [];
afterEach(async () => {
  await Promise.all(
    created.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function seed(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "unitpath-data-"));
  created.push(root);
  await mkdir(join(root, "data/units"), { recursive: true });
  await mkdir(join(root, "data/courses/C2000"), { recursive: true });
  await mkdir(join(root, "apps/web/src"), { recursive: true });
  const catalog = fixtureCatalog();
  for (const unit of Object.values(catalog.units))
    await writeFile(
      join(root, `data/units/${unit.code}.yaml`),
      YAML.stringify(unit),
    );
  await writeFile(
    join(root, "data/courses/C2000/2026.yaml"),
    YAML.stringify(catalog.courses[0]),
  );
  return root;
}

function run(root: string) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", resolve("scripts/build-data.ts"), root],
    { cwd: resolve("."), encoding: "utf8" },
  );
}

describe("catalog builder", () => {
  it("writes a validated catalog", async () => {
    const root = await seed();
    const result = run(root);
    expect(result.status).toBe(0);
    const output = JSON.parse(
      await readFile(join(root, "apps/web/src/catalog.json"), "utf8"),
    );
    expect(output.units.TST1001.code).toBe("TST1001");
  });
  it("points contributors to the invalid YAML field", async () => {
    const root = await seed();
    const file = join(root, "data/units/TST1001.yaml");
    const record = YAML.parse(await readFile(file, "utf8"));
    record.creditPoints = 0;
    await writeFile(file, YAML.stringify(record));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("data/units/TST1001.yaml:creditPoints:");
  });
  it("rejects verified records with unknown fields", async () => {
    const root = await seed();
    const file = join(root, "data/units/TST1001.yaml");
    const record = YAML.parse(await readFile(file, "utf8"));
    record.offerings = "TODO";
    await writeFile(file, YAML.stringify(record));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("data/units/TST1001.yaml:verified:");
  });
  it("rejects a missing unit reference", async () => {
    const root = await seed();
    const file = join(root, "data/units/TST2001.yaml");
    const unit = YAML.parse(await readFile(file, "utf8"));
    unit.requisites.prerequisite = { unit: "TST9999" };
    await writeFile(file, YAML.stringify(unit));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing referenced unit TST9999");
  });
  it("rejects prerequisite and replacement cycles", async () => {
    const root = await seed();
    const file = join(root, "data/units/TST1001.yaml");
    const unit = YAML.parse(await readFile(file, "utf8"));
    unit.requisites.prerequisite = { unit: "TST2001" };
    await writeFile(file, YAML.stringify(unit));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Prerequisite cycle");
    const otherFile = join(root, "data/units/TST3005.yaml");
    const other = YAML.parse(await readFile(otherFile, "utf8"));
    other.replacedBy = "TST3004";
    await writeFile(otherFile, YAML.stringify(other));
    expect(run(root).stderr).toContain("Replacement cycle");
  });
  it("rejects a filename that disagrees with the unit code", async () => {
    const root = await seed();
    const file = join(root, "data/units/TST1001.yaml");
    const unit = YAML.parse(await readFile(file, "utf8"));
    unit.code = "TST9999";
    await writeFile(file, YAML.stringify(unit));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("filename does not match code");
  });
});
