import { Action, ActionPanel, Detail, Icon } from '@raycast/api';

import type { LinearIssue } from '../lib/linear';
import { toPriorityIcon, toStateIcon, toUserIcon } from '../lib/linear-ui';

export const IssueDetail = (props: IssueDetailProps) => {
    const labelList = props.issue.labels.nodes;
    const linkCount = props.issue.attachments.nodes.length;
    const cycle = props.issue.cycle;

    const labelTagJSX = labelList.map((label) => {
        return (
            <Detail.Metadata.TagList.Item
                color={label.color}
                key={label.id}
                text={label.name}
            />
        );
    });

    return (
        <Detail
            actions={
                <ActionPanel>
                    <Action.Open
                        icon={Icon.ArrowRight}
                        target={props.issue.url}
                        title='open in linear'
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
            markdown={toMarkdown(props.issue)}
            metadata={
                <Detail.Metadata>
                    <Detail.Metadata.Label
                        icon={toStateIcon(props.issue.state)}
                        text={props.issue.state.name}
                        title='status'
                    />
                    <Detail.Metadata.Label
                        icon={toPriorityIcon(props.issue.priority)}
                        text={props.issue.priorityLabel}
                        title='priority'
                    />
                    <Detail.Metadata.Label
                        icon={toUserIcon(props.issue.assignee)}
                        text={props.issue.assignee?.displayName ?? 'unassigned'}
                        title='assignee'
                    />
                    <Detail.Metadata.Label
                        icon={Icon.Gauge}
                        text={
                            props.issue.estimate === null
                                ? 'none'
                                : String(props.issue.estimate)
                        }
                        title='estimate'
                    />
                    {labelList.length === 0 ? (
                        <Detail.Metadata.Label text='none' title='labels' />
                    ) : (
                        <Detail.Metadata.TagList title='labels'>
                            {labelTagJSX}
                        </Detail.Metadata.TagList>
                    )}
                    {/* An issue with nothing linked says nothing by saying "0 links". */}
                    {linkCount > 0 && (
                        <Detail.Metadata.Label
                            icon={Icon.Link}
                            text={
                                linkCount === 1
                                    ? '1 link'
                                    : `${linkCount} links`
                            }
                            title='links'
                        />
                    )}
                    <Detail.Metadata.Separator />
                    <Detail.Metadata.Label
                        text={
                            cycle
                                ? `cycle ${cycle.number}${cycle.name ? ` · ${cycle.name}` : ''}`
                                : 'no cycle'
                        }
                        title='cycle'
                    />
                    <Detail.Metadata.Label
                        icon={Icon.Folder}
                        text={props.issue.project?.name ?? 'no project'}
                        title='project'
                    />
                </Detail.Metadata>
            }
            navigationTitle={props.issue.identifier}
        />
    );
};

/* Helpers */
const toMarkdown = (issue: LinearIssue) => {
    const body = issue.description?.trim();

    return body ? `# ${issue.title}\n\n${body}` : `# ${issue.title}`;
};

/* Types */
interface IssueDetailProps {
    issue: LinearIssue;
}
