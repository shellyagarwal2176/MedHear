"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../../../lib/auth";
import AuthLayout, { inputClass } from "../../../components/AuthLayout";

export default function DoctorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status >= 500) {
        throw new Error("The server is having trouble right now. Please try again in a moment.");
      }
      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }
      if (data.role !== "doctor") {
        throw new Error("This login is for healthcare professionals only.");
      }
      setToken("doctor", data.access_token);
      router.push("/doctor/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      role="doctor"
      title="Professional login"
      subtitle="Access your patient reports"
      footer={
        <>
          New here? <a href="/doctor/register" className="text-brand font-semibold">Create a professional account</a>
          <span className="block mt-2 text-sm">
            Patient? <a href="/patient/login" className="text-brand font-semibold">Patient login</a>
          </span>
        </>
      }
    >
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input type="email" placeholder="Work email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <button type="submit" disabled={loading} className="w-full py-3 bg-ink text-white font-semibold rounded-xl hover:bg-brand-deep transition disabled:opacity-50">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-semibold text-blue-900 mb-2">Demo account</p>
        <p className="text-gray-700">
          Email: <span className="font-mono font-semibold">doctor@example.com</span>
        </p>
        <p className="text-gray-700">
          Password: <span className="font-mono font-semibold">MedHear@2026</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setEmail("doctor@example.com");
            setPassword("MedHear@2026");
          }}
          className="mt-3 text-blue-700 font-semibold hover:text-blue-900"
        >
          Fill in for me
        </button>
      </div>
    </AuthLayout>
  );
}
