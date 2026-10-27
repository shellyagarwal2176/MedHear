export type Priority = "emergency" | "urgent" | "routine";

export interface Insight {
  text: string;
  tone: "info" | "watch" | "alert";
  ask: string[];
}

export interface Analysis {
  message: string;
  insights: Insight[];
  priority: Priority;
  priority_reasons: string[];
  disclaimer: string;
}

export const PRIORITY_RANK: Record<Priority, number> = { emergency: 0, urgent: 1, routine: 2 };

const PRIORITY_STYLE: Record<Priority, { label: string; cls: string }> = {
  emergency: { label: "Emergency", cls: "bg-red-600 text-white" },
  urgent: { label: "Urgent", cls: "bg-orange-100 text-orange-800" },
  routine: { label: "Routine", cls: "bg-slate-100 text-slate-600" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, cls } = PRIORITY_STYLE[priority];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

const TONE = {
  light: {
    alert: "border-red-300 bg-red-50 text-red-900",
    watch: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-slate-200 bg-slate-50 text-slate-800",
    ask: "text-gray-600",
  },
  dark: {
    alert: "border-red-500/60 bg-red-950/40 text-red-100",
    watch: "border-amber-500/50 bg-amber-950/30 text-amber-100",
    info: "border-gray-600 bg-gray-900 text-gray-200",
    ask: "text-gray-400",
  },
};

export function InsightList({ insights, theme, showQuestions }: { insights: Insight[]; theme: "light" | "dark"; showQuestions: boolean }) {
  const t = TONE[theme];
  return (
    <ul className="flex flex-col gap-2">
      {insights.map((insight, i) => (
        <li key={i} className={`rounded-xl border px-4 py-3 ${t[insight.tone]}`}>
          <p className="font-medium leading-snug">{insight.text}</p>
          {showQuestions && insight.ask.length > 0 && (
            <div className={`mt-2 text-sm ${t.ask}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Suggested questions to ask the patient</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {insight.ask.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
