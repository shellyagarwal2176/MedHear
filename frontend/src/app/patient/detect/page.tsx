"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { PAIN_LEVELS, levelColor, partLabel } from "../../../components/BodyMap";
import { InsightList, PriorityBadge, type Analysis } from "../../../components/ReportParts";
import { api } from "../../../lib/api";
import { speak } from "../../../lib/speak";
import { getToken } from "../../../lib/auth";

const SEQUENCE_LENGTH = 30;
const FEATURES_PER_HAND = 63;
const MIN_FRAMES = 10;
const CONFIDENCE_THRESHOLD = 0.5;
const MIN_MARGIN = 0.2;
// thirsty is one held pose that the in-between shapes of other signs (hot above all) can drift into,
// so it has to be clearly the best answer before it is shown
const STRICT: Record<string, { score: number; margin: number }> = { thirsty: { score: 0.85, margin: 0.5 } };
const SMOOTHING_WINDOW = 3;
const PREDICT_INTERVAL_MS = 700;

interface ReportEntry {
  part: string | null;
  sign: string;
  confidence: number | null;
}

interface ReportItem {
  part: string | null;
  level: number | null;
  sign: string | null;
  confidence: number | null;
}

export default function DetectPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[][]>([]);
  const lastPredictTimeRef = useRef<number>(0);
  const recentScoresRef = useRef<Record<string, number>[]>([]);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [report, setReport] = useState<ReportEntry[]>([]);
  const [bodyParts, setBodyParts] = useState<{ id: string; level: number }[]>([]);
  const [activePart, setActivePart] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<Analysis | null>(null);
  const [canSpeak, setCanSpeak] = useState(true);

  useEffect(() => {
    const token = getToken("patient");
    if (!token) {
      router.push("/patient/login");
      return;
    }

    try {
      const raw = JSON.parse(sessionStorage.getItem("medhear_body_parts") ?? "[]");
      const saved: { id: string; level: number }[] = Array.isArray(raw)
        ? raw.filter((s) => typeof s?.id === "string" && Number.isInteger(s.level) && s.level >= 1 && s.level <= PAIN_LEVELS.length)
        : [];
      setBodyParts(saved);
      setActivePart(saved[0]?.id ?? null);
    } catch {
      // no saved body parts
    }

    let stream: MediaStream;
    let handLandmarker: HandLandmarker;
    let animationId: number;

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setReady(true);
            predictLoop();
          };
        }
      } catch (err) {
        console.error(err);
        setError("Could not start camera or load hand detection. Please allow camera permission and reload.");
      }
    }

    async function sendToBackend(sequence: number[][]) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence }),
        });
        const data = await res.json();

        if (data.error) {
          console.error(data.error);
          return;
        }

        // Average the last few results so one noisy window can't decide the sign
        recentScoresRef.current.push(data.all_scores);
        if (recentScoresRef.current.length > SMOOTHING_WINDOW) recentScoresRef.current.shift();

        const avg: Record<string, number> = {};
        for (const scores of recentScoresRef.current) {
          for (const [sign, p] of Object.entries(scores as Record<string, number>)) {
            avg[sign] = (avg[sign] ?? 0) + p / recentScoresRef.current.length;
          }
        }
        const ranked = Object.entries(avg).sort((a, b) => b[1] - a[1]);
        const [topSign, topScore] = ranked[0];
        const runnerUp = ranked[1]?.[1] ?? 0;

        const need = STRICT[topSign] ?? { score: CONFIDENCE_THRESHOLD, margin: MIN_MARGIN };
        if (topScore >= need.score && topScore - runnerUp >= need.margin) {
          setCurrentSign(topSign);
          setConfidence(topScore);
          setLowConfidence(false);
        } else {
          setCurrentSign(null);
          setConfidence(topScore);
          setLowConfidence(true);
        }
      } catch (err) {
        console.error("Prediction request failed", err);
      }
    }

    function drawHand(ctx: CanvasRenderingContext2D, landmarks: any[], canvas: HTMLCanvasElement) {
      const connections: [number, number][] = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17],
      ];
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      for (const [a, b] of connections) {
        const p1 = landmarks[a];
        const p2 = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
      ctx.fillStyle = "#4ade80";
      for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    function predictLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !handLandmarker) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const results = handLandmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHandsDetected(results.landmarks.length);

      if (results.landmarks.length > 0) {
        // Build a 126-length frame in pixel units, hands ordered by wrist x (not by MediaPipe's
        // handedness label, which flips with mirroring); a single hand goes in the first slot.
        const w = video.videoWidth;
        const h = video.videoHeight;
        const hands = results.landmarks.map((landmarks) => {
          drawHand(ctx, landmarks, canvas);
          const flat: number[] = [];
          for (const p of landmarks) {
            flat.push(p.x * w, p.y * h, p.z * w);
          }
          return flat;
        });
        hands.sort((a, b) => a[0] - b[0]);

        const flatFrame = new Array(FEATURES_PER_HAND * 2).fill(0);
        hands.slice(0, 2).forEach((flat, i) => flatFrame.splice(i * FEATURES_PER_HAND, FEATURES_PER_HAND, ...flat));
        bufferRef.current.push(flatFrame);
        if (bufferRef.current.length > SEQUENCE_LENGTH) {
          bufferRef.current.shift();
        }

        const now = performance.now();
        if (
          bufferRef.current.length >= MIN_FRAMES &&
          now - lastPredictTimeRef.current > PREDICT_INTERVAL_MS
        ) {
          lastPredictTimeRef.current = now;
          sendToBackend([...bufferRef.current]);
        }
      } else {
        bufferRef.current = [];
        recentScoresRef.current = [];
      }

      animationId = requestAnimationFrame(predictLoop);
    }

    setup();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [router]);

  function addEntry(sign: string, entryConfidence: number | null) {
    const entry = { part: activePart, sign, confidence: entryConfidence };
    const existing = report.findIndex((r) => r.part === activePart && r.sign === sign);
    setReport(existing >= 0 ? report.map((r, i) => (i === existing ? entry : r)) : [...report, entry]);
    setSaveState("idle");
  }

  function addToReport() {
    if (currentSign) addEntry(currentSign, confidence ?? 0);
  }

  function removeFromReport(index: number) {
    setReport(report.filter((_, i) => i !== index));
    setSaveState("idle");
  }

  // Every selected body part is included with its pain level (and its signs, if any);
  // signs made without a body part are general symptoms.
  function buildItems(entries: ReportEntry[]): ReportItem[] {
    return [
      ...bodyParts.flatMap(({ id, level }): ReportItem[] => {
        const signs = entries.filter((r) => r.part === id);
        return signs.length > 0
          ? signs.map((r) => ({ part: id, level, sign: r.sign, confidence: r.confidence }))
          : [{ part: id, level, sign: null, confidence: null }];
      }),
      ...entries
        .filter((r) => !r.part)
        .map((r) => ({ part: null, level: null, sign: r.sign, confidence: r.confidence })),
    ];
  }

  const items = buildItems(report);
  const itemsKey = JSON.stringify(items);

  // What the patient seems to be saying right now: the draft plus the sign currently on camera
  const alreadyAdded = report.some((r) => r.part === activePart && r.sign === currentSign);
  const liveKey = currentSign && !alreadyAdded
    ? JSON.stringify(buildItems([...report, { part: activePart, sign: currentSign, confidence }]))
    : "";

  // The server writes the message and AI-assisted reading so the patient sees what the care team will
  useEffect(() => {
    const parsed: ReportItem[] = JSON.parse(itemsKey);
    if (parsed.length === 0) {
      setAnalysis(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Analysis>("/reports/preview", { method: "POST", body: { items: parsed } })
        .then(setAnalysis)
        .catch(() => setAnalysis(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [itemsKey]);

  useEffect(() => {
    if (!liveKey) {
      setLiveAnalysis(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Analysis>("/reports/preview", { method: "POST", body: { items: JSON.parse(liveKey) } })
        .then(setLiveAnalysis)
        .catch(() => setLiveAnalysis(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [liveKey]);

  const reading = liveKey ? liveAnalysis : analysis;

  async function saveReport() {
    setSaveState("saving");
    try {
      await api("/reports", { method: "POST", body: { items } });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function readAloud() {
    if (analysis && !speak(analysis.message)) setCanSpeak(false);
  }

  function startNewReport() {
    sessionStorage.removeItem("medhear_body_parts");
    router.push("/patient/body");
  }

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Sign Detection</h1>

      {bodyParts.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          <span className="text-gray-400 text-sm">Describing:</span>
          {bodyParts.map(({ id, level }) => (
            <button
              key={id}
              onClick={() => setActivePart(id)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition ${
                activePart === id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: levelColor(level) }}
                title={PAIN_LEVELS[level - 1]?.label}
              />
              {partLabel(id)}
            </button>
          ))}
          <a href="/patient/body" className="text-blue-400 text-sm font-semibold ml-1">
            Change
          </a>
        </div>
      ) : (
        <a href="/patient/body" className="mb-4 text-blue-400 text-sm font-semibold">
          Choose a body part first
        </a>
      )}
      <p className="text-gray-400 mb-4">
        {ready ? (handsDetected > 0 ? `${handsDetected} hand(s) detected` : "Show your hand(s) to the camera") : "Loading..."}
      </p>

      {error && <p className="text-red-400 text-center mb-4 max-w-md">{error}</p>}

      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden border-2 border-gray-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full scale-x-[-1]" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Starting camera and loading model...
          </div>
        )}
      </div>

      <div className="mt-6 w-full max-w-2xl bg-gray-800 rounded-xl p-6">
        {currentSign ? (
          <div className="text-center">
            <p className="text-3xl font-bold text-green-400">{currentSign}</p>
            <p className="text-gray-400 mt-1">Confidence: {(confidence! * 100).toFixed(0)}%</p>
            {!alreadyAdded && (
              <button
                onClick={addToReport}
                className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Add to Report draft
              </button>
            )}
          </div>
        ) : lowConfidence ? (
          <p className="text-yellow-400 font-semibold text-center">Sign not recognized clearly. Please repeat the sign.</p>
        ) : (
          <p className="text-gray-500 text-center">Waiting for a clear sign...</p>
        )}

        {reading && (
          <div className="mt-5 border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">You seem to be telling us</p>
            <p className="text-white text-lg leading-snug mb-3">{reading.message}</p>
            <InsightList insights={reading.insights.slice(0, 2)} theme="dark" showQuestions={false} />
            <p className="text-gray-500 text-xs mt-2">AI-assisted guess, not a diagnosis.</p>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-6 w-full max-w-2xl bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-sm">Report draft</p>
            {analysis && <PriorityBadge priority={analysis.priority} />}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Message to care team</p>
            <p className="text-white text-lg leading-snug">{analysis?.message ?? "Preparing your message..."}</p>
            {analysis && canSpeak && (
              <button onClick={readAloud} className="mt-3 text-sm font-semibold text-blue-400 hover:text-blue-300">
                &#128266; Read aloud to staff
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {report.map(({ part, sign, confidence: conf }, i) => (
              <span
                key={`${part}-${sign}`}
                className="flex items-center gap-2 pl-3 pr-2 py-1 bg-blue-900 text-blue-200 rounded-full text-sm"
              >
                {part ? `${partLabel(part)} · ${sign}` : sign}
                {conf !== null && <span className="text-blue-400">{Math.round(conf * 100)}%</span>}
                <button
                  onClick={() => removeFromReport(i)}
                  aria-label={`Remove ${sign}`}
                  className="text-blue-300 hover:text-white text-base leading-none px-1"
                >
                  &times;
                </button>
              </span>
            ))}
            {report.length === 0 && (
              <span className="text-gray-500 text-sm">No signs added yet. Your body parts and pain levels will still be sent.</span>
            )}
          </div>

          <button
            onClick={saveReport}
            disabled={saveState === "saving" || saveState === "saved"}
            className="mt-5 w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition"
          >
            {saveState === "saving" ? "Sending..." : saveState === "saved" ? "Report sent to your care team" : "Send Report"}
          </button>
          {saveState === "error" && (
            <p className="text-red-400 text-sm mt-2 text-center">Could not send the report. Please try again.</p>
          )}
          {saveState === "saved" && (
            <div className="flex justify-center gap-6 mt-3 text-sm font-semibold">
              <a href="/patient/reports" className="text-blue-400">View previous reports</a>
              <button onClick={startNewReport} className="text-blue-400">Start a new report</button>
            </div>
          )}
        </div>
      )}

      <a href="/patient" className="mt-8 text-blue-400 font-semibold">
        &larr; Back to Dashboard
      </a>
    </main>
  );
}