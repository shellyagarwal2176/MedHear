"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../../../lib/auth";
import AuthLayout, { inputClass } from "../../../components/AuthLayout";

export default function DoctorRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "doctor", invite_code: inviteCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status >= 500) {
        throw new Error("The server is having trouble right now. Please try again in a moment.");
      }
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Registration failed");
      }
      if (data.role !== "doctor") {
        throw new Error("This is a patient account. Please use the patient login.");
      }
      setToken("doctor", data.access_token);
      router.push("/doctor/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      role="doctor"
      title="Create a professional account"
      subtitle="For doctors and healthcare staff"
      footer={
        <>
          Already registered? <a href="/doctor/login" className="text-brand font-semibold">Log in</a>
        </>
      }
    >
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input type="text" placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <input type="email" placeholder="Work email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <input type="text" placeholder="Invite code" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className={inputClass} />
        <p className="text-xs text-gray-500">
          Healthcare accounts can see patient reports, so registration needs an invite code from your administrator.
        </p>
        <button type="submit" disabled={loading} className="w-full py-3 bg-ink text-white font-semibold rounded-xl hover:bg-brand-deep transition disabled:opacity-50">
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </AuthLayout>
  );
}
