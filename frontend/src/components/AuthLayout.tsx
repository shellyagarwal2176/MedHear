import type { ReactNode } from "react";
import { CheckIcon, Logo } from "./Icons";

export const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-base placeholder:text-gray-400";

const PANEL: Record<"patient" | "doctor", { heading: string; points: string[] }> = {
  patient: {
    heading: "Say what is wrong, in your own language.",
    points: ["Tap where it hurts on a simple body map", "Sign it to the camera, no typing needed", "Your care team replies right in the app"],
  },
  doctor: {
    heading: "Understand every patient, clearly and quickly.",
    points: ["Clear messages with priority and suggested questions", "Add notes and confirm what was reported", "Message patients back with quick replies"],
  },
};

// Split layout used by every login / sign-up page: teal story panel on the left, the form on the right.
export default function AuthLayout({
  role,
  title,
  subtitle,
  children,
  footer,
}: {
  role: "patient" | "doctor";
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const panel = PANEL[role];
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2 bg-paper">
      <aside className="mh-hero text-white px-8 py-8 lg:px-14 lg:py-12 flex flex-col">
        <a href="/">
          <Logo light />
        </a>
        <div className="my-8 lg:my-auto lg:max-w-md">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold leading-tight">{panel.heading}</h2>
          <ul className="hidden sm:block mt-8 space-y-3">
            {panel.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-white/90">
                <span className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-white/15 shrink-0">
                  <CheckIcon className="w-3.5 h-3.5" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden lg:block text-sm text-white/60">An assistive communication tool for Indian Sign Language. Not a diagnostic system.</p>
      </aside>

      <section className="flex items-center justify-center px-6 py-10 lg:py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          <p className="text-gray-500 mt-1.5 mb-7">{subtitle}</p>
          {children}
          <div className="mt-6 text-center text-gray-600">{footer}</div>
        </div>
      </section>
    </main>
  );
}
