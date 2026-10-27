// Patients and healthcare professionals each get their own login slot, so a patient tab and a doctor
// tab can be open in the same browser without one using the other's token.
export type Role = "patient" | "doctor";

const key = (role: Role) => `medhear_token_${role}`;

export const getToken = (role: Role) => localStorage.getItem(key(role));
export const setToken = (role: Role, token: string) => localStorage.setItem(key(role), token);
export const clearToken = (role: Role) => localStorage.removeItem(key(role));

// Pages under /doctor use the doctor login; everything else uses the patient's.
export const pageRole = (): Role => (window.location.pathname.startsWith("/doctor") ? "doctor" : "patient");
