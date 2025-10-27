"use client";

import React from "react";
import type { NormalizedIssue } from "@/lib/jira";
import { TicketCard } from "@/components/TicketCard/TicketCard"; // adjust path if needed
import "./ticketsGrid.css";
import { Issue } from "@/lib/types";

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
