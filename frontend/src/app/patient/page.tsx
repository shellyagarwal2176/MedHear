"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PriorityBadge, type Priority } from "../../components/ReportParts";
import { api } from "../../lib/api";
import Conversation, { unreadFor, type Message } from "../../components/Conversation";
import { PATIENT_REPLIES } from "../../lib/quickReplies";
import { getToken } from "../../lib/auth";
import AppShell, { PageHeader } from "../../components/AppShell";
import { AlertIcon, ArrowIcon, BodyIcon, MessageIcon, ProfileIcon } from "../../components/Icons";

const POLL_MS = 8000;

interface ReportSummary {
  id: string;
  message: string;
  status: "pending" | "confirmed";
  priority: Priority;
  doctor_notes: string;
  messages: Message[];
  created_at: string;
}

interface Profile {
  age: number | null;
  allergies: string;
  conditions: string;
  emergency_contact_phone: string;
}

type SosState = "idle" | "confirm" | "sending" | "sent" | "error";

export default function PatientDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [replying, setReplying] = useState(false);
  const lastAlerted = useRef<string | null>(null);
  const [profileDone, setProfileDone] = useState(true);
  const [sos, setSos] = useState<SosState>("idle");

  const load = useCallback(
    () => api<ReportSummary[]>("/reports/mine").then(setReports).catch(() => {}),
    []
  );

  useEffect(() => {
    if (!getToken("patient")) {
      router.push("/patient/login");
      return;
    }
    setChecking(false);

    load();
    // Poll so a reply from the care team shows up without refreshing
    const timer = setInterval(load, POLL_MS);
    api<Profile>("/profile")
      .then((p) => setProfileDone(Boolean(p.age || p.allergies || p.conditions || p.emergency_contact_phone)))
      .catch(() => {});
    return () => clearInterval(timer);
  }, [router, load]);

  async function sendSos() {
    setSos("sending");
    try {
      await api("/reports/sos", { method: "POST" });
      setSos("sent");
      load();
    } catch {
      setSos("error");
    }
  }

  // Newest report with an unread message from the care team
  const unreadReport = reports.find((r) => unreadFor(r.messages, "patient") > 0);
  const unreadMessage = unreadReport?.messages.filter((m) => m.from === "doctor" && !m.seen).at(-1);

  useEffect(() => {
    if (!unreadMessage || lastAlerted.current === unreadMessage.id) return;
    lastAlerted.current = unreadMessage.id;
    navigator.vibrate?.([300, 150, 300, 150, 300]); // a deaf patient may not be looking at the screen
  }, [unreadMessage]);

  async function answer(reportId: string, text: string | null) {
    setReplying(true);
    try {
      const updated = await api<ReportSummary>(
        text ? `/reports/${reportId}/messages` : `/reports/${reportId}/messages/seen`,
        { method: "POST", body: text ? { text } : undefined }
      );
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      // the next poll will retry
    } finally {
      setReplying(false);
    }
  }

  const recent = reports.slice(0, 3);
  const totalUnread = reports.reduce((n, r) => n + unreadFor(r.messages, "patient"), 0);

  if (checking) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  const waiting = reports.filter((r) => r.status === "pending").length;
  const stats = [
    { label: "Reports sent", value: reports.length },
    { label: "Waiting for review", value: waiting },
    { label: "New messages", value: totalUnread },
  ];

  return (
    <AppShell role="patient">
      <PageHeader title="Hello, how can we help?" subtitle="Tell your care team what is wrong. Tap the body part, sign it, and send." />

      {unreadReport && unreadMessage && (
        <section className="mh-chip-in mb-6 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-800 mb-1">
            <MessageIcon className="w-4 h-4" /> Message from your care team
            {unreadFor(unreadReport.messages, "patient") > 1 && ` (${unreadFor(unreadReport.messages, "patient")} new)`}
          </p>
          <p className="font-display text-2xl font-semibold text-ink leading-snug">{unreadMessage.text}</p>
          <p className="text-sm text-gray-500 mt-1">About: {unreadReport.message}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {PATIENT_REPLIES.map((reply) => (
              <button
                key={reply}
                disabled={replying}
                onClick={() => answer(unreadReport.id, reply)}
                className="px-4 py-2.5 rounded-full bg-white border border-blue-300 text-blue-900 font-semibold hover:bg-brand hover:text-white active:scale-95 disabled:opacity-50 transition"
              >
                {reply}
              </button>
            ))}
          </div>
          <button disabled={replying} onClick={() => answer(unreadReport.id, null)} className="mt-3 text-sm font-semibold text-blue-800 underline">
            Got it, no reply needed
          </button>
        </section>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {stats.map((st) => (
          <div key={st.label} className="rounded-2xl bg-white border border-gray-200 px-5 py-4">
            <p className="font-display text-3xl font-semibold text-ink">{st.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{st.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-8">
        <a href="/patient/body" className="lg:col-span-3 mh-hero rounded-2xl p-7 text-white shadow-lg shadow-brand/20 hover:brightness-110 transition flex flex-col justify-between min-h-44">
          <div>
            <BodyIcon className="w-7 h-7 mb-3 text-white/80" />
            <h2 className="font-display text-2xl font-semibold">Describe a problem</h2>
            <p className="text-white/80 mt-1">Tap the body part, then sign what is wrong.</p>
          </div>
          <span className="inline-flex items-center gap-2 mt-5 font-semibold">
            Start <ArrowIcon className="w-4 h-4" />
          </span>
        </a>

        <section className="lg:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-5 flex flex-col justify-center">
          {sos === "idle" && (
            <>
              <p className="flex items-center gap-2 font-semibold text-red-900 mb-1">
                <AlertIcon className="w-5 h-5" /> Emergency
              </p>
              <p className="text-sm text-red-800/80 mb-4">Alert your care team right now.</p>
              <button onClick={() => setSos("confirm")} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 active:scale-[0.99] transition">
                I need help now
              </button>
            </>
          )}
          {sos === "confirm" && (
            <div className="mh-chip-in text-center">
              <p className="text-red-900 font-semibold mb-3">Send an emergency alert to your care team?</p>
              <div className="flex gap-3">
                <button onClick={sendSos} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition">
                  Yes, send alert
                </button>
                <button onClick={() => setSos("idle")} className="flex-1 py-3 rounded-xl bg-white border border-red-300 text-red-800 font-semibold hover:bg-red-100 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {sos === "sending" && <p className="text-center text-red-900 font-semibold py-3">Sending alert...</p>}
          {sos === "sent" && (
            <div className="text-center mh-chip-in">
              <p className="text-green-800 font-bold">Alert sent. Your care team has been notified.</p>
              <button onClick={() => setSos("idle")} className="mt-2 text-sm font-semibold text-red-800 underline">
                Done
              </button>
            </div>
          )}
          {sos === "error" && (
            <div className="text-center">
              <p className="text-red-900 font-semibold">Could not send the alert. Please try again or ask someone nearby for help.</p>
              <button onClick={() => setSos("idle")} className="mt-2 text-sm font-semibold text-red-800 underline">
                Try again
              </button>
            </div>
          )}
        </section>
      </div>

      {!profileDone && (
        <a href="/patient/profile" className="flex items-center gap-4 mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 hover:border-amber-300 transition">
          <ProfileIcon className="w-6 h-6 text-amber-700 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold text-amber-900">Add your medical info</span>
            <span className="block text-sm text-amber-800/80">Allergies, conditions and an emergency contact, so your care team does not have to ask.</span>
          </span>
          <ArrowIcon className="w-5 h-5 text-amber-700" />
        </a>
      )}

      {recent.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl font-semibold text-ink">Recent reports</h2>
            {reports.length > recent.length && (
              <a href="/patient/reports" className="text-sm font-semibold text-brand">
                See all ({reports.length})
              </a>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {recent.map((r) => {
              const last = r.messages.at(-1);
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge priority={r.priority} />
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status === "confirmed" ? "Confirmed" : "Waiting for review"}
                    </span>
                    <time className="ml-auto text-xs text-gray-500">{new Date(r.created_at + "Z").toLocaleDateString()}</time>
                  </div>
                  <p className="text-ink">{r.message}</p>
                  {r.doctor_notes && <p className="text-sm text-blue-700 mt-1.5">Care team note: {r.doctor_notes}</p>}
                  {last && (
                    <p className="text-sm text-gray-500 mt-1.5 truncate">
                      Last message {last.from === "doctor" ? "from care team" : "from you"}: {last.text}
                    </p>
                  )}
                  <Conversation
                    reportId={r.id}
                    messages={r.messages}
                    role="patient"
                    defaultOpen={false}
                    onChange={(updated: ReportSummary) => setReports((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}
