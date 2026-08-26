"use client";
import { useState } from "react";

export default function PatientRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Create Patient Account</h1>
        <p className="text-gray-600 mb-8 text-center">Get started with MedHear</p>

        <form className="space-y-4">
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg" />
          <button type="submit" className="w-full py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition">Sign Up</button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Already have an account? <a href="/patient/login" className="text-blue-600 font-semibold">Log in</a>
        </p>
      </div>
    </main>
  );
}
