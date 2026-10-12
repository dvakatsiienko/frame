import { getPreferenceValues } from '@raycast/api';

const linearApi = 'https://api.linear.app/graphql';
const searchLimit = 20;
const recentLimit = 25;
const projectIssueLimit = 50;
const projectLimit = 50;

// One shape for every issue this extension renders, so a row reads the same whether it came
// from a search, from the recent list, or from inside a project.
const issueFields = `
  id
  identifier
  title
  url
  priority
  priorityLabel
  estimate
  updatedAt
  description
  assignee { displayName avatarUrl }
  team { key name }
  project { name icon color }
  cycle { number name }
  attachments(first: 50) { nodes { id } }
  labels { nodes { id name color } }
  state { name type color }
`;

const searchQuery = `
  query FullTextSearch($term: String!, $first: Int!) {
    issues(
      first: $first
      filter: {
        or: [
          { title: { containsIgnoreCase: $term } }
          { description: { containsIgnoreCase: $term } }
          { comments: { body: { containsIgnoreCase: $term } } }
        ]
      }
    ) {
      nodes { ${issueFields} }
    }
  }
`;

const recentQuery = `
  query RecentIssues($first: Int!) {
    issues(first: $first, orderBy: updatedAt) {
      nodes { ${issueFields} }
    }
  }
`;

const projectIssueQuery = `
  query ProjectIssues($projectId: ID!, $first: Int!) {
    issues(
      first: $first
      orderBy: updatedAt
      filter: { project: { id: { eq: $projectId } } }
    ) {
      nodes { ${issueFields} }
    }
  }
`;

const projectQuery = `
  query Projects($first: Int!) {
    projects(first: $first, orderBy: updatedAt) {
      nodes {
        id
        name
        description
        icon
        color
        priority
        progress
        url
        status { name type color }
        lead { displayName avatarUrl }
        teams(first: 5) { nodes { key } }
      }
    }
  }
`;

export const searchIssues = async (term: string) => {
    const data = await request<IssueListPayload>(searchQuery, {
        first: searchLimit,
        term,
    });

    return data.issues.nodes;
};

export const readRecentIssueList = async () => {
    const data = await request<IssueListPayload>(recentQuery, {
        first: recentLimit,
    });

    return data.issues.nodes;
};

export const readProjectIssueList = async (projectId: string) => {
    const data = await request<IssueListPayload>(projectIssueQuery, {
        first: projectIssueLimit,
        projectId,
    });

    return data.issues.nodes;
};

export const readProjectList = async () => {
    const data = await request<{ projects: { nodes: LinearProject[] } }>(
        projectQuery,
        { first: projectLimit },
    );

    return data.projects.nodes;
};

// The hotkey's desktop-app door, the fleet's only linear:// — every other ticket link is https.
// The shortcut lane never sees an api url, so this is the one place the workspace slug is spelled out.
export const toIssueAppUrl = (identifier: string) =>
    `linear://linear.app/x-com/issue/${identifier}`;

/* Helpers */
const request = async <T>(
    query: string,
    variables: Record<string, unknown>,
): Promise<T> => {
    // A missing key and a rejected key both come back as 401, and "401 Unauthorized" sends
    // you looking at linear when the answer is an empty field in raycast. Checked here so
    // the two say different things.
    const apiKey =
        getPreferenceValues<LinearPreferences>().linearApiKey?.trim();

    if (!apiKey) {
        throw new Error(
            'no linear api key — set it in raycast settings → extensions → x-ray',
        );
    }

    const response = await fetch(linearApi, {
        body: JSON.stringify({ query, variables }),
        headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
        },
        method: 'POST',
    });

    if (response.status === 401) {
        throw new Error(
            'linear rejected the api key — check it in raycast settings → extensions → x-ray',
        );
    }

    if (!response.ok) {
        throw new Error(
            `Linear replied ${response.status} ${response.statusText}`,
        );
    }

    const payload = (await response.json()) as Payload<T>;
    const firstError = payload.errors?.[0];

    if (firstError) throw new Error(firstError.message);
    if (!payload.data) throw new Error('Linear returned no data');

    return payload.data;
};

/* Types */
// Declared here rather than taken from the generated `Preferences` namespace:
// raycast-env.d.ts is gitignored, so that namespace does not exist on a fresh checkout
// and ci would typecheck red. Mirrors the command preference in package.json.
interface LinearPreferences {
    linearApiKey: string;
}

export interface LinearIssue {
    assignee: LinearUser | null;
    attachments: { nodes: { id: string }[] };
    cycle: LinearCycle | null;
    description: string | null;
    estimate: number | null;
    id: string;
    identifier: string;
    labels: { nodes: LinearLabel[] };
    priority: number;
    priorityLabel: string;
    project: LinearIssueProject | null;
    state: LinearState;
    team: LinearTeam;
    title: string;
    updatedAt: string;
    url: string;
}

export interface LinearProject {
    color: string | null;
    description: string | null;
    icon: string | null;
    id: string;
    lead: LinearUser | null;
    name: string;
    priority: number;
    progress: number;
    status: LinearState;
    teams: { nodes: { key: string }[] };
    url: string;
}

export interface LinearLabel {
    color: string;
    id: string;
    name: string;
}

export interface LinearState {
    color: string;
    name: string;
    // Linear's workflow-state category — triage, backlog, unstarted, started, completed,
    // canceled. Left as a string because it arrives over the wire: a category added later
    // must fall back to a plain circle, not crash the row.
    type: string;
}

export interface LinearTeam {
    key: string;
    name: string;
}

export interface LinearUser {
    avatarUrl: string | null;
    displayName: string;
}

interface LinearCycle {
    name: string | null;
    number: number;
}

interface LinearIssueProject {
    color: string | null;
    icon: string | null;
    name: string;
}

interface IssueListPayload {
    issues: { nodes: LinearIssue[] };
}

interface Payload<T> {
    data?: T;
    errors?: { message: string }[];
}
