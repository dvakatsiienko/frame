import { Action, ActionPanel, Icon, List } from '@raycast/api';

import type { LinearIssue } from '../lib/linear';
import {
    toPriorityIcon,
    toPriorityName,
    toStateIcon,
    toUserIcon,
} from '../lib/linear-ui';
import { IssueDetail } from './IssueDetail';

export const IssueListItem = (props: IssueListItemProps) => {
    return (
        <List.Item
            accessories={toAccessoryList(props.issue)}
            actions={
                <ActionPanel>
                    <Action.Open
                        icon={Icon.ArrowRight}
                        target={props.issue.url}
                        title='open in linear'
                    />
                    <Action.Push
                        icon={Icon.Sidebar}
                        shortcut={{ key: 'd', modifiers: ['cmd', 'shift'] }}
                        target={<IssueDetail issue={props.issue} />}
                        title='show details'
                    />
                    <Action.CopyToClipboard
                        content={props.issue.identifier.toUpperCase()}
                        shortcut={{ key: '.', modifiers: ['cmd'] }}
                        title='copy id'
                    />
                    <Action.CopyToClipboard
                        content={props.issue.url}
                        title='copy issue url'
                    />
                </ActionPanel>
            }
            icon={{
                tooltip: `priority: ${toPriorityName(props.issue.priority)}`,
                value: toPriorityIcon(props.issue.priority),
            }}
            key={props.issue.id}
            keywords={toKeywordList(props.issue)}
            subtitle={props.issue.title}
            title={props.issue.identifier}
        />
    );
};

/* Helpers */
// Raycast indexes the title and these keywords and nothing else — the identifier is the
// title here, so everything a search would reasonably match on has to be listed.
const toKeywordList = (issue: LinearIssue) => {
    return [
        issue.title,
        issue.state.name,
        issue.priorityLabel,
        issue.team.key,
        issue.assignee?.displayName,
        issue.project?.name,
    ].filter((keyword) => keyword !== undefined);
};

const toAccessoryList = (issue: LinearIssue): List.Item.Accessory[] => {
    const labelList = issue.labels.nodes;

    const labelAccessoryList: List.Item.Accessory[] =
        labelList.length === 0
            ? []
            : [
                  {
                      icon: Icon.Tag,
                      text: String(labelList.length),
                      tooltip: labelList.map((label) => label.name).join(', '),
                  },
              ];

    const assigneeAccessoryList: List.Item.Accessory[] = issue.assignee
        ? [
              {
                  icon: toUserIcon(issue.assignee),
                  tooltip: `assignee: ${issue.assignee.displayName}`,
              },
          ]
        : [];

    return [
        { date: new Date(issue.updatedAt), tooltip: 'updated' },
        ...labelAccessoryList,
        ...assigneeAccessoryList,
        { icon: toStateIcon(issue.state), tooltip: issue.state.name },
    ];
};

/* Types */
interface IssueListItemProps {
    issue: LinearIssue;
}
