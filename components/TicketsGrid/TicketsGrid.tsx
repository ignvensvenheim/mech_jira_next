"use client";

import { TicketCard } from "@/components/TicketCard/TicketCard";
import type { NormalizedIssue } from "@/lib/jira";
import "./ticketsGrid.css";

type Props = {
  issues: NormalizedIssue[];
  onOpen: (issue: NormalizedIssue) => void;
  view?: "grid" | "list";
};

export function TicketsGrid({ issues, onOpen, view = "grid" }: Props) {
  return (
    <section
      className={`tickets-grid ${
        view === "list" ? "tickets-grid--list" : "tickets-grid--grid"
      }`}
    >
      {issues.map((i) => (
        <TicketCard key={i.id} issue={i} onOpen={onOpen} view={view} />
      ))}
    </section>
  );
}
