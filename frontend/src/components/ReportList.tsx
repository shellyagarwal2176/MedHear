"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAIN_LEVELS, levelColor, partLabel } from "./BodyMap";
import { InsightList, PRIORITY_RANK, PriorityBadge, type Insight, type Priority } from "./ReportParts";
import Conversation, { unreadFor, type Message } from "./Conversation";
import { beep } from "../lib/alert";
import { speak } from "../lib/speak";
import { getToken } from "../lib/auth";

interface ReportItem {
  part: string | null;
  level: number | null;
  sign: string | null;
  confidence: number | null;
}

interface PatientProfile {
  age: number | null;
  blood_group: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

interface Report {
  id: string;
  patient_name: string;
  items: ReportItem[];
  message: string;
  insights: Insight[];
  priority: Priority;
  priority_reasons: string[];
  sos: boolean;
  profile: PatientProfile | null;
  messages: Message[];
  status: "pending" | "confirmed";
  doctor_notes: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

type Mode = "patient" | "doctor";
type Filter = "all" | "pending" | "confirmed";

const API = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS = 8000;
const toDate = (iso: string) => new Date(iso + "Z").toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const ACCENT: Record<Priority, string> = { emergency: "bg-red-600", urgent: "bg-orange-400", routine: "bg-slate-300" };

// New messages first, then unreviewed, then most urgent, then newest
const byAttention = (mode: Mode) => (a: Report, b: Report) => {
  const unread = Number(unreadFor(b.messages, mode) > 0) - Number(unreadFor(a.messages, mode) > 0);
  if (unread !== 0) return unread;
  if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return p !== 0 ? p : b.created_at.localeCompare(a.created_at);
};

function profileLines(p: PatientProfile | null): [string, string][] {
  if (!p) return [];
  const rows: [string, string][] = [
    ["Age", p.age ? String(p.age) : ""],
    ["Blood group", p.blood_group],
    ["Allergies", p.allergies],
    ["Conditions", p.conditions],
    ["Medicines", p.medications],
    ["Emergency contact", [p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(" · ")],
  ];
  return rows.filter(([, v]) => v);
}

function ReportCard({ report, mode, token, onUpdate, index }: {
  report: Report;
  mode: Mode;
  token: string;
  onUpdate: (r: Report) => void;
  index: number;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [notes, setNotes] = useState(report.doctor_notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  const confirmed = report.status === "confirmed";
  const dirty = notes.trim() !== report.doctor_notes;
  const info = profileLines(report.profile);

  async function review(changes: { doctor_notes?: string; status?: "pending" | "confirmed" }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error();
      const updated: Report = await res.json();
      onUpdate(updated);
      setNotes(updated.doctor_notes);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function print() {
    const el = articleRef.current;
    if (!el) return;
    el.classList.add("mh-print-target");
    window.print();
    el.classList.remove("mh-print-target");
  }

  return (
    <article
      ref={articleRef}
      className="mh-slide-up bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className={`h-1.5 ${confirmed ? "bg-green-500" : ACCENT[report.priority]}`} />
      <div className="p-5">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          {mode === "doctor" && <h2 className="font-semibold text-gray-900 text-lg">{report.patient_name}</h2>}
          <PriorityBadge priority={report.priority} />
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {confirmed ? "Confirmed" : mode === "doctor" ? "Pending review" : "Waiting for review"}
          </span>
          {unreadFor(report.messages, mode) > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
              &#128172; {mode === "doctor" ? "New reply" : "New message"}
            </span>
          )}
          {report.sos && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">SOS alert</span>}
          <time className="text-xs text-gray-500 ml-auto" dateTime={report.created_at}>
            {toDate(report.created_at)}
          </time>
        </header>

        <p className="text-gray-900 text-lg font-medium leading-snug">{report.message || "Patient report"}</p>

        <ul className="flex flex-wrap gap-2 mt-4">
          {report.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-sm">
              {item.level && (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: levelColor(item.level) }} title={PAIN_LEVELS[item.level - 1]?.label} />
              )}
              <span className="font-semibold text-gray-800">{item.part ? partLabel(item.part) : "General"}</span>
              {item.level && <span className="text-gray-500">{PAIN_LEVELS[item.level - 1]?.label}</span>}
              {item.sign && (
                <span className="text-blue-700 font-semibold">
                  · {item.sign}
                  <span className="text-gray-400 font-normal ml-1">
                    {item.confidence === null ? "tapped" : `${Math.round(item.confidence * 100)}%`}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>

        {report.insights.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                AI-assisted summary
                <span className="font-normal text-gray-400"> · possibilities, not a diagnosis</span>
              </p>
              {mode === "doctor" && report.insights.some((i) => i.ask.length > 0) && (
                <button
                  onClick={() => setShowQuestions(!showQuestions)}
                  aria-expanded={showQuestions}
                  className="mh-no-print text-sm font-semibold text-blue-600 hover:text-blue-800 shrink-0 ml-3"
                >
                  {showQuestions ? "Hide suggested questions" : "Suggested questions"}
                </button>
              )}
            </div>
            <InsightList insights={report.insights} theme="light" showQuestions={mode === "doctor" && showQuestions} />
          </div>
        )}

        {mode === "doctor" && report.priority_reasons.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-semibold">Why {report.priority}:</span> {report.priority_reasons.join("; ")}.
          </p>
        )}

        {mode === "doctor" && info.length > 0 && (
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
            {info.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-500 shrink-0">{k}:</dt>
                <dd className="text-gray-900 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mh-no-print flex gap-4 mt-4 text-sm font-semibold">
          <button onClick={() => speak(report.message)} className="text-blue-600 hover:text-blue-800">
            &#128266; Read aloud
          </button>
          <button onClick={print} className="text-blue-600 hover:text-blue-800">
            Print
          </button>
        </div>

        <Conversation reportId={report.id} messages={report.messages} role={mode} onChange={onUpdate} />

        {mode === "doctor" ? (
          <div className="mh-no-print mt-5 border-t border-gray-100 pt-4">
            <label htmlFor={`notes-${report.id}`} className="block text-sm font-semibold text-gray-700 mb-1">
              Doctor notes
            </label>
            <textarea
              id={`notes-${report.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add observations, instructions or follow-up..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                onClick={() => review({ doctor_notes: notes })}
                disabled={busy || !dirty}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition"
              >
                Save notes
              </button>
              {confirmed ? (
                <button
                  onClick={() => review({ status: "pending" })}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => review({ doctor_notes: notes, status: "confirmed" })}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition"
                >
                  Confirm report
                </button>
              )}
              {justSaved && <span className="text-sm text-green-700 font-semibold mh-chip-in">Saved</span>}
              {confirmed && report.confirmed_by && report.confirmed_at && (
                <span className="text-xs text-gray-500 sm:ml-auto">
                  Confirmed by {report.confirmed_by} · {toDate(report.confirmed_at)}
                </span>
              )}
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>
        ) : (
          <>
            {report.doctor_notes && (
              <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-1">Note from your care team</p>
                <p className="text-gray-900 whitespace-pre-wrap">{report.doctor_notes}</p>
              </div>
            )}
            {confirmed && report.confirmed_by && report.confirmed_at && (
              <p className="text-xs text-gray-500 mt-3">
                Confirmed by {report.confirmed_by} · {toDate(report.confirmed_at)}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default function ReportList({ mode }: { mode: Mode }) {
  const loginPath = mode === "doctor" ? "/doctor/login" : "/patient/login";
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(
    (saved: string, quiet: boolean) =>
      fetch(`${API}${mode === "doctor" ? "/reports" : "/reports/mine"}`, { headers: { Authorization: `Bearer ${saved}` } })
        .then((res) => {
          if (res.status === 401 || res.status === 403) {
            window.location.href = loginPath;
            return null;
          }
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => data && setReports(data))
        .catch(() => !quiet && setError("Could not load reports. Please try again.")),
    [mode, loginPath]
  );

  useEffect(() => {
    const saved = getToken(mode);
    if (!saved) {
      window.location.href = loginPath;
      return;
    }
    setToken(saved);
    load(saved, false);
    // Keep the list fresh so new reports (and doctor replies) show up without a reload
    const timer = setInterval(() => load(saved, true), POLL_MS);
    return () => clearInterval(timer);
  }, [mode, loginPath, load]);

  const alertCount =
    reports?.filter(
      (r) => r.status === "pending" && (r.priority !== "routine" || unreadFor(r.messages, "doctor") > 0)
    ).length ?? 0;
  const lastAlertCount = useRef<number | null>(null);
  useEffect(() => {
    if (mode !== "doctor" || !reports) return;
    if (lastAlertCount.current !== null && alertCount > lastAlertCount.current) beep();
    lastAlertCount.current = alertCount;
    document.title = alertCount > 0 ? `(${alertCount}) MedHear` : "MedHear";
  }, [mode, reports, alertCount]);

  if (error) return <p className="text-red-500 text-center">{error}</p>;
  if (!reports) return <p className="text-gray-500 text-center py-10">Loading...</p>;
  if (reports.length === 0) {
    return (
      <div className="text-center py-14 text-gray-500">
        <p className="text-lg font-semibold text-gray-700">No reports yet</p>
        <p className="mt-1">
          {mode === "patient" ? "Reports you send to your care team will appear here." : "New patient reports will appear here."}
        </p>
      </div>
    );
  }

  const pending = reports.filter((r) => r.status === "pending");
  const needAttention = pending.filter((r) => r.priority !== "routine").length;
  const q = query.trim().toLowerCase();
  const visible = reports
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => !q || r.patient_name.toLowerCase().includes(q) || r.message.toLowerCase().includes(q))
    .sort(byAttention(mode));
  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${reports.length})` },
    { id: "pending", label: `Pending (${pending.length})` },
    { id: "confirmed", label: `Confirmed (${reports.length - pending.length})` },
  ];

  return (
    <div>
      {mode === "doctor" && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Needs attention", value: needAttention, cls: needAttention > 0 ? "text-red-600" : "text-gray-900" },
            { label: "Pending review", value: pending.length, cls: "text-amber-600" },
            { label: "Confirmed", value: reports.length - pending.length, cls: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {mode === "doctor" && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient or symptom..."
          className="w-full mb-4 px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      <div className="flex gap-2 mb-5 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              filter === t.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {visible.length === 0 && <p className="text-center text-gray-500 py-8">Nothing here.</p>}
        {visible.map((report, i) => (
          <ReportCard
            key={report.id}
            report={report}
            mode={mode}
            token={token}
            index={i}
            onUpdate={(updated) => setReports((prev) => prev && prev.map((r) => (r.id === updated.id ? updated : r)))}
          />
        ))}
      </div>
    </div>
  );
}
