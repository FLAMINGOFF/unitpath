import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { migratePlan, type Plan } from "@unitpath/engine";
import { catalog } from "./catalog";

const defaultCourse = [...catalog.courses].sort((a, b) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : b.version - a.version,
)[0]!;
const defaultMajor = defaultCourse.majors[0];
const defaultPathways = Object.fromEntries(
  [...defaultCourse.rules, ...(defaultMajor?.rules ?? [])].flatMap((rule) =>
    "oneOf" in rule && rule.oneOf[0] ? [[rule.id, rule.oneOf[0].label]] : [],
  ),
);

export const initialPlan: Plan = {
  schemaVersion: 2,
  course: {
    code: defaultCourse.code,
    version: defaultCourse.version,
    majorIds: defaultMajor ? [defaultMajor.id] : [],
    minorIds: [],
    specialisationIds: [],
  },
  campus: null,
  startPeriod: { year: defaultCourse.version, term: "S1" },
  entries: [],
  creditBlocks: [],
  maxUnitsPerTerm: 4,
  selectedPathways: defaultPathways,
};

export function validateImportedPlan(value: unknown): Plan {
  const plan = migratePlan(value);
  const course = catalog.courses.find(
    (item) =>
      item.code === plan.course.code && item.version === plan.course.version,
  );
  if (!course)
    throw new Error(
      "The selected course version is not available in this catalog.",
    );
  const selections = [
    [plan.course.majorIds, course.majors],
    [plan.course.minorIds ?? [], course.minors],
    [plan.course.specialisationIds ?? [], course.specialisations],
  ] as const;
  for (const [ids, options] of selections) {
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !options.some((item) => item.id === id))
    )
      throw new Error(
        "A selected course component is not available in this catalog.",
      );
  }
  const unknown = plan.entries.find((entry) => !catalog.units[entry.unit]);
  if (unknown)
    throw new Error(`${unknown.unit} is not available in this catalog.`);
  return plan;
}

type Store = {
  plan: Plan;
  previousPlan: Plan | null;
  setPlan: (plan: Plan) => void;
  updatePlan: (change: (plan: Plan) => Plan) => void;
  undo: () => void;
  clear: () => void;
};

export const usePlanStore = create<Store>()(
  persist(
    (set) => ({
      plan: initialPlan,
      previousPlan: null,
      setPlan: (plan) =>
        set((state) => ({
          plan: validateImportedPlan(plan),
          previousPlan: state.plan,
        })),
      updatePlan: (change) =>
        set((state) => ({
          plan: validateImportedPlan(change(state.plan)),
          previousPlan: state.plan,
        })),
      undo: () =>
        set((state) =>
          state.previousPlan
            ? { plan: state.previousPlan, previousPlan: null }
            : state,
        ),
      clear: () =>
        set((state) => ({ plan: initialPlan, previousPlan: state.plan })),
    }),
    {
      name: "unitpath-plan-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ plan: state.plan }),
      merge: (persisted, current) => {
        const candidate = (persisted as { plan?: unknown } | null)?.plan;
        try {
          return { ...current, plan: validateImportedPlan(candidate) };
        } catch {
          return current;
        }
      },
    },
  ),
);
