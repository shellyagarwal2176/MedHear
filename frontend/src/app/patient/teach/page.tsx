"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import AppShell, { PageHeader } from "../../../components/AppShell";
import { api } from "../../../lib/api";
import { getToken } from "../../../lib/auth";

const FEATURES_PER_HAND = 63;
const RECORD_MS = 8000;
const SIGNS = ["hot", "thirsty", "doctor", "pain", "pressure", "sick", "skin", "help", "assistance", "bad", "again", "problem", "stand", "agree", "how are you", "hungry"];

type Phase = "idle" | "countdown" | "recording" | "saving";

export default function TeachPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<number[][]>([]);
  const recordingRef = useRef(false);
  const [sign, setSign] = useState("hot");
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [captured, setCaptured] = useState(0);
  const [ready, setReady] = useState(false);
  const [hands, setHands] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!getToken("patient")) {
      router.push("/patient/login");
      return;
    }
    let stream: MediaStream | undefined;
    let landmarker: HandLandmarker | undefined;
    let raf = 0;
    let stopped = false;

    function loop() {
      const video = videoRef.current;
      if (stopped || !video || !landmarker) return;
      const res = landmarker.detectForVideo(video, performance.now());
      setHands(res.landmarks.length);
      if (res.landmarks.length > 0 && recordingRef.current) {
        // identical to the detector: pixel units, hands ordered by wrist x, a single hand in slot 0
        const w = video.videoWidth;
        const h = video.videoHeight;
        const hs = res.landmarks.map((lm) => lm.flatMap((p) => [p.x * w, p.y * h, p.z * w]));
        hs.sort((a, b) => a[0] - b[0]);
        const frame = new Array(FEATURES_PER_HAND * 2).fill(0);
        hs.slice(0, 2).forEach((flat, i) => frame.splice(i * FEATURES_PER_HAND, FEATURES_PER_HAND, ...flat));
        framesRef.current.push(frame);
        setCaptured(framesRef.current.length);
      }
      raf = requestAnimationFrame(loop);
    }

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        if (stopped) return;
        const created = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (stopped) {
          created.close();
          return;
        }
        landmarker = created;
        const media = await navigator.mediaDevices.getUserMedia({ video: true });
        if (stopped) {
          // this setup was superseded (React runs effects twice in development): release the camera and bail out
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setReady(true);
            loop();
          };
        }
      } catch {
        setError("Could not start the camera. Please allow camera permission and reload.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  async function record() {
    setError("");
    framesRef.current = [];
    setCaptured(0);
    setPhase("countdown");
    for (let n = 3; n >= 1; n--) {
      setCount(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setPhase("recording");
    recordingRef.current = true;
    await new Promise((r) => setTimeout(r, RECORD_MS));
    recordingRef.current = false;
    const frames = framesRef.current;
    if (frames.length < 15) {
      setPhase("idle");
      setError("Not enough hand frames were captured. Keep your hand clearly in view and try again.");
      return;
    }
    setPhase("saving");
    try {
      await api("/teach", { method: "POST", body: { label: sign, sequence: frames.slice(0, 600) } });
      setSaved((s) => ({ ...s, [sign]: (s[sign] ?? 0) + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the recording");
    }
    setPhase("idle");
  }

  const busy = phase !== "idle";

  return (
    <AppShell role="patient">
      <PageHeader
        title="Teach MedHear"
        subtitle="Record yourself signing a word. MedHear learns from your own camera, which makes recognition more accurate for you."
      />

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-gray-200">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            {phase === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="font-display text-8xl text-white">{count}</span>
              </div>
            )}
            {phase === "recording" && (
              <span className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Recording · {captured} frames
              </span>
            )}
            {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-white/80">Starting camera...</p>}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            {hands > 0 ? `${hands} hand${hands > 1 ? "s" : ""} detected` : "No hand detected: show your hand to the camera"}
          </p>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="sign" className="block text-sm font-semibold text-gray-700 mb-1">Which sign?</label>
          <select
            id="sign"
            value={sign}
            disabled={busy}
            onChange={(e) => setSign(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
          >
            {SIGNS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={record}
            disabled={busy || !ready}
            className="mt-4 w-full py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-deep disabled:opacity-50 transition"
          >
            {phase === "saving" ? "Saving..." : busy ? "Get ready..." : `Record "${sign}" (8 seconds)`}
          </button>

          <ol className="mt-5 space-y-2 text-sm text-gray-600 list-decimal pl-5">
            <li>Sit where you normally would, with good light.</li>
            <li>Press record. After the countdown, sign it again and again for 8 seconds, the way you would to a doctor.</li>
            <li>Do 4 to 6 recordings for each sign, changing your position a little each time.</li>
            <li>Tell your developer when you are done and they will retrain MedHear.</li>
          </ol>

          {Object.keys(saved).length > 0 && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <p className="font-semibold mb-1">Saved this session</p>
              {Object.entries(saved).map(([k, v]) => (
                <p key={k}>{k}: {v} recording{v > 1 ? "s" : ""}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
