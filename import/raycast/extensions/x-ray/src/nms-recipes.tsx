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
import { useFetch } from '@raycast/utils';

const NmsRecipes = () => {
    const [searchText, setSearchText] = useState('');
    const [selection, setSelection] = useState<string>();
    const index = useFetch(INDEX_URL, {
        initialData: [],
        keepPreviousData: true,
        parseResponse: parseIndex,
    });
    const hasIndex = index.data.length > 0;

    useEffect(() => {
        void getSelectedText()
            .then(toQuery)
            .catch(() => '')
            .then(setSelection);
    }, []);

    // a hotkey over selected text opens the exact item at once; anything else lands in the search bar
    useEffect(() => {
        if (!selection || !hasIndex) return;
        const exact = findExact(index.data, selection);
        if (!exact) {
            setSearchText(selection);
            return;
        }
        void open(toRecipesUrl(exact)).then(() => {
            return closeMainWindow({ popToRootType: PopToRootType.Immediate });
        });
    }, [selection, hasIndex, index.data]);

    const query = toQuery(searchText);
    const matches = query ? findMatches(index.data, query) : [];

    const itemListJSX = matches.map((item) => {
        return (
            <List.Item
                accessories={[{ text: item.type }]}
                actions={
                    <ActionPanel>
                        <Action.OpenInBrowser
                            title='open in nms recipes'
                            url={toRecipesUrl(item)}
                        />
                        <Action.OpenInBrowser
                            title='open in the wiki'
                            url={toWikiUrl(item.name)}
                        />
                    </ActionPanel>
                }
                icon={item.icon ? `${IMAGE_BASE_URL}${item.icon}` : '📖'}
                key={item.url}
                subtitle={item.subtitle}
                title={item.name}
            />
        );
    });

    return (
        <List
            filtering={false}
            isLoading={
                selection === undefined || (index.isLoading && !hasIndex)
            }
            onSearchTextChange={setSearchText}
            searchBarPlaceholder='an item, a recipe, a building…'
            searchText={searchText}>
            {query ? (
                itemListJSX
            ) : (
                <List.EmptyView
                    description='or select a name anywhere and press the hotkey'
                    icon='🍳'
                    title='type a name'
                />
            )}
        </List>
    );
};

export default NmsRecipes;

/* Helpers */

const SITE_URL = 'https://nomansskyrecipes.com';
const INDEX_URL = `${SITE_URL}/search.json`;
const IMAGE_BASE_URL = `${SITE_URL}/images/items/`;
const MATCH_LIMIT = 40;

const parseIndex = async (response: Response) => {
    const json = (await response.json()) as SearchIndex;
    return json.body;
};

const toQuery = (text: string) => text.replace(/\s+/g, ' ').trim();

const findExact = (items: RecipeItem[], query: string) => {
    const name = query.toLowerCase();
    return items.find((item) => item.name.toLowerCase() === name);
};

// exact names first, then names that start with the query, then the rest
const findMatches = (items: RecipeItem[], query: string) => {
    const needle = query.toLowerCase();
    const rank = (item: RecipeItem) => {
        const name = item.name.toLowerCase();
        if (name === needle) return 0;
        if (name.startsWith(needle)) return 1;
        return 2;
    };
    return items
        .filter((item) => item.name.toLowerCase().includes(needle))
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, MATCH_LIMIT);
};

const toRecipesUrl = (item: RecipeItem) => `${SITE_URL}${item.url}/`;

const toWikiUrl = (query: string) =>
    `https://nomanssky.miraheze.org/w/index.php?title=Special:Search&go=Go&search=${encodeURIComponent(query)}`;

/* Types */

interface SearchIndex {
    body: RecipeItem[];
}

interface RecipeItem {
    icon?: string;
    id: string;
    name: string;
    subtitle?: string;
    type: string;
    url: string;
}
