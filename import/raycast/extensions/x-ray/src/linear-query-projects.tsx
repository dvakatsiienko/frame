import { Action, ActionPanel, Icon, List } from '@raycast/api';
import { getProgressIcon, useCachedPromise } from '@raycast/utils';

import { IssueListItem } from './components/IssueListItem';
import {
    type LinearProject,
    readProjectIssueList,
    readProjectList,
} from './lib/linear';
import {
    toPriorityIcon,
    toPriorityName,
    toProjectIcon,
    toUserIcon,
} from './lib/linear-ui';

const LinearQueryProjects = () => {
    const { data, isLoading } = useCachedPromise(readProjectList, [], {
        failureToastOptions: { title: 'could not read the projects' },
        initialData: [],
    });

    const projectListJSX = data.map((project) => {
        return (
            <List.Item
                accessories={toAccessoryList(project)}
                actions={
                    <ActionPanel>
                        <Action.Push
                            icon={Icon.List}
                            target={<ProjectIssues project={project} />}
                            title='show issues'
                        />
                        <Action.Open
                            icon={Icon.ArrowRight}
                            shortcut={{ key: 'return', modifiers: ['cmd'] }}
                            target={project.url}
                            title='open in linear'
                        />
                        <Action.CopyToClipboard
                            content={project.url}
                            shortcut={{ key: 'c', modifiers: ['cmd'] }}
                            title='copy project url'
                        />
                    </ActionPanel>
                }
                icon={toProjectIcon(project)}
                key={project.id}
                keywords={toKeywordList(project)}
                subtitle={project.description ?? undefined}
                title={project.name}
            />
        );
    });

    const emptyViewJSX = (
        <List.EmptyView
            description='this workspace has no projects, or the api key cannot see them.'
            icon={Icon.Folder}
            title={isLoading ? 'reading projects…' : 'no projects'}
        />
    );

    return (
        <List
            isLoading={isLoading}
            searchBarPlaceholder='search by name, team, status or lead…'>
            {projectListJSX.length === 0 ? emptyViewJSX : projectListJSX}
        </List>
    );
};

const ProjectIssues = (props: ProjectIssuesProps) => {
    const { data, isLoading } = useCachedPromise(
        readProjectIssueList,
        [props.project.id],
        {
            failureToastOptions: {
                title: "could not read the project's issues",
            },
            initialData: [],
        },
    );

    const issueListJSX = data.map((issue) => {
        return <IssueListItem issue={issue} key={issue.id} />;
    });

    return (
        <List
            isLoading={isLoading}
            navigationTitle={props.project.name}
            searchBarPlaceholder={`search inside ${props.project.name}…`}>
            {issueListJSX.length === 0 ? (
                <List.EmptyView
                    icon={Icon.Tray}
                    title={
                        isLoading
                            ? 'reading issues…'
                            : 'no issues in this project'
                    }
                />
            ) : (
                <List.Section
                    subtitle={
                        issueListJSX.length === 1
                            ? '1 issue'
                            : `${issueListJSX.length} issues`
                    }
                    title='updated recently'>
                    {issueListJSX}
                </List.Section>
            )}
        </List>
    );
};

export default LinearQueryProjects;

/* Helpers */
// Raycast indexes the title and these keywords only, and the row's right-hand side is not
// indexed — so team, status and lead are listed or the placeholder promises a filter that
// hides every row.
const toKeywordList = (project: LinearProject) => {
    return [
        project.status.name,
        project.lead?.displayName,
        ...project.teams.nodes.map((team) => team.key),
    ].filter((keyword) => keyword !== undefined);
};

const toAccessoryList = (project: LinearProject): List.Item.Accessory[] => {
    const teamList = project.teams.nodes;
    const percent = Math.round(project.progress * 100);

    const teamAccessoryList: List.Item.Accessory[] =
        teamList.length === 0
            ? []
            : [
                  {
                      text:
                          teamList.length > 1
                              ? `${teamList.length} teams`
                              : (teamList[0]?.key ?? ''),
                      tooltip: teamList.map((team) => team.key).join(', '),
                  },
              ];

    // The ring carries status and progress together — its fill is the progress, its tooltip
    // names the status — so the row spends one slot where two would say the same thing.
    return [
        {
            icon: getProgressIcon(project.progress, project.color ?? undefined),
            tooltip: `${project.status.name.toLowerCase()} · ${percent}% done`,
        },
        ...teamAccessoryList,
        {
            icon: toPriorityIcon(project.priority),
            tooltip: `priority: ${toPriorityName(project.priority)}`,
        },
        {
            icon: toUserIcon(project.lead),
            tooltip: project.lead
                ? `lead: ${project.lead.displayName}`
                : 'no lead',
        },
    ];
};

/* Types */
interface ProjectIssuesProps {
    project: LinearProject;
}
