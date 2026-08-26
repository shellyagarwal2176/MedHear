"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function DetectPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);

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
          numHands: 2,
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

      for (const landmarks of results.landmarks) {
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

      animationId = requestAnimationFrame(predictLoop);
    }

    setup();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">Sign Detection</h1>
      <p className="text-gray-400 mb-6">
        {ready ? (handsDetected > 0 ? `${handsDetected} hand(s) detected` : "Show your hand to the camera") : "Loading..."}
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

      <p className="text-gray-400 mt-6 text-center max-w-md">
        Next: mapping hand movements to specific medical signs.
      </p>

      <a href="/patient" className="mt-8 text-blue-400 font-semibold">
        &larr; Back to Dashboard
      </a>
    </main>
  );
}