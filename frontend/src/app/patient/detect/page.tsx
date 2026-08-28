"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const SEQUENCE_LENGTH = 30;
const CONFIDENCE_THRESHOLD = 0.7;
const PREDICT_INTERVAL_MS = 1500;

export default function DetectPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[][]>([]);
  const lastPredictTimeRef = useRef<number>(0);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("medhear_token");
    if (!token) {
      router.push("/patient/login");
      return;
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
          numHands: 1,
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/predict/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence }),
        });
        const data = await res.json();

        if (data.error) {
          console.error(data.error);
          return;
        }

        if (data.confidence >= CONFIDENCE_THRESHOLD) {
          setCurrentSign(data.sign);
          setConfidence(data.confidence);
          setLowConfidence(false);
        } else {
          setCurrentSign(null);
          setConfidence(data.confidence);
          setLowConfidence(true);
        }
      } catch (err) {
        console.error("Prediction request failed", err);
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
        const landmarks = results.landmarks[0];

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

        const flatFrame: number[] = [];
        for (const p of landmarks) {
          flatFrame.push(p.x, p.y, p.z);
        }
        bufferRef.current.push(flatFrame);
        if (bufferRef.current.length > SEQUENCE_LENGTH) {
          bufferRef.current.shift();
        }

        const now = performance.now();
        if (
          bufferRef.current.length === SEQUENCE_LENGTH &&
          now - lastPredictTimeRef.current > PREDICT_INTERVAL_MS
        ) {
          lastPredictTimeRef.current = now;
          sendToBackend([...bufferRef.current]);
        }
      } else {
        bufferRef.current = [];
      }

      animationId = requestAnimationFrame(predictLoop);
    }

    setup();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [router]);

  function addToReport() {
    if (currentSign && !report.includes(currentSign)) {
      setReport([...report, currentSign]);
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Sign Detection</h1>
      <p className="text-gray-400 mb-4">
        {ready ? (handsDetected > 0 ? "Hand detected" : "Show your hand to the camera") : "Loading..."}
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

      <div className="mt-6 w-full max-w-2xl bg-gray-800 rounded-xl p-6 text-center">
        {currentSign ? (
          <>
            <p className="text-3xl font-bold text-green-400">{currentSign}</p>
            <p className="text-gray-400 mt-1">Confidence: {(confidence! * 100).toFixed(0)}%</p>
            <button
              onClick={addToReport}
              className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Add to Report
            </button>
          </>
        ) : lowConfidence ? (
          <p className="text-yellow-400 font-semibold">
            Sign not recognized clearly. Please repeat the sign.
          </p>
        ) : (
          <p className="text-gray-500">Waiting for a clear sign...</p>
        )}
      </div>

      {report.length > 0 && (
        <div className="mt-6 w-full max-w-2xl bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-2">Current Report</p>
          <div className="flex flex-wrap gap-2">
            {report.map((sign) => (
              <span key={sign} className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">
                {sign}
              </span>
            ))}
          </div>
        </div>
      )}

      <a href="/patient" className="mt-8 text-blue-400 font-semibold">
        &larr; Back to Dashboard
      </a>
    </main>
  );
}