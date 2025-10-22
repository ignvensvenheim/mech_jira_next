export type UserLite = {
  id: string;
  name: string;
  avatar?: string | null;
} | null;

export type Issue = {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory?: string;
  priority?: string | null;
  assignee: UserLite;
  reporter: UserLite;
  created: string;
  resolved?: string | null;
  timeSpentSeconds: number;
  remainingEstimateSeconds: number;
  issueType: string;
  project: string;
  requestType?: string | null;
  requestUrl?: string | null;
  descriptionText?: string | null;
  worklogs: {
    id: string;
    author: UserLite;
    started: string;
    timeSpentSeconds: number;
  }[];
};

export type Paging = {
  nextPageToken?: string | null;
  isLast?: boolean;
  maxResults?: number | null;
};

export type ApiResponse = {
  issues: Issue[];
  paging?: Paging;
  error?: string;
  body?: string;
};

export type Filters = {
  text: string;
  statuses: string[]; // status names
  priorities: string[]; // priority names
  requestTypes: string[]; // customer request type names
  assignee: string; // '', 'me', 'unassigned', or accountId
  createdFrom: string; // yyyy-mm-dd
  createdTo: string; // yyyy-mm-dd
  orderBy: "created desc" | "created asc" | "updated desc" | "updated asc";
  maxResults: number | "all";
};
