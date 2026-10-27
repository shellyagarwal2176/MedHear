"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BodyMap, { PAIN_LEVELS, VIEW_BOX, View, levelColor, partLabel } from "../../../components/BodyMap";
import { getToken } from "../../../lib/auth";
import AppShell from "../../../components/AppShell";

const STORAGE_KEY = "medhear_body_parts";
const DEFAULT_LEVEL = 3;
const FLIP_MS = 220;
const VIEWS: { id: View; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "face", label: "Face" },
];

interface Selection {
  id: string;
  level: number;
}

// Drop anything that isn't a valid {id, level} (e.g. the older plain-string format)
function parseSelection(raw: unknown): Selection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Selection =>
      typeof s?.id === "string" && Number.isInteger(s.level) && s.level >= 1 && s.level <= PAIN_LEVELS.length
  );
}

export default function BodyPartPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("front");
  const [flipping, setFlipping] = useState(false);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [lastTapped, setLastTapped] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken("patient")) {
      router.push("/patient/login");
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setSelected(parseSelection(JSON.parse(saved)));
    } catch {
      // ignore unreadable saved selection
    }
  }, [router]);

  function switchView(next: View) {
    if (next === view || flipping) return;
    setFlipping(true);
    setHovered(null);
    setTimeout(() => {
      setView(next);
      setFlipping(false);
    }, FLIP_MS);
  }

  function toggle(id: string) {
    setLastTapped(id);
    setSelected((prev) =>
      prev.some((s) => s.id === id) ? prev.filter((s) => s.id !== id) : [...prev, { id, level: DEFAULT_LEVEL }]
    );
  }

  function setLevel(id: string, level: number) {
    setSelected((prev) => prev.map((s) => (s.id === id ? { ...s, level } : s)));
  }

  function handleContinue() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    router.push("/patient/detect");
  }

  const activeLabel = hovered ? partLabel(hovered) : lastTapped ? partLabel(lastTapped) : null;
  const levels = Object.fromEntries(selected.map((s) => [s.id, s.level]));
  const { w, h } = VIEW_BOX[view];
  const widthCap = view === "face" ? "300px" : "calc(52vh * 0.47)";

  return (
    <AppShell role="patient">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mh-rise">
          <h1 className="font-display text-3xl font-semibold text-ink">Where is the problem?</h1>
          <p className="text-gray-500 mt-1">Tap the part of your body that hurts. You can pick more than one.</p>
        </div>

        <div className="mt-5 flex justify-center">
          <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-gray-200" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                onClick={() => switchView(v.id)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  view === v.id ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-8 mt-4 text-center" aria-live="polite">
          {activeLabel ? (
            <span key={activeLabel} className="mh-chip-in inline-block text-lg font-semibold text-blue-700">
              {activeLabel}
            </span>
          ) : (
            <span className="text-gray-400">Tap a body part</span>
          )}
        </div>

        <div
          className="relative mx-auto mt-2 mh-rise"
          style={{ perspective: "900px", width: `min(100%, 300px, ${widthCap})` }}
        >
          <div
            style={{
              aspectRatio: `${w} / ${h}`,
              transform: flipping ? "rotateY(90deg)" : "rotateY(0deg)",
              transition: `transform ${FLIP_MS}ms ease-in-out`,
            }}
          >
            <BodyMap
              view={view}
              selected={selected.map((s) => s.id)}
              levels={levels}
              onToggle={toggle}
              onHover={setHovered}
              showHint={selected.length === 0 && !lastTapped}
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-40 h-4 rounded-[50%] bg-gray-900/10 blur-md pointer-events-none" />
        </div>

        <div className="mt-8 min-h-22">
          {selected.length > 0 && (
            <div className="mh-slide-up">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">How much does it hurt? ({selected.length})</p>
                <button
                  onClick={() => {
                    setSelected([]);
                    setLastTapped(null);
                  }}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-800"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {selected.map(({ id, level }) => (
                  <div key={id} className="mh-chip-in bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{partLabel(id)}</span>
                      <button
                        onClick={() => toggle(id)}
                        aria-label={`Remove ${partLabel(id)}`}
                        className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {PAIN_LEVELS.map((p) => (
                        <button
                          key={p.level}
                          onClick={() => setLevel(id, p.level)}
                          aria-label={`${p.label} pain`}
                          aria-pressed={level === p.level}
                          className="flex-1 h-10 rounded-xl font-bold text-white text-sm transition-all duration-200"
                          style={{
                            backgroundColor: p.color,
                            opacity: level === p.level ? 1 : 0.35,
                            transform: level === p.level ? "scale(1.08)" : "scale(1)",
                            boxShadow: level === p.level ? `0 4px 12px ${p.color}66` : "none",
                          }}
                        >
                          {p.level}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-semibold mt-2 text-center" style={{ color: levelColor(level) }}>
                      {PAIN_LEVELS[level - 1].label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className="mt-4 w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {selected.length === 0 ? "Select a body part to continue" : "Next: show it in sign language"}
        </button>
      </div>
    </AppShell>
  );
}
