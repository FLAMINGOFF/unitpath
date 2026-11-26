import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type TourStep = {
  id: string;
  /** Route to show while this step is open. Omit to stay where the user is. */
  route?: string;
  /** Value of the `data-tour` attribute to highlight. Omit for a centred card. */
  target?: string;
  kicker: string;
  title: string;
  body: ReactNode;
};

const STORAGE_KEY = "unitpath-tour-v1";

type TourRecord = { step: number; completed: boolean };

export function readTourRecord(): TourRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TourRecord>;
    return {
      step: typeof value.step === "number" ? value.step : 0,
      completed: value.completed === true,
    };
  } catch {
    return null;
  }
}

function writeTourRecord(record: TourRecord) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage can be unavailable (private mode, quota). The tour still works.
  }
}

export function buildTourSteps({
  showDataBanner,
}: {
  showDataBanner: boolean;
}): TourStep[] {
  const steps: TourStep[] = [
    {
      id: "welcome",
      kicker: "Welcome",
      title: "Plan your Monash degree in five stops.",
      body: (
        <>
          <p>
            This one-minute tour walks the whole flow: set up your course, lay
            out units term by term, check what’s left, see what unlocks what,
            and keep your plan safe.
          </p>
          <p>
            Skip it if you like. You can reopen it any time from{" "}
            <strong>Guide</strong> in the top bar.
          </p>
        </>
      ),
    },
    {
      id: "data-banner",
      route: "/setup",
      target: "data-banner",
      kicker: "Read this first",
      title: "The data is unofficial and unverified.",
      body: (
        <p>
          Unit rules were copied from the Monash Handbook, but not every record
          has been checked by a person. UnitPath can be wrong. Treat your plan
          as a draft and confirm each unit on its Handbook page, or with a
          course adviser, before you enrol.
        </p>
      ),
    },
    {
      id: "setup-course",
      route: "/setup",
      target: "setup-course",
      kicker: "01 Setup · Course",
      title: "Pick your course and Handbook year.",
      body: (
        <p>
          Choose your course, then the Handbook version you’re bound by (usually
          the year you started). Add your major, minor or specialisation here
          too. Every requirement on later pages comes from these choices.
        </p>
      ),
    },
    {
      id: "setup-start",
      route: "/setup",
      target: "setup-start",
      kicker: "01 Setup · Start",
      title: "Set your first term and campus.",
      body: (
        <p>
          Your first semester anchors the planner’s term columns. Campus matters
          because units are only offered at some campuses and in some semesters.
        </p>
      ),
    },
    {
      id: "setup-passed",
      route: "/setup",
      target: "setup-passed",
      kicker: "01 Setup · History",
      title: "Tick what you’ve already done.",
      body: (
        <p>
          Mark units you’ve passed or are enrolled in, and add any credit
          without a unit code, like advanced standing. Everything saves in this
          browser as you go.
        </p>
      ),
    },
    {
      id: "plan-board",
      route: "/plan",
      target: "plan-board",
      kicker: "02 Planner",
      title: "Your route, one column per semester.",
      body: (
        <p>
          Drag a card to another term to move it. On a keyboard or phone, open
          the card’s <strong>⋯</strong> menu to move it, change its status or
          remove it. Broken rules, like a missing prerequisite or a unit not
          offered that semester, show on the card straight away.
        </p>
      ),
    },
    {
      id: "plan-catalogue",
      route: "/plan",
      target: "plan-catalogue",
      kicker: "02 Planner · Catalogue",
      title: "Add units from the catalogue.",
      body: (
        <p>
          Search by code or title, choose the term in <strong>Add to</strong>,
          and press <strong>+</strong>. The <strong>+</strong> at the bottom of
          a term column picks that term for you.
        </p>
      ),
    },
    {
      id: "plan-autoschedule",
      route: "/plan",
      target: "plan-autoschedule",
      kicker: "02 Planner · Auto schedule",
      title: "Let Auto schedule draft the rest.",
      body: (
        <p>
          It places the remaining required units into future terms, following
          prerequisites, offerings and your term limit. You get a preview first.
          Nothing changes until you press <strong>Apply suggestion</strong>, and{" "}
          <strong>Undo</strong> reverts it.
        </p>
      ),
    },
    {
      id: "progress",
      route: "/progress",
      target: "progress-score",
      kicker: "03 Progress",
      title: "See how far along you are.",
      body: (
        <p>
          Credit points counted against your course target, followed by every
          requirement from the course map. Switch the view to include planned
          units and see where your plan will land.
        </p>
      ),
    },
    {
      id: "graph",
      route: "/graph",
      target: "graph",
      kicker: "04 Graph",
      title: "Find out what unlocks what.",
      body: (
        <p>
          Units are laid out by year level. Select one to light up what it needs
          and what it opens. A unit with no links may simply have unverified
          prerequisites, so check its Handbook page.
        </p>
      ),
    },
    {
      id: "data",
      route: "/settings",
      target: "data-rows",
      kicker: "05 Data",
      title: "Back up, move or share your plan.",
      body: (
        <p>
          There’s no account: your plan lives only in this browser. Export a
          JSON backup, import it on another device, or copy a share link. You
          can also set how many units you take per term.
        </p>
      ),
    },
    {
      id: "done",
      target: "guide",
      kicker: "That’s the tour",
      title: "Reopen it any time from Guide.",
      body: (
        <p>
          Start with Setup, then head to the Planner. And remember: check the
          official Handbook before you enrol.
        </p>
      ),
    },
  ];
  return showDataBanner
    ? steps
    : steps.filter((step) => step.id !== "data-banner");
}

type Rect = { top: number; left: number; width: number; height: number };

const GAP = 14;
const EDGE = 16;
const MOBILE = 720;

function findTarget(name: string) {
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function placeCard(rect: Rect | null, card: { w: number; h: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || vw <= MOBILE) return null;
  const clampLeft = (value: number) =>
    Math.min(Math.max(value, EDGE), vw - card.w - EDGE);
  const clampTop = (value: number) =>
    Math.min(Math.max(value, EDGE), vh - card.h - EDGE);
  const bottom = rect.top + rect.height;
  const right = rect.left + rect.width;
  if (bottom + GAP + card.h <= vh - EDGE)
    return { top: bottom + GAP, left: clampLeft(rect.left) };
  if (rect.top - GAP - card.h >= EDGE)
    return { top: rect.top - GAP - card.h, left: clampLeft(rect.left) };
  if (right + GAP + card.w <= vw - EDGE)
    return { top: clampTop(rect.top), left: right + GAP };
  if (rect.left - GAP - card.w >= EDGE)
    return { top: clampTop(rect.top), left: rect.left - GAP - card.w };
  return { top: vh - card.h - EDGE * 2, left: vw - card.w - EDGE * 2 };
}

export function Tour({
  steps,
  initialStep,
  onClose,
}: {
  steps: TourStep[];
  initialStep: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialStep, 0), steps.length - 1),
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ w: 380, h: 240 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const startRoute = useRef(location.pathname);
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const titleId = `tour-title-${step.id}`;
  const bodyId = `tour-body-${step.id}`;

  const finish = useCallback(
    (completed: boolean) => {
      writeTourRecord({ step: completed ? 0 : index, completed });
      if (completed && location.pathname !== startRoute.current)
        navigate(startRoute.current);
      onClose();
    },
    [index, location.pathname, navigate, onClose],
  );

  useEffect(() => {
    writeTourRecord({ step: index, completed: false });
  }, [index]);

  // Show the step's page, then find, scroll to and track the highlighted element.
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }
    if (!step.target) {
      setRect(null);
      return;
    }
    const name = step.target;
    let frame = 0;
    let tries = 0;
    let element: HTMLElement | null = null;
    const measure = () => {
      if (!element) return;
      const box = element.getBoundingClientRect();
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      });
    };
    const locate = () => {
      element = findTarget(name);
      if (!element) {
        tries += 1;
        if (tries < 90) frame = window.requestAnimationFrame(locate);
        else setRect(null);
        return;
      }
      const box = element.getBoundingClientRect();
      element.scrollIntoView({
        block:
          window.innerWidth <= MOBILE || box.height > window.innerHeight * 0.55
            ? "start"
            : "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      measure();
    };
    setRect(null);
    locate();
    const onChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [step, location.pathname, navigate]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const update = () =>
      setCardSize({ w: card.offsetWidth, h: card.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [index]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
      return;
    }
    if (event.key === "ArrowRight" && !last) {
      event.preventDefault();
      setIndex((value) => value + 1);
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setIndex((value) => value - 1);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled)",
    );
    if (!focusable?.length) return;
    const first = focusable[0]!;
    const final = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      final.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first.focus();
    }
  };

  const position = placeCard(rect, cardSize);
  const pad = 6;

  return createPortal(
    <div className="tour" onKeyDown={onKeyDown}>
      <div
        className={`tour-scrim${rect ? " has-spot" : ""}`}
        aria-hidden="true"
      />
      {rect && (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}
      <div
        ref={cardRef}
        className={`tour-card${position ? " anchored" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        style={position ?? undefined}
      >
        <div className="tour-top">
          <p className="tour-kicker">
            <span>
              {String(index + 1).padStart(2, "0")}/
              {String(steps.length).padStart(2, "0")}
            </span>
            {step.kicker}
          </p>
          <button
            type="button"
            className="icon-button"
            onClick={() => finish(false)}
            aria-label="Close guide"
          >
            <X size={16} />
          </button>
        </div>
        <h2 id={titleId}>{step.title}</h2>
        <div id={bodyId} className="tour-body">
          {step.body}
        </div>
        <div
          className="tour-progress"
          role="progressbar"
          aria-label="Guide progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Step ${index + 1} of ${steps.length}`}
        >
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          {index === 0 ? (
            <button
              type="button"
              className="button ghost"
              onClick={() => finish(false)}
            >
              Skip tour
            </button>
          ) : (
            <button
              type="button"
              className="button ghost"
              onClick={() => setIndex((value) => value - 1)}
            >
              <ArrowLeft size={15} /> Back
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className="button primary"
            onClick={() =>
              last ? finish(true) : setIndex((value) => value + 1)
            }
          >
            {index === 0 ? "Start tour" : last ? "Finish" : "Next"}
            {!last && <ArrowRight size={15} />}
          </button>
        </div>
        <span className="tour-live" aria-live="polite">
          Step {index + 1} of {steps.length}: {step.title}
        </span>
      </div>
    </div>,
    document.body,
  );
}
