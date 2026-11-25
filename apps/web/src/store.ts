import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { planSchema, type Plan } from "@unitpath/engine";
import { catalog } from "./catalog";

export const initialPlan: Plan = {
  schemaVersion: 1,
  course: { code: "C2000", version: 2026, majorId: "applied-cybersecurity" },
  startPeriod: { year: 2026, term: "S1" },
  entries: [],
  creditBlocks: [],
  maxUnitsPerTerm: 4,
  selectedPathway: "Standard pathway",
};

export function validateImportedPlan(value: unknown): Plan {
  const plan = planSchema.parse(value);
  if (
    !catalog.courses.some(
      (course) =>
        course.code === plan.course.code &&
        course.version === plan.course.version &&
        course.majors.some((major) => major.id === plan.course.majorId),
    )
  ) {
    throw new Error(
      "The selected course version or major is not available in this catalog.",
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
