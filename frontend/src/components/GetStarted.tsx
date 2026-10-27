"use client";
import { useEffect, useState } from "react";
import { clearToken, getToken, type Role } from "../lib/auth";
import { ArrowIcon, BodyIcon, StethoscopeIcon } from "./Icons";

export default function GetStarted() {
  const [signedIn, setSignedIn] = useState({ patient: false, doctor: false });

  useEffect(() => {
    setSignedIn({ patient: Boolean(getToken("patient")), doctor: Boolean(getToken("doctor")) });
  }, []);

  function logOut(role: Role) {
    clearToken(role);
    if (role === "patient") sessionStorage.removeItem("medhear_body_parts");
    setSignedIn((s) => ({ ...s, [role]: false }));
  }

  const primary = "flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition";
  const secondary = "block text-center px-6 py-3 rounded-full font-semibold border border-gray-300 text-gray-800 hover:border-gray-500 transition";
  const logoutLink = "w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-800 pt-1";

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 flex flex-col">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky text-brand-deep mb-5">
          <BodyIcon className="w-6 h-6" />
        </span>
        <h3 className="font-display text-2xl font-medium text-ink">I am a patient</h3>
        <p className="text-gray-600 mt-1.5 mb-6">Tap where it hurts, sign it, and send it to your care team.</p>
        <div className="space-y-3 mt-auto">
          {signedIn.patient ? (
            <>
              <a href="/patient" className={`${primary} bg-brand hover:bg-brand-deep`}>
                Open my dashboard <ArrowIcon className="w-4 h-4" />
              </a>
              <a href="/patient/body" className={secondary}>Describe a problem</a>
              <button type="button" onClick={() => logOut("patient")} className={logoutLink}>Log out</button>
            </>
          ) : (
            <>
              <a href="/patient/login" className={`${primary} bg-brand hover:bg-brand-deep`}>Log in</a>
              <a href="/patient/register" className={secondary}>Create an account</a>
            </>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-8 flex flex-col">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-ink text-white mb-5">
          <StethoscopeIcon className="w-6 h-6" />
        </span>
        <h3 className="font-display text-2xl font-medium text-ink">I am a healthcare professional</h3>
        <p className="text-gray-600 mt-1.5 mb-6">Review patient reports, add notes and confirm.</p>
        <div className="space-y-3 mt-auto">
          {signedIn.doctor ? (
            <>
              <a href="/doctor/dashboard" className={`${primary} bg-ink hover:bg-brand-deep`}>
                Open dashboard <ArrowIcon className="w-4 h-4" />
              </a>
              <button type="button" onClick={() => logOut("doctor")} className={logoutLink}>Log out</button>
            </>
          ) : (
            <>
              <a href="/doctor/login" className={`${primary} bg-ink hover:bg-brand-deep`}>Log in</a>
              <a href="/doctor/register" className={secondary}>Create an account</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
