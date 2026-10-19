import { useEffect, useState } from 'react';
import {
    Action,
    ActionPanel,
    List,
    PopToRootType,
    closeMainWindow,
    getSelectedText,
    open,
} from '@raycast/api';

const NmsWiki = () => {
    const [searchText, setSearchText] = useState('');
    const [isReadingSelection, setIsReadingSelection] = useState(true);

    // a hotkey over selected text opens the page at once; with nothing selected the search bar stays
    useEffect(() => {
        const openSelection = async () => {
            const selection = await getSelectedText()
                .then(toQuery)
                .catch(() => '');
            if (selection) {
                await open(toWikiUrl(selection));
                await closeMainWindow({
                    popToRootType: PopToRootType.Immediate,
                });
                return;
            }
            setIsReadingSelection(false);
        };
        void openSelection();
    }, []);

    const query = toQuery(searchText);

    return (
        <List
            filtering={false}
            isLoading={isReadingSelection}
            onSearchTextChange={setSearchText}
            searchBarPlaceholder='an item, a planet, a ship…'>
            {query ? (
                <List.Item
                    actions={
                        <ActionPanel>
                            <Action.OpenInBrowser
                                title='open in the wiki'
                                url={toWikiUrl(query)}
                            />
                        </ActionPanel>
                    }
                    icon='🪐'
                    subtitle='the exact page, or the search results'
                    title={query}
                />
            ) : (
                <List.EmptyView
                    description='or select a name anywhere and press the hotkey'
                    icon='🪐'
                    title='type a name'
                />
            )}
        </List>
    );
};

export default NmsWiki;

/* Helpers */

const toQuery = (text: string) => text.replace(/\s+/g, ' ').trim();

const toWikiUrl = (query: string) =>
    `https://nomanssky.miraheze.org/w/index.php?title=Special:Search&go=Go&search=${encodeURIComponent(query)}`;
