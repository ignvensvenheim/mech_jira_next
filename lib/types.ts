export type UserLite = {
  id: string;
  name: string;
  avatar?: string | null;
} | null;

export type Issue = {
  mechanics: any;
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory?: string;
  priority: string;

  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  } | null;

  reporter?: {
    id: string;
    name: string;
    avatar?: string;
  } | null;

  created: string;
  updated: string;

  descriptionText?: string | null;

  timeSpentSeconds: number;

  requestType?: string | null;
  requestUrl?: string | null;
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
