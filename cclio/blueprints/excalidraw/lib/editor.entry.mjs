// Browser entry: mounts the real <Excalidraw> headless and exposes it on window.
// route(): re-routes every elbow arrow with Excalidraw's own router (mutateElement -> updateElbowArrowPoints
// -> routeElbowArrow, which needs a live Scene).
// loadBoard / saveBoard: the app's own open (loadFromBlob) and save (serializeAsJSON) paths, for the read-back session.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Excalidraw,
    loadFromBlob,
    mutateElement,
    restoreElements,
    serializeAsJSON,
} from '@excalidraw/excalidraw';

// the editor ships its stylesheet apart; without it the page lays out unstyled
const style = document.createElement('style');
style.textContent = __EDITOR_CSS__;
document.head.append(style);

const ready = new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0';
    document.body.append(host);
    createRoot(host).render(
        createElement(Excalidraw, { excalidrawAPI: resolve }),
    );
});

window.route = async (elements) => {
    const api = await ready;
    api.updateScene({ elements: restoreElements(elements, null) });
    const scene = api.getSceneElementsIncludingDeleted();
    for (const a of scene.filter((e) => e.type === 'arrow' && e.elbowed)) {
        // fresh binding objects: the router skips an update whose bindings are the same references
        mutateElement(a, {
            points: a.points,
            startBinding: { ...a.startBinding },
            endBinding: { ...a.endBinding },
        });
    }
    return scene
        .filter((e) => e.type === 'arrow')
        .map(({ id, x, y, width, height, points }) => ({
            id,
            x,
            y,
            width,
            height,
            points,
        }));
};

window.loadBoard = async (json) => {
    const api = await ready;
    const { elements, appState, files } = await loadFromBlob(
        new Blob([json]),
        null,
        null,
    );
    api.updateScene({ elements, appState });
    api.addFiles(Object.values(files ?? {}));
};

window.saveBoard = async () => {
    const api = await ready;
    return serializeAsJSON(
        api.getSceneElementsIncludingDeleted(),
        api.getAppState(),
        api.getFiles(),
        'local',
    );
};

// scroll so a scene point sits mid-screen at zoom 1
window.focusAt = async (x, y) => {
    const api = await ready;
    const { width, height } = document.body.getBoundingClientRect();
    api.updateScene({
        appState: {
            scrollX: -x + width / 2,
            scrollY: -y + height / 2,
            zoom: { value: 1 },
        },
    });
};
