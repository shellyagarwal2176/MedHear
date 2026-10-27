"use client";
import AppShell, { PageHeader } from "../../../components/AppShell";
import ReportList from "../../../components/ReportList";

export default function ReportsPage() {
  return (
    <AppShell role="patient">
      <PageHeader title="Reports & messages" subtitle="What you sent to your care team, and their response." />
      <ReportList mode="patient" />
    </AppShell>
  );
}
