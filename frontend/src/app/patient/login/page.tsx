"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../../../lib/auth";
import AuthLayout, { inputClass } from "../../../components/AuthLayout";

export default function PatientLogin() {
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
      if (data.role !== "patient") {
        throw new Error("This is a healthcare professional account. Please use the professional login.");
      }
      setToken("patient", data.access_token);
      router.push("/patient");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      role="patient"
      title="Welcome back"
      subtitle="Log in to your patient account"
      footer={
        <>
          New here? <a href="/patient/register" className="text-brand font-semibold">Create an account</a>
          <span className="block mt-2 text-sm">
            Healthcare professional? <a href="/doctor/login" className="text-brand font-semibold">Professional login</a>
          </span>
        </>
      }
    >
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <button type="submit" disabled={loading} className="w-full py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-deep transition disabled:opacity-50">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
