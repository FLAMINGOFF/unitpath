import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type { Period, Plan } from "@unitpath/engine";

export const disclaimer =
  "UnitPath is an unofficial, student-built planning aid and is not affiliated with or endorsed by Monash University. Course rules and unit data may be incomplete or out of date. Always confirm your enrolment against the official Monash Handbook and with your faculty's course advisers.";

export type EntryStatus = Plan["entries"][number]["status"];

export const termLabel = (period: Period) =>
  `${period.year} · Semester ${period.term === "S1" ? "1" : "2"}`;

export const shortTerm = (period: Period) => `${period.year} ${period.term}`;

export const compareCodes = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0;

export const statusLabel: Record<EntryStatus, string> = {
  completed: "Completed",
  enrolled: "Enrolled",
  planned: "Planned",
};

export function StatusMark({ status }: { status: EntryStatus }) {
  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "enrolled"
        ? CircleDot
        : CircleDashed;
  return (
    <span className={`status-mark ${status}`}>
      <Icon size={13} aria-hidden="true" />
      {statusLabel[status]}
    </span>
  );
}

export type Tone = "error" | "warning" | "unknown" | "ok";

export function Flag({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon =
    tone === "error"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : tone === "unknown"
          ? HelpCircle
          : CheckCircle2;
  return (
    <span className={`flag ${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageHead({
  index,
  kicker,
  title,
  lede,
  actions,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="kicker">
          <span>{index}</span>
          {kicker}
        </p>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Note({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`note ${tone}`}>
      <span className="note-icon" aria-hidden="true">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}
