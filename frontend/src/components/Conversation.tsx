"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { DOCTOR_REPLIES, PATIENT_REPLIES } from "../lib/quickReplies";

export interface Message {
  id: string;
  from: "doctor" | "patient";
  name: string;
  text: string;
  at: string;
  seen: boolean;
}

export const unreadFor = (messages: Message[], role: "doctor" | "patient") =>
  messages.filter((m) => m.from !== role && !m.seen).length;

interface Props<R> {
  reportId: string;
  messages: Message[];
  role: "doctor" | "patient";
  onChange: (report: R) => void;
  // Start expanded? Defaults to yes for a patient with a new message. Pages that already show a banner pass false.
  defaultOpen?: boolean;
}

const time = (iso: string) => new Date(iso + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Conversation<R>({ reportId, messages, role, onChange, defaultOpen }: Props<R>) {
  const unread = unreadFor(messages, role);
  // A patient with a new message from the care team should see it straight away
  const [open, setOpen] = useState(defaultOpen ?? (role === "patient" && unread > 0));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const markedRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Reading the conversation marks the other side's messages as seen
  useEffect(() => {
    if (!open || unread === 0 || markedRef.current === messages.length) return;
    markedRef.current = messages.length;
    api<R>(`/reports/${reportId}/messages/seen`, { method: "POST" }).then(onChange).catch(() => {});
  }, [open, unread, messages.length, reportId, onChange]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, messages.length]);

  async function send(body: string) {
    const clean = body.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError("");
    try {
      onChange(await api<R>(`/reports/${reportId}/messages`, { method: "POST", body: { text: clean } }));
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  const replies = role === "doctor" ? DOCTOR_REPLIES : PATIENT_REPLIES;
  const big = role === "patient";

  return (
    <div className="mh-no-print mt-4">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
      >
        &#128172; {role === "doctor" ? "Conversation" : "Messages"}
        {messages.length > 0 && <span className="text-gray-400 font-normal">({messages.length})</span>}
        {unread > 0 && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs">{unread} new</span>}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 mh-slide-up">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500 py-2 text-center">
              {role === "doctor" ? "No messages yet. Send a quick reply to the patient." : "No messages yet."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-3">
              {messages.map((m) => {
                const mine = m.from === role;
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${big ? "text-lg" : ""} ${
                        mine ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                      }`}
                    >
                      {!mine && <p className="text-xs font-semibold text-blue-700 mb-0.5">{m.from === "doctor" ? `Dr. ${m.name.replace(/^Dr\.?\s*/i, "")}` : m.name}</p>}
                      <p className="leading-snug">{m.text}</p>
                      <p className={`text-[11px] mt-0.5 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                        {time(m.at)}
                        {mine && (m.seen ? " \u00B7 seen" : "")}
                      </p>
                    </div>
                  </li>
                );
              })}
              <div ref={endRef} />
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {replies.map((r) => (
              <button
                key={r}
                onClick={() => send(r)}
                disabled={busy}
                className={`rounded-full border border-blue-200 bg-white text-blue-800 font-semibold hover:bg-blue-600 hover:text-white active:scale-95 disabled:opacity-50 transition ${
                  big ? "px-5 py-3 text-base" : "px-3 py-1.5 text-sm"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {role === "doctor" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
              className="flex gap-2 mt-3"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder="Or type a short message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition"
              >
                Send
              </button>
            </form>
          )}
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
