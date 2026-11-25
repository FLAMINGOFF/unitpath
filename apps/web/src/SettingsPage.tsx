import { useRef, useState } from "react";
import { compressToEncodedURIComponent } from "lz-string";
import {
  Copy,
  Download,
  FileJson,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { parsePlanJson } from "@unitpath/engine";
import { catalog } from "./catalog";
import { disclaimer } from "./App";
import { usePlanStore, validateImportedPlan } from "./store";

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
      const imported = validateImportedPlan(parsePlanJson(await file.text()));
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
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES & DATA</span>
          <h1>Your plan stays yours.</h1>
          <p>
            Everything is stored in this browser. Export a backup or share a
            copy when you choose.
          </p>
        </div>
        <div className="heading-illustration">
          <Settings2 size={42} strokeWidth={1.4} />
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="settings-icon">
            <Settings2 size={20} />
          </div>
          <h2>Planning preferences</h2>
          <p>
            Set a suggested limit for each semester. Overloads show a warning.
          </p>
          <label className="settings-select">
            Maximum units per term
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
        <section className="panel settings-panel">
          <div className="settings-icon">
            <FileJson size={20} />
          </div>
          <h2>Import & export</h2>
          <p>
            Save a portable JSON copy. Imports are checked before replacing your
            current plan.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="button secondary"
              onClick={exportPlan}
            >
              <Download size={16} /> Export JSON
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} /> Import JSON
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
        </section>
        <section className="panel settings-panel">
          <div className="settings-icon">
            <Copy size={20} />
          </div>
          <h2>Share a plan</h2>
          <p>
            Put a compressed copy in a link. Anyone with the link can see its
            contents.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={makeShare}
          >
            Generate share link
          </button>
          {shareUrl && (
            <div className="share-box">
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
                <Copy size={17} />
              </button>
            </div>
          )}
        </section>
        <section className="panel settings-panel">
          <div className="settings-icon">
            <RotateCcw size={20} />
          </div>
          <h2>Start over</h2>
          <p>
            Clear the plan saved in this browser. Export a backup first if you
            need one.
          </p>
          <button
            type="button"
            className="button danger"
            onClick={() => {
              clear();
              setShareUrl("");
              notify("Local plan cleared.");
            }}
          >
            Clear local plan
          </button>
        </section>
      </div>
      <section className="panel about-panel">
        <div className="about-header">
          <div className="settings-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="section-kicker">ABOUT UNITPATH</span>
            <h2>Private by design. Independent by nature.</h2>
          </div>
        </div>
        <p>{disclaimer}</p>
        <div className="about-details">
          <div>
            <strong>Catalog</strong>
            <span>
              C2000 / 2026 · {Object.keys(catalog.units).length} unit records
            </span>
          </div>
          <div>
            <strong>Data status</strong>
            <span>Unit requisites and offerings are not verified</span>
          </div>
          <div>
            <strong>Storage</strong>
            <span>Local browser storage; no account or server</span>
          </div>
          <div>
            <strong>Official source</strong>
            <a
              href={catalog.courses[0]?.source}
              target="_blank"
              rel="noreferrer"
            >
              2026 course map
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
