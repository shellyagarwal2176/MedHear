"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import AppShell, { PageHeader } from "../../../components/AppShell";

interface Profile {
  age: string;
  blood_group: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const EMPTY: Profile = {
  age: "",
  blood_group: "",
  allergies: "",
  conditions: "",
  medications: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};
const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken("patient")) {
      router.push("/patient/login");
      return;
    }
    api<Omit<Profile, "age"> & { age: number | null }>("/profile")
      .then((p) => setForm({ ...p, age: p.age === null ? "" : String(p.age) }))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [router]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setState("idle");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError("");
    try {
      await api("/profile", { method: "PUT", body: { ...form, age: form.age === "" ? null : Number(form.age) } });
      setState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setState("error");
    }
  }

  const input = "w-full px-4 py-3 border border-gray-300 rounded-lg text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const label = "block text-sm font-semibold text-gray-700 mb-1";

  return (
    <AppShell role="patient">
      <PageHeader
        title="My medical info"
        subtitle="Your care team sees this with every report, so they don't have to ask. Share only what you are comfortable with."
      />
      <div className="max-w-lg">
        {!loaded ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="age">Age</label>
                <input id="age" type="number" min={0} max={120} value={form.age} onChange={(e) => update("age", e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="blood">Blood group</label>
                <select id="blood" value={form.blood_group} onChange={(e) => update("blood_group", e.target.value)} className={input}>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>{b || "Not sure"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label} htmlFor="allergies">Allergies</label>
              <input id="allergies" maxLength={300} placeholder="e.g. Penicillin, peanuts" value={form.allergies} onChange={(e) => update("allergies", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="conditions">Medical conditions</label>
              <input id="conditions" maxLength={300} placeholder="e.g. Asthma, diabetes" value={form.conditions} onChange={(e) => update("conditions", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="meds">Current medicines</label>
              <input id="meds" maxLength={300} placeholder="e.g. Metformin 500 mg" value={form.medications} onChange={(e) => update("medications", e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="ecn">Emergency contact</label>
                <input id="ecn" maxLength={80} placeholder="Name" value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="ecp">Phone</label>
                <input id="ecp" type="tel" maxLength={20} placeholder="Number" value={form.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} className={input} />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={state === "saving"}
              className="w-full py-3 rounded-xl text-base font-semibold text-white bg-brand hover:bg-brand-deep disabled:opacity-60 transition"
            >
              {state === "saving" ? "Saving..." : state === "saved" ? "Saved ✓" : "Save"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
