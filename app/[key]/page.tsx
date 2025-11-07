"use client";

import { DetailedSingleTicket } from "@/components/DetailedSingleTicket/DetailedSingleTicket";

export default function Page() {
  return (
    <DetailedSingleTicket
      issue={{
        id: "",
        key: "",
        summary: "",
        status: "",
        statusCategory: undefined,
        priority: undefined,
        assignee: null,
        reporter: null,
        created: "",
        updated: "",
        resolved: undefined,
        timeSpentSeconds: 0,
        remainingEstimateSeconds: 0,
        issueType: "",
        project: "",
        requestType: undefined,
        requestUrl: undefined,
        descriptionText: undefined,
        mechanics: undefined,
        mechanicsRaw: undefined,
        worklogs: [],
        attachment: [],
      }}
    />
  );
}
