import { useRef, useState } from "react";
import { compressToEncodedURIComponent } from "lz-string";
import { Copy, Download, Link2, RotateCcw, Upload } from "lucide-react";
import { courseDataMetrics, parsePlanJson } from "@unitpath/engine";
import { catalog } from "./catalog";
import { usePlanStore, validateImportedPlan } from "./store";
import { disclaimer, PageHead } from "./ui";

export function SettingsPage({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const plan = usePlanStore((state) => state.plan);
  const setPlan = usePlanStore((state) => state.setPlan);
  const updatePlan = usePlanStore((state) => state.updatePlan);
  const clear = usePlanStore((state) => state.clear);
  const fileInput = useRef<HTMLInputElement>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  const unverified = Object.values(catalog.units).filter(
    (unit) => !unit.verified,
  ).length;

  const exportPlan = () => {
    const blob = new Blob([`${JSON.stringify(plan, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "unitpath-plan.json";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Plan exported as JSON.");
  };
  const importPlan = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Plan file exceeds the 1 MB limit.");
      const imported = validateImportedPlan(
        parsePlanJson(await file.text(), catalog),
      );
      setPlan(imported);
      setError("");
      notify("Plan imported successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid plan file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const makeShare = () => {
    const base = new URL(
      `${import.meta.env.BASE_URL}plan`,
      window.location.origin,
    );
    base.hash = `share=${compressToEncodedURIComponent(JSON.stringify(plan))}`;
    setShareUrl(base.toString());
  };

  return (
    <div className="page data">
      <PageHead
        index="05"
        kicker="Data"
        title={
          <>
            Your plan stays <em>on this device.</em>
          </>
        }
        lede="No account and no server. Back it up, move it, or share a copy whenever you like."
      />

      <div className="data-rows">
        <section className="data-row">
          <div className="data-row-label">
            <h2>Term load</h2>
            <p>Terms above this limit get a warning. Auto schedule uses it.</p>
          </div>
          <label className="field">
            <span>Maximum units per term</span>
            <select
              value={plan.maxUnitsPerTerm}
              onChange={(event) =>
                updatePlan((current) => ({
                  ...current,
                  maxUnitsPerTerm: Number(event.target.value),
                }))
              }
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                <option key={count} value={count}>
                  {count} unit{count === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="data-row">
          <div className="data-row-label">
            <h2>Backup</h2>
            <p>
              A portable JSON copy. Imports are checked in full and rejected
              outright if anything is wrong.
            </p>
          </div>
          <div>
            <div className="button-row">
              <button
                type="button"
                className="button ghost"
                onClick={exportPlan}
              >
                <Download size={15} /> Export JSON
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} /> Import JSON
              </button>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                aria-label="Import plan JSON file"
                accept=".json,application/json"
                onChange={(event) => void importPlan(event.target.files?.[0])}
              />
            </div>
            {error && (
              <p role="alert" className="form-error">
                Import rejected: {error}
              </p>
            )}
          </div>
        </section>

        <section className="data-row">
          <div className="data-row-label">
            <h2>Share</h2>
            <p>
              Packs the whole plan into a link. Anyone with the link can read
              it.
            </p>
          </div>
          <div>
            <button type="button" className="button ghost" onClick={makeShare}>
              <Link2 size={15} /> Generate share link
            </button>
            {shareUrl && (
              <div className="share">
                <input
                  aria-label="Share link"
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(shareUrl)
                      .then(() => notify("Share link copied."))
                      .catch(() => notify("Select and copy the link manually."))
                  }
                  aria-label="Copy share link"
                >
                  <Copy size={15} />
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="data-row">
          <div className="data-row-label">
            <h2>Start over</h2>
            <p>
              Clears the plan saved in this browser. Export first if unsure.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="button danger-ghost"
              onClick={() => {
                clear();
                setShareUrl("");
                notify("Local plan cleared.");
              }}
            >
              <RotateCcw size={15} /> Clear local plan
            </button>
          </div>
        </section>
      </div>

      <section className="about" aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">Catalogue coverage by course version</h2>
        <p>
          Rates cover units referenced by published rules and suggested
          sequences. They do not claim to cover every elective in the Handbook.
        </p>
        <dl className="facts">
          {catalog.courses.map((item) => {
            const metrics = courseDataMetrics(item, catalog);
            const display = (value: number | null) =>
              value === null ? "—" : value + "%";
            return (
              <div key={item.code + "/" + item.version}>
                <dt>
                  {item.code} · {item.version} · {item.title}
                </dt>
                <dd>
                  Coverage {display(metrics.coveragePercent)} (
                  {metrics.coveredUnits}/{metrics.referencedUnits}) · Verified{" "}
                  {display(metrics.verificationPercent)} (
                  {metrics.verifiedUnits}/{metrics.referencedUnits})
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="about" aria-labelledby="about-heading">
        <h2 id="about-heading">About UnitPath</h2>
        <p className="about-disclaimer">{disclaimer}</p>
        <dl className="facts">
          <div>
            <dt>Catalogue</dt>
            <dd>
              {plan.course.code} / {plan.course.version} ·{" "}
              {Object.keys(catalog.units).length} unit records
            </dd>
          </div>
          <div>
            <dt>Catalog-wide data status</dt>
            <dd>
              {unverified
                ? `${unverified} records awaiting Handbook check`
                : "All records verified"}
            </dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>This browser only</dd>
          </div>
          {course && (
            <div>
              <dt>Official source</dt>
              <dd>
                <a href={course.source} target="_blank" rel="noreferrer">
                  {course.version} course map
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
