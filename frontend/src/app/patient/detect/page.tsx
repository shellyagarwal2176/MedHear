"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DetectPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("medhear_token");
    if (!token) {
      router.push("/patient/login");
      return;
    }

    let stream: MediaStream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch (err) {
        setError("Could not access camera. Please allow camera permission and reload.");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Sign Detection</h1>

      {error && (
        <p className="text-red-400 text-center mb-4 max-w-md">{error}</p>
      )}

      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden border-2 border-gray-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Starting camera...
          </div>
        )}
      </div>

      <p className="text-gray-400 mt-6 text-center max-w-md">
        Sign detection and landmark recognition will be added here next.
      </p>

      <a href="/patient" className="mt-8 text-blue-400 font-semibold">
        &larr; Back to Dashboard
      </a>
    </main>
  );
}