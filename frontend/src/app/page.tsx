import GetStarted from "../components/GetStarted";
import {
  AlertIcon,
  ArrowIcon,
  BodyIcon,
  CameraIcon,
  CheckIcon,
  Logo,
  MessageIcon,
  ProfileIcon,
  ShieldIcon,
} from "../components/Icons";

const STATS = [
  { value: "15", label: "Signs recognised" },
  { value: "3", label: "Steps to send a report" },
  { value: "1 tap", label: "Emergency alert" },
  { value: "2-way", label: "Live messages with your care team" },
];

const STEPS = [
  { icon: BodyIcon, title: "Tap where it hurts", text: "Pick the body part on a simple body map and say how strong the pain is." },
  { icon: CameraIcon, title: "Sign it to the camera", text: "MedHear recognises the sign in real time and shows how confident it is." },
  { icon: ShieldIcon, title: "Care team reviews", text: "A clear message reaches the doctor, who adds notes and confirms." },
];

const FEATURES = [
  { icon: BodyIcon, title: "Body map", text: "Front, back and face views with five pain levels, so location and severity are clear.", tint: true },
  { icon: CameraIcon, title: "Sign detection", text: "Real-time Indian Sign Language recognition for a focused medical vocabulary." },
  { icon: ShieldIcon, title: "AI-assisted reports", text: "Plain-language messages, possible meanings and a priority for the care team." },
  { icon: AlertIcon, title: "Emergency alert", text: "One confirmed tap sends an emergency alert straight to the care team." },
  { icon: MessageIcon, title: "Two-way messages", text: "Doctors ask questions and patients answer with quick replies, no typing." },
  { icon: ProfileIcon, title: "Medical profile", text: "Allergies, conditions and an emergency contact travel with every report." },
];

const SIGNS = ["Pain", "Pressure", "Hot", "Sick", "Thirsty", "Skin problem", "Bad", "Again", "Problem", "Stand", "How are you", "Agree", "Doctor", "Help", "Assistance"];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-gray-900">
      {/* ---------- hero ---------- */}
      <section className="mh-hero relative overflow-hidden text-white">
        <nav className="relative z-10 max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/">
            <Logo light />
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
            <a href="#get-started" className="hover:text-white">Get started</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#signs" className="hover:text-white">Signs</a>
          </div>
          <a href="/patient/login" className="px-4 py-2 rounded-full border border-white/50 text-sm font-semibold hover:bg-white/10 transition">
            Log in
          </a>
        </nav>

        <div className="relative max-w-6xl mx-auto px-6 pt-12 md:pt-16 text-center">
          <p className="inline-block mb-5 px-4 py-1 rounded-full bg-white/15 text-sm font-medium text-white/90">Indian Sign Language · Healthcare</p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium leading-[1.1] max-w-3xl mx-auto">
            Healthcare that understands your signs
          </h1>
          <p className="mt-5 text-lg text-white/80 max-w-2xl mx-auto">
            MedHear helps deaf patients tell their care team what is wrong, clearly and quickly, using sign language.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/patient/register" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-white text-brand-deep font-semibold shadow-lg shadow-black/10 hover:bg-sky transition">
              I am a patient <ArrowIcon className="w-4 h-4" />
            </a>
            <a href="/doctor/login" className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-ink/60 text-white font-semibold border border-white/20 hover:bg-ink transition">
              I am a healthcare professional
            </a>
          </div>

          {/* floating product preview */}
          <div className="relative mt-14 mx-auto max-w-4xl h-80 md:h-96">
            <div className="mh-float-slow hidden md:block absolute left-4 top-14 w-56 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 text-left">
              <p className="text-xs font-semibold text-white/70 mb-2">STEP 1</p>
              <p className="font-semibold">Tap where it hurts</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Chest", "Level 4"].map((c) => (
                  <span key={c} className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold">{c}</span>
                ))}
              </div>
            </div>

            <div className="mh-float relative mx-auto top-0 w-72 sm:w-80 md:w-96 rounded-3xl bg-white text-gray-900 shadow-2xl shadow-black/25 p-5 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">New report</span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-bold">Emergency</span>
              </div>
              <p className="font-display text-xl font-medium text-ink leading-snug">Patient indicates pressure and pain in the chest. Requesting doctor.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["Chest", "Pressure", "Pain", "Doctor"].map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded-full bg-sky text-brand-deep text-xs font-semibold">{c}</span>
                ))}
              </div>
              <p className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">Suggested question: does the pain spread to the arm or jaw?</p>
            </div>

            <div className="mh-float-slow hidden md:block absolute right-4 top-24 w-56 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 text-left">
              <p className="text-xs font-semibold text-white/70 mb-2">STEP 2</p>
              <p className="font-semibold">Sign it to the camera</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-white/90">
                <CheckIcon className="w-4 h-4" /> Pressure · 99%
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-paper" aria-hidden="true" />
      </section>

      {/* ---------- promise + stats ---------- */}
      <section className="max-w-4xl mx-auto px-6 pt-10 pb-16 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-medium text-ink leading-tight">
          Where communication feels difficult, <br className="hidden md:block" />
          we make it clear.
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl mx-auto">
          Deaf patients often struggle to explain symptoms, especially in urgent moments. MedHear turns signs into a clear message the care team can act on.
        </p>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((st) => (
            <div key={st.label}>
              <p className="font-display text-4xl text-ink">{st.value}</p>
              <p className="mt-1 text-sm text-gray-500">{st.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- get started ---------- */}
      <section id="get-started" className="max-w-5xl mx-auto px-6 pb-20 scroll-mt-20">
        <GetStarted />
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 pb-20 scroll-mt-20">
        <h2 className="font-display text-3xl font-medium text-ink text-center mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky text-brand-deep">
                  <step.icon className="w-6 h-6" />
                </span>
                <span className="font-display text-3xl text-gray-200">0{i + 1}</span>
              </div>
              <h3 className="font-display text-xl font-medium text-ink mb-1.5">{step.title}</h3>
              <p className="text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-20 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <h2 className="font-display text-3xl font-medium text-ink leading-tight">
            Everything in <br /> one place
          </h2>
          <p className="max-w-sm text-gray-600">From the first sign to the doctor&apos;s reply, the whole conversation stays in MedHear.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className={`rounded-2xl border p-6 ${f.tint ? "bg-sky border-blue-200" : "bg-white border-gray-200"}`}>
              <f.icon className="w-7 h-7 text-brand mb-8" />
              <h3 className="font-display text-xl font-medium text-ink mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- signs ---------- */}
      <section id="signs" className="max-w-5xl mx-auto px-6 pb-20 scroll-mt-20">
        <div className="rounded-3xl bg-sky/70 border border-blue-100 p-8 md:p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="font-display text-3xl font-medium text-ink leading-tight">Signs MedHear understands</h2>
            <p className="mt-3 text-gray-600">A focused vocabulary for symptoms, severity, requests and replies. Body parts are chosen on the body map.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SIGNS.map((sign) => (
              <span key={sign} className="px-3.5 py-1.5 rounded-full bg-white text-brand-deep text-sm font-semibold border border-blue-100">
                {sign}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- professionals ---------- */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="mh-hero rounded-3xl px-8 py-12 text-center text-white">
          <h2 className="font-display text-3xl font-medium">Are you a healthcare professional?</h2>
          <p className="mt-3 text-white/80 max-w-lg mx-auto">Review reports by priority, add notes, confirm and message patients back.</p>
          <a href="/doctor/register" className="mt-7 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white text-brand-deep font-semibold hover:bg-sky transition">
            Create a professional account <ArrowIcon className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ---------- limitations ---------- */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-7">
          <h2 className="font-display text-xl font-medium text-amber-950 mb-3">Important limitations</h2>
          <ul className="text-amber-950/80 list-disc pl-6 space-y-1 text-sm">
            <li>MedHear is an assistive communication tool, not a diagnostic system.</li>
            <li>It does not diagnose conditions or recommend medication.</li>
            <li>It recognises a limited, fixed vocabulary of signs, not full sign language translation.</li>
            <li>A healthcare professional always reviews and confirms what was reported.</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-sm text-gray-500">Helping deaf patients be heard.</p>
        </div>
      </footer>
    </main>
  );
}
