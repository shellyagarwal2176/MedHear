"use client";
import AppShell, { PageHeader } from "../../../components/AppShell";
import ReportList from "../../../components/ReportList";

export default function DoctorDashboard() {
  return (
    <AppShell role="doctor" wide>
      <PageHeader title="Patient reports" subtitle="Review what patients signed, add notes, and confirm." />
      <ReportList mode="doctor" />
    </AppShell>
  );
}
