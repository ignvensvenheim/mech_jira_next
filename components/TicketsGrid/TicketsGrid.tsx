"use client";

import { TicketCard } from "@/components/TicketCard/TicketCard";
import type { NormalizedIssue } from "@/lib/jira";
import "./ticketsGrid.css";

type Props = {
  issues: NormalizedIssue[];
  onOpen: (issue: NormalizedIssue) => void;
};

export function TicketsGrid({ issues, onOpen }: Props) {
  return (
    <section className="tickets-grid">
      {issues.map((i) => (
        <TicketCard key={i.id} issue={i} onOpen={onOpen} />
      ))}
    </section>
  );
}
