"use client";
import { CSSProperties, KeyboardEvent, PointerEvent, useRef, useState } from "react";

export type View = "front" | "back" | "face";

export const VIEW_BOX: Record<View, { w: number; h: number }> = {
  front: { w: 240, h: 510 },
  back: { w: 240, h: 510 },
  face: { w: 240, h: 300 },
};

export const PAIN_LEVELS = [
  { level: 1, label: "Mild", color: "#22c55e" },
  { level: 2, label: "Noticeable", color: "#84cc16" },
  { level: 3, label: "Painful", color: "#f59e0b" },
  { level: 4, label: "Severe", color: "#f97316" },
  { level: 5, label: "Unbearable", color: "#ef4444" },
];

export const levelColor = (level: number) => PAIN_LEVELS[level - 1]?.color ?? "#3b82f6";

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string }
  | { kind: "limb"; x1: number; y1: number; r1: number; x2: number; y2: number; r2: number };

interface Part {
  id: string;
  label: string;
  shapes: Shape[];
}

const WIDTH = 240;

const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: "ellipse", cx, cy, rx, ry });
const path = (d: string): Shape => ({ kind: "path", d });
// A tapered capsule between two circles: smooth arms, legs and fingers without hand-drawing each outline.
const limb = (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): Shape => ({
  kind: "limb", x1, y1, r1, x2, y2, r2,
});

function mirror(s: Shape): Shape {
  if (s.kind === "ellipse") return { ...s, cx: WIDTH - s.cx };
  if (s.kind === "limb") return { ...s, x1: WIDTH - s.x1, x2: WIDTH - s.x2 };
  return s; // paths are only used for centered parts
}

function limbPath({ x1, y1, r1, x2, y2, r2 }: Extract<Shape, { kind: "limb" }>): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (y2 - y1) / len;
  const ny = -(x2 - x1) / len;
  const f = (n: number) => n.toFixed(2);
  return (
    `M ${f(x1 + nx * r1)} ${f(y1 + ny * r1)} L ${f(x2 + nx * r2)} ${f(y2 + ny * r2)} ` +
    `A ${r2} ${r2} 0 0 1 ${f(x2 - nx * r2)} ${f(y2 - ny * r2)} L ${f(x1 - nx * r1)} ${f(y1 - ny * r1)} ` +
    `A ${r1} ${r1} 0 0 1 ${f(x1 + nx * r1)} ${f(y1 + ny * r1)} Z`
  );
}

// Limbs, drawn once for the viewer's left side and mirrored for the right.
const SIDED: { base: string; label: string; shape: Shape }[] = [
  { base: "shoulder", label: "shoulder", shape: ellipse(82, 114, 19, 15) },
  { base: "upper-arm", label: "upper arm", shape: limb(74, 120, 11.5, 64, 182, 8.5) },
  { base: "forearm", label: "forearm", shape: limb(64, 186, 8.5, 56, 240, 6) },
  { base: "hand", label: "hand", shape: limb(56, 244, 7.5, 51, 272, 4.5) },
  { base: "thigh", label: "thigh", shape: limb(105, 292, 14.5, 104, 376, 10.5) },
  { base: "knee", label: "knee", shape: ellipse(104, 387, 12, 10) },
  { base: "shin", label: "lower leg", shape: limb(104, 399, 10, 103, 474, 6.5) },
  { base: "foot", label: "foot", shape: limb(103, 484, 7.5, 94, 499, 6) },
];

const CENTER: Record<Exclude<View, "face">, { id: string; label: string; shape: Shape }[]> = {
  front: [
    { id: "head", label: "Head", shape: ellipse(120, 46, 24, 30) },
    { id: "neck", label: "Neck", shape: limb(120, 78, 10.5, 120, 100, 13) },
    {
      id: "chest",
      label: "Chest",
      shape: path("M 92 114 Q 92 104 104 104 L 136 104 Q 148 104 148 114 L 147 160 Q 146 179 138 179 L 102 179 Q 94 179 93 160 Z"),
    },
    {
      id: "abdomen",
      label: "Stomach",
      shape: path("M 94 183 L 146 183 Q 148 205 146 222 Q 145 237 142 239 L 98 239 Q 95 237 94 222 Q 92 205 94 183 Z"),
    },
    {
      id: "pelvis",
      label: "Hips & groin",
      shape: path("M 98 243 L 142 243 Q 152 262 151 284 Q 136 293 121 289 L 119 289 Q 104 293 89 284 Q 88 262 98 243 Z"),
    },
  ],
  back: [
    { id: "back-head", label: "Back of head", shape: ellipse(120, 46, 24, 30) },
    { id: "back-neck", label: "Back of neck", shape: limb(120, 78, 10.5, 120, 100, 13) },
    {
      id: "upper-back",
      label: "Upper back",
      shape: path("M 92 114 Q 92 104 104 104 L 136 104 Q 148 104 148 114 L 147 160 Q 146 179 138 179 L 102 179 Q 94 179 93 160 Z"),
    },
    {
      id: "lower-back",
      label: "Lower back",
      shape: path("M 94 183 L 146 183 Q 148 205 146 222 Q 145 237 142 239 L 98 239 Q 95 237 94 222 Q 92 205 94 183 Z"),
    },
    {
      id: "buttocks",
      label: "Buttocks",
      shape: path("M 98 243 L 142 243 Q 152 262 151 284 Q 136 293 121 289 L 119 289 Q 104 293 89 284 Q 88 262 98 243 Z"),
    },
  ],
};

const FACE: { id: string; label: string; shape: Shape }[] = [
  { id: "scalp", label: "Top of head", shape: path("M 56 118 A 68 95 0 0 1 184 118 Z") },
  { id: "forehead", label: "Forehead", shape: path("M 56 118 L 184 118 L 187 138 Q 120 128 53 138 Z") },
  { id: "jaw", label: "Jaw & chin", shape: path("M 76 222 A 68 95 0 0 0 164 222 Z") },
  { id: "right-ear", label: "Right ear", shape: ellipse(50, 156, 10, 22) },
  { id: "left-ear", label: "Left ear", shape: ellipse(190, 156, 10, 22) },
  { id: "right-eye", label: "Right eye", shape: ellipse(90, 152, 16, 9) },
  { id: "left-eye", label: "Left eye", shape: ellipse(150, 152, 16, 9) },
  { id: "nose", label: "Nose", shape: path("M 120 148 L 106 190 Q 120 202 134 190 Z") },
  { id: "mouth", label: "Mouth & teeth", shape: path("M 96 214 Q 120 205 144 214 Q 120 240 96 214 Z") },
];

// Non-interactive details that make the mannequin read as a person.
const DECOR: Record<View, string[]> = {
  front: [
    "M 100 109 Q 110 113 119 111", "M 140 109 Q 130 113 121 111", // collarbones
    "M 120 120 L 120 170", // sternum
    "M 108 138 Q 120 146 132 138", // chest line
    "M 116 214 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0", // navel
    "M 114 56 Q 120 60 126 56", // mouth
    "M 111 42 a 1.8 1.8 0 1 0 3.6 0 a 1.8 1.8 0 1 0 -3.6 0",
    "M 125.4 42 a 1.8 1.8 0 1 0 3.6 0 a 1.8 1.8 0 1 0 -3.6 0", // eyes
    "M 98 392 Q 104 398 110 392", "M 130 392 Q 136 398 142 392", // kneecaps
  ],
  back: [
    "M 120 108 L 120 236", // spine
    "M 100 130 Q 110 150 118 142", "M 140 130 Q 130 150 122 142", // shoulder blades
    "M 106 246 Q 120 262 134 246", // glutes
  ],
  face: [
    "M 74 132 Q 90 124 106 130", "M 134 130 Q 150 124 166 132", // eyebrows
    "M 83 152 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0",
    "M 143 152 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0", // irises
    "M 112 192 Q 116 196 119 192", "M 121 192 Q 124 196 128 192", // nostrils
    "M 98 214 Q 120 218 142 214", // lip line
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildParts(view: View): Part[] {
  if (view === "face") return FACE.map((f) => ({ id: f.id, label: f.label, shapes: [f.shape] }));
  const parts: Part[] = CENTER[view].map((c) => ({ id: c.id, label: c.label, shapes: [c.shape] }));
  // Seen from the front the viewer's left is the patient's right; from behind it's the reverse.
  const [viewerLeft, viewerRight] = view === "front" ? ["right", "left"] : ["left", "right"];
  for (const s of SIDED) {
    parts.push({ id: `${viewerLeft}-${s.base}`, label: `${cap(viewerLeft)} ${s.label}`, shapes: [s.shape] });
    parts.push({ id: `${viewerRight}-${s.base}`, label: `${cap(viewerRight)} ${s.label}`, shapes: [mirror(s.shape)] });
  }
  return parts;
}

const PARTS: Record<View, Part[]> = { front: buildParts("front"), back: buildParts("back"), face: buildParts("face") };

const LABELS: Record<string, string> = {};
for (const view of ["front", "back", "face"] as View[]) {
  for (const p of PARTS[view]) LABELS[p.id] = p.label;
}

export function partLabel(id: string): string {
  return LABELS[id] ?? id;
}

function ShapeEl({ shape, className }: { shape: Shape; className: string }) {
  if (shape.kind === "ellipse") {
    return <ellipse className={className} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
  }
  return <path className={className} d={shape.kind === "limb" ? limbPath(shape) : shape.d} />;
}

interface Props {
  view: View;
  selected: string[];
  levels: Record<string, number>;
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  showHint: boolean;
}

export default function BodyMap({ view, selected, levels, onToggle, onHover, showHint }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  function handlePointerDown(e: PointerEvent<SVGGElement>) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    setRipple({ x: local.x, y: local.y, key: Date.now() });
  }

  function handleKeyDown(e: KeyboardEvent<SVGGElement>, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(id);
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_BOX[view].w} ${VIEW_BOX[view].h}`}
      className="mh-body w-full h-full"
      role="group"
      aria-label={`${view} view of body`}
    >
      <defs>
        <radialGradient id="mh-body-grad" cx="0.35" cy="0.28" r="0.95">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#aebbcd" />
        </radialGradient>
      </defs>

      {view === "face" && (
        <g pointerEvents="none">
          <path d="M 96 236 L 96 275 Q 120 290 144 275 L 144 236 Z" fill="url(#mh-body-grad)" stroke="#94a3b8" strokeWidth="1.2" />
          <ellipse cx="120" cy="150" rx="68" ry="95" fill="url(#mh-body-grad)" stroke="#94a3b8" strokeWidth="1.2" />
        </g>
      )}

      {PARTS[view].map((part) => {
        const isSelected = selected.includes(part.id);
        return (
          <g
            key={part.id}
            className="mh-part"
            data-selected={isSelected}
            style={isSelected ? ({ "--mh-color": levelColor(levels[part.id] ?? 0) } as CSSProperties) : undefined}
            role="button"
            tabIndex={0}
            aria-label={part.label}
            aria-pressed={isSelected}
            onClick={() => onToggle(part.id)}
            onPointerDown={handlePointerDown}
            onPointerEnter={() => onHover(part.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(part.id)}
            onBlur={() => onHover(null)}
            onKeyDown={(e) => handleKeyDown(e, part.id)}
          >
            {part.shapes.map((shape, i) => (
              <g key={i}>
                {isSelected && <ShapeEl shape={shape} className="mh-pulse" />}
                <ShapeEl shape={shape} className="mh-shape" />
              </g>
            ))}
          </g>
        );
      })}

      <g className="mh-decor" pointerEvents="none">
        {DECOR[view].map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {showHint && (
        <g className="mh-hint" pointerEvents="none">
          <circle cx="120" cy={view === "face" ? 172 : 140} r="7" className="mh-hint-dot" />
          <circle cx="120" cy={view === "face" ? 172 : 140} r="7" className="mh-hint-ring" />
        </g>
      )}

      {ripple && (
        <circle
          key={ripple.key}
          className="mh-ripple"
          cx={ripple.x}
          cy={ripple.y}
          r="6"
          pointerEvents="none"
          onAnimationEnd={() => setRipple(null)}
        />
      )}
    </svg>
  );
}
