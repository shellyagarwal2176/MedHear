"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("medhear_token");
    const role = localStorage.getItem("medhear_role");
    if (!token || role !== "patient") {
      router.push("/patient/login");
    } else {
      setChecking(false);
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("medhear_token");
    localStorage.removeItem("medhear_role");
    router.push("/patient/login");
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Patient Dashboard</h1>
          <button onClick={handleLogout} className="text-gray-500 hover:text-gray-800 text-sm font-semibold">
            Log Out
          </button>
        </div>

        <div className="grid gap-4">
          <a href="/patient/detect" className="block bg-blue-600 text-white text-xl font-semibold rounded-2xl px-8 py-8 text-center hover:bg-blue-700 transition">
            Start Sign Detection
          </a>
          <a href="/patient/reports" className="block bg-white border-2 border-gray-200 text-gray-900 text-xl font-semibold rounded-2xl px-8 py-6 text-center hover:border-gray-400 transition">
            Previous Reports
          </a>
        </div>
      </div>
    </main>
  );
}