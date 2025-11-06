"use client";

import React, { createContext, useContext, useState } from "react";
import type { NormalizedIssue } from "@/lib/jira";

type IssuesContextType = {
  issues: NormalizedIssue[] | any;
  setIssues: React.Dispatch<React.SetStateAction<NormalizedIssue[]>> | any;
};

const IssuesContext = createContext<IssuesContextType | undefined>(undefined);

export function IssuesProvider({ children }: { children: React.ReactNode }) {
  const [issues, setIssues] = useState<NormalizedIssue[]>([]);
  return (
    <IssuesContext.Provider value={{ issues, setIssues }}>
      {children}
    </IssuesContext.Provider>
  );
}

export function useIssues() {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error("useIssues must be used inside IssuesProvider");
  return ctx;
}
