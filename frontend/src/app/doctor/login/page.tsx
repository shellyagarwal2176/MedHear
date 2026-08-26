"use client";
import { useState } from "react";

export default function DoctorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Healthcare Professional Login</h1>
        <p className="text-gray-600 mb-8 text-center">Access your patient dashboard</p>

        <form className="space-y-4">
          <input type="email" placeholder="Work Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <button type="submit" className="w-full py-3 bg-gray-900 text-white text-lg font-semibold rounded-lg hover:bg-gray-800 transition">Log In</button>
        </form>
      </div>
    </main>
  );
}
