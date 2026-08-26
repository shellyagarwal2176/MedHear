export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          MedHear
        </h1>
        <p className="text-xl text-gray-600 mb-10">
          Helping deaf patients communicate common medical needs to healthcare
          professionals using Indian Sign Language recognition.
        </p>

        <div className="flex gap-4 justify-center mb-16">
          
            href="/patient"
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            I am a Patient
          </a>
          
            href="/doctor"
            className="px-8 py-4 bg-gray-800 text-white text-lg font-semibold rounded-xl hover:bg-gray-900 transition"
          >
            I am a Healthcare Professional
          </a>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-bold mb-3">The Problem</h2>
          <p className="text-gray-600">
            Deaf patients often struggle to communicate symptoms and needs
            clearly to doctors, especially in urgent situations, leading to
            delays and miscommunication in care.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">How MedHear Helps</h2>
          <p className="text-gray-600">
            Patients sign common medical terms in Indian Sign Language in
            front of their camera. MedHear recognizes each sign, shows a
            confidence score, and builds a structured report the doctor can
            review and confirm.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-3">Supported Signs (growing list)</h2>
        <p className="text-gray-600 mb-4">
          Body parts (head, chest, stomach, hand, leg, back, eye, ear),
          symptoms (pain, fever, cough, cold, vomiting, nausea, dizziness,
          weakness), and healthcare terms (doctor, hospital, medicine,
          injection, emergency, help).
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 bg-yellow-50 rounded-xl mb-16">
        <h2 className="text-2xl font-bold mb-3">Important Limitations</h2>
        <ul className="text-gray-700 list-disc pl-6 space-y-1">
          <li>MedHear is an assistive communication tool, not a diagnostic system.</li>
          <li>It does not diagnose conditions or recommend medication.</li>
          <li>It recognizes a limited, fixed vocabulary of signs — not full ISL translation.</li>
          <li>A healthcare professional always reviews and confirms detected information.</li>
        </ul>
      </section>
    </main>
  );
}
