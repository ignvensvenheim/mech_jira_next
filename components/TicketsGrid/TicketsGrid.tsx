"use client";

import { TicketCard } from "@/components/TicketCard/TicketCard";
import type { NormalizedIssue } from "@/lib/jira";
import "./ticketsGrid.css";

type Props = {
  issues: NormalizedIssue[];
};

export function TicketsGrid({ issues }: Props) {
  return (
    <section className="tickets-grid">
      {issues.map((i) => (
        <TicketCard key={i.id} issue={i} />
      ))}
    </section>
  );
}
