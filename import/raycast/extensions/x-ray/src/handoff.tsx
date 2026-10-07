import {
    Action,
    ActionPanel,
    Alert,
    Color,
    Detail,
    Icon,
    List,
    Toast,
    confirmAlert,
    showToast,
    useNavigation,
} from '@raycast/api';
import { useCachedPromise, usePromise } from '@raycast/utils';

import {
    type Handoff,
    deleteHandoff,
    readHandoffBody,
    readHandoffList,
    toCclioBootLine,
    toIngestLine,
} from './lib/handoff';

const HandoffShelf = () => {
    const { data, isLoading, revalidate } = useCachedPromise(
        readHandoffList,
        [],
        {
            failureToastOptions: {
                title: 'could not read the handoff shelf',
            },
            initialData: [],
        },
    );

    const handoffListJSX = data.map((handoff) => {
        return (
            <List.Item
                accessories={toAccessoryList(handoff)}
                actions={
                    <ActionPanel>
                        <Action.Push
                            icon={Icon.Book}
                            target={
                                <HandoffDetail
                                    handoff={handoff}
                                    onDeleted={revalidate}
                                />
                            }
                            title='read handoff'
                        />
                        <HandoffShelfActions
                            handoff={handoff}
                            onDeleted={revalidate}
                        />
                    </ActionPanel>
                }
                icon={scrollEmoji}
                key={handoff.fileName}
                keywords={toKeywordList(handoff)}
                subtitle={handoff.isShared ? 'shared' : undefined}
                title={handoff.topic}
            />
        );
    });

    const emptyViewJSX = (
        <List.EmptyView
            description='nothing pending — a /handoff is what writes one.'
            icon={Icon.Tray}
            title='the shelf is empty'
        />
    );

    return (
        <List
            isLoading={isLoading}
            searchBarPlaceholder='search by topic, lane or author…'>
            {handoffListJSX.length === 0 ? emptyViewJSX : handoffListJSX}
        </List>
    );
};

const HandoffDetail = (props: HandoffDetailProps) => {
    const { pop } = useNavigation();
    const { data, isLoading } = usePromise(
        readHandoffBody,
        [props.handoff.path],
        {
            failureToastOptions: { title: 'could not read the transcript' },
        },
    );

    // This view is reading the file that just went away, so it leaves with it.
    const handleDeleted = () => {
        pop();
        props.onDeleted();
    };

    return (
        <Detail
            actions={
                <ActionPanel>
                    <HandoffShelfActions
                        handoff={props.handoff}
                        onDeleted={handleDeleted}
                    />
                </ActionPanel>
            }
            isLoading={isLoading}
            markdown={data}
            navigationTitle={props.handoff.topic}
        />
    );
};

// Four sections, because the verbs are four: paste into the session in front of you, copy
// for somewhere else, open the file, throw it away. Within the first two the cclio line
// leads — it is the one that boots a coordinator, and the plain ingest line is the fallback
// for a session already booted. Delete sits alone at the bottom under macos's own ⌘⌫.
const HandoffShelfActions = (props: HandoffShelfActionsProps) => {
    return (
        <>
            <ActionPanel.Section>
                <Action.Paste
                    content={toCclioBootLine(props.handoff)}
                    icon={Icon.Terminal}
                    shortcut={{ key: 'return', modifiers: ['cmd'] }}
                    title='paste cclio boot line'
                />
                <Action.Paste
                    content={toIngestLine(props.handoff)}
                    icon={Icon.Terminal}
                    shortcut={{ key: 'return', modifiers: ['cmd', 'shift'] }}
                    title='paste ingest line'
                />
            </ActionPanel.Section>
            <ActionPanel.Section>
                <Action.CopyToClipboard
                    content={toCclioBootLine(props.handoff)}
                    icon={Icon.Clipboard}
                    shortcut={{ key: 'c', modifiers: ['cmd'] }}
                    title='copy cclio boot line'
                />
                <Action.CopyToClipboard
                    content={toIngestLine(props.handoff)}
                    icon={Icon.Clipboard}
                    shortcut={{ key: 'c', modifiers: ['cmd', 'shift'] }}
                    title='copy ingest line'
                />
                <Action.CopyToClipboard
                    content={props.handoff.path}
                    icon={Icon.Finder}
                    shortcut={{ key: '.', modifiers: ['cmd'] }}
                    title='copy file path'
                />
            </ActionPanel.Section>
            <ActionPanel.Section>
                <Action.Open
                    application='Cursor'
                    icon={Icon.Code}
                    shortcut={{ key: 'return', modifiers: ['opt'] }}
                    target={props.handoff.path}
                    title='open in cursor'
                />
            </ActionPanel.Section>
            <ActionPanel.Section>
                <DeleteHandoffAction
                    handoff={props.handoff}
                    onDeleted={props.onDeleted}
                />
            </ActionPanel.Section>
        </>
    );
};

// The shelf is gitignored, so a deleted CST survives only in the macos trash, where x moves it;
// the confirm is the undo that does not need finder. It goes through `x handoff delete` rather
// than unlinking the path it already holds: a non-zero exit is what proves the file is gone,
// and a frontend that deletes behind the store's back is a second set of rules to keep true.
const DeleteHandoffAction = (props: DeleteHandoffActionProps) => {
    const handleDelete = async () => {
        const isConfirmed = await confirmAlert({
            icon: Icon.Trash,
            message: toDeleteWarning(props.handoff),
            primaryAction: {
                style: Alert.ActionStyle.Destructive,
                title: 'delete',
            },
            title: `delete «${props.handoff.topic}»?`,
        });
        if (!isConfirmed) return;

        const toast = await showToast(
            Toast.Style.Animated,
            `deleting ${props.handoff.topic}`,
        );

        try {
            await deleteHandoff(props.handoff);
            toast.style = Toast.Style.Success;
            toast.title = `deleted ${props.handoff.topic}`;
            props.onDeleted();
        } catch (error) {
            toast.style = Toast.Style.Failure;
            toast.title = 'nothing was deleted';
            toast.message = (error as Error).message;
        }
    };

    return (
        <Action
            icon={Icon.Trash}
            onAction={handleDelete}
            shortcut={{ key: 'backspace', modifiers: ['cmd'] }}
            style={Action.Style.Destructive}
            title='delete handoff'
        />
    );
};

export default HandoffShelf;

/* Helpers */
// The command icon is this same scroll rendered to a png — the emoji is the shelf's mark on
// both surfaces. A foreign handoff is already called out by its Lock accessory.
const scrollEmoji = '📜';

// The row's orange "for cw" accessory is the standing warning, and the alert covers it —
// so an audience that is not ours is restated here, where the keypress actually happens.
const toDeleteWarning = (handoff: Handoff) => {
    const owner = handoff.isForeign
        ? `\n\naddressed to ${handoff.audience} — deleting it takes the thread away from them.`
        : '';

    return `${handoff.fileName}${owner}`;
};

// Raycast's own filtering reads the title and these keywords, and nothing else — lane
// and author live in accessories, which are not indexed, so the search bar would
// otherwise promise a filter that hides every row.
const toKeywordList = (handoff: Handoff) => {
    return [
        handoff.lane,
        handoff.author,
        handoff.audience,
        handoff.fileName,
    ].filter((keyword) => keyword !== null);
};

// The four lanes are a closed set in CST-SPEC, so the colours are named rather than derived:
// a lane always reads the same colour, and one the spec never defined falls back to plain
// text instead of being given a meaning it does not have.
const laneColor: Record<string, Color> = {
    code: Color.Blue,
    design: Color.Magenta,
    pm: Color.Purple,
    research: Color.Yellow,
};

const toAccessoryList = (handoff: Handoff): List.Item.Accessory[] => {
    const authorAccessory: List.Item.Accessory[] = handoff.author
        ? [
              {
                  text: {
                      color: Color.SecondaryText,
                      value: `by ${handoff.author}`,
                  },
                  tooltip: 'author',
              },
          ]
        : [];

    // Orange is the one warning in the row: this handoff is addressed to someone else and
    // ingesting it takes it away from them. It replaces the lock icon, which said the same
    // thing without naming who.
    const audienceAccessory: List.Item.Accessory[] = [
        {
            text: {
                color: handoff.isForeign ? Color.Orange : Color.Green,
                value: `for ${handoff.audience}`,
            },
            tooltip: handoff.isForeign
                ? `addressed to ${handoff.audience} — leave it`
                : 'audience',
        },
    ];

    const laneAccessory: List.Item.Accessory[] = handoff.lane
        ? [
              {
                  tag: {
                      color: laneColor[handoff.lane] ?? Color.SecondaryText,
                      value: handoff.lane,
                  },
                  tooltip: 'lane',
              },
          ]
        : [];

    return [
        ...authorAccessory,
        ...audienceAccessory,
        ...laneAccessory,
        { text: handoff.age, tooltip: 'age' },
    ];
};

/* Types */
interface HandoffDetailProps {
    handoff: Handoff;
    onDeleted: () => void;
}

interface HandoffShelfActionsProps {
    handoff: Handoff;
    onDeleted: () => void;
}

interface DeleteHandoffActionProps {
    handoff: Handoff;
    onDeleted: () => void;
}
