import type { Metadata } from "next";
import ResearchPageClient from "@/src/components/research/research-page-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Research ${id} — Ledger Nine`,
    description: "View the results of an autonomous investment research run.",
  };
}

export default async function ResearchResultPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="min-h-screen">
      <ResearchPageClient id={id} />
    </div>
  );
}
