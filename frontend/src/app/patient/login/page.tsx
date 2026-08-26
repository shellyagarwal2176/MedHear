"use client";
import { useState } from "react";

export default function PatientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Patient Login</h1>
        <p className="text-gray-600 mb-8 text-center">Welcome back to MedHear</p>

        <form className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <button type="submit" className="w-full py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition">Log In</button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          New here? <a href="/patient/register" className="text-blue-600 font-semibold">Create an account</a>
        </p>
      </div>
    </main>
  );
}
