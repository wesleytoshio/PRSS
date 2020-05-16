import { getParserHandler } from './handlers/index';
import minify from 'babel-minify';
import del from 'del';
import fse from 'fs-extra';
import path from 'path';

import { getString, configGet } from '../../common/utils';
import {
    sequential,
    sanitizeSite,
    error,
    objGet,
    sanitizeSiteItems,
    toJson
} from './utils';
import { modal } from '../components/Modal';
import { getThemeManifest } from './theme';
import { getSite, getItems, getItem } from './db';

export const bufferPathFileNames = ['index.html', 'index.js'];
export const configFileName = 'config.js';
export const itemsFileName = 'items.js';

export const build = async (
    siteUUID: string,
    onUpdate = (a?) => {},
    itemIdToLoad?,
    skipClear?
) => {
    if (!siteUUID) {
        console.error('No UUID was provided to build()');
        return false;
    }

    if (typeof siteUUID !== 'string') {
        throw new Error('build: siteUUID must be a string');
    }

    if (!skipClear) {
        /**
         * Clear Buffer
         */
        await clearBuffer();
    }

    /**
     * Adding config file
     */
    const buildBufferSiteConfigRes = await buildBufferSiteConfig(siteUUID);

    /**
     * Adding items file
     */
    const buildBufferItemsConfigRes = await buildBufferSiteItemsConfig(
        siteUUID
    );

    /**
     * Copying anything under static/public
     */
    copyPublicToBuffer();

    if (!buildBufferSiteConfigRes || !buildBufferItemsConfigRes) {
        return false;
    }

    /**
     * Buffer items
     */
    const {
        itemsToLoad,
        mainBufferItem,
        bufferItems
    } = await getFilteredBufferItems(siteUUID, itemIdToLoad);

    /**
     * Load buffer
     */
    const loadBufferRes = await loadBuffer(itemsToLoad, progress => {
        onUpdate && onUpdate(getString('building_progress', [progress]));
    });

    if (!loadBufferRes) {
        return false;
    }

    return mainBufferItem ? [mainBufferItem] : bufferItems;
};

export const copyPublicToBuffer = () => {
    const bufferDir = configGet('paths.buffer');
    const publicDir = configGet('paths.public');
    return fse.copy(publicDir, bufferDir);
};

export const getFilteredBufferItems = async (
    siteUUID: string,
    itemIdToLoad?: string
) => {
    const site = await getSite(siteUUID);
    const items = await getItems(siteUUID);
    const bufferItems = await getBufferItems(site);
    let itemsToLoad = bufferItems;
    let mainBufferItem;

    if (itemIdToLoad) {
        mainBufferItem = bufferItems.find(
            bufferItem => itemIdToLoad === bufferItem.item.uuid
        );

        const itemSlugsToLoad = mainBufferItem.path
            // left-right trim forward slash
            .replace(/^\/+|\/+$/g, '')
            .split('/');

        const rootPostItemId = items[0].uuid;
        const itemIdsToLoad = [rootPostItemId];

        itemSlugsToLoad.forEach(itemSlug => {
            const foundBufferItem = bufferItems.find(
                bufferItem => bufferItem.item.slug === itemSlug
            );

            if (foundBufferItem) {
                itemIdsToLoad.push(foundBufferItem.item.uuid);
            }
        });

        itemsToLoad = bufferItems.filter(bufferItem =>
            itemIdsToLoad.includes(bufferItem.item.uuid)
        );
    }

    return {
        mainBufferItem,
        itemsToLoad,
        bufferItems
    };
};

export const clearBuffer = (noExceptions = false) => {
    return new Promise(async resolve => {
        const bufferDir = configGet('paths.buffer');

        if (bufferDir && bufferDir.includes('buffer')) {
            if (noExceptions) {
                await del([
                    path.join(bufferDir, '*'),
                    path.join(bufferDir, '.git')
                ]);
            } else {
                await del([
                    path.join(bufferDir, '*'),
                    `!${bufferDir}`,
                    `!${path.join(bufferDir, '.git')}`
                ]);
            }
            resolve();
        } else {
            resolve();
        }
    });
};

export const loadBuffer: loadBufferType = (
    bufferItems: IBufferItem[],
    onUpdate = () => {}
) => {
    return sequential(bufferItems, buildBufferItem, 300, onUpdate, false);
};

export const buildBufferSiteConfig = async (siteUUID: string) => {
    if (typeof siteUUID !== 'string') {
        throw new Error('buildBufferSiteConfig: siteUUID must be a string');
    }

    const bufferDir = configGet('paths.buffer');
    const site = await getSite(siteUUID);

    const { code } = minify(
        `var PRSSConfig = ${JSON.stringify(sanitizeSite(site))}`
    );

    try {
        fse.outputFileSync(path.join(bufferDir, configFileName), code);
    } catch (e) {
        return false;
    }

    return true;
};

export const buildBufferSiteItemsConfig = async (siteUUID: string) => {
    const bufferDir = configGet('paths.buffer');
    const items = await getItems(siteUUID);
    const { code } = minify(
        `var PRSSItems = ${JSON.stringify(sanitizeSiteItems(items))}`
    );

    try {
        fse.outputFileSync(path.join(bufferDir, itemsFileName), code);
    } catch (e) {
        return false;
    }

    return true;
};

export const buildBufferItem = async (bufferItem: IBufferItem) => {
    const { templateId, path: itemPath, parser } = bufferItem;
    const handler = getParserHandler(parser);

    if (!handler) {
        modal.alert(
            `There was an error parsing the template for post id (${bufferItem.item.uuid})`
        );
        return false;
    }

    const bufferDir = configGet('paths.buffer');
    const itemDir = path.join(bufferDir, itemPath);
    const outputFiles = (await handler(
        templateId,
        bufferItem
    )) as handlerTypeReturn[];

    /**
     * Creating files
     */
    outputFiles.forEach(file => {
        try {
            fse.outputFileSync(
                path.join(itemDir, file.path, file.name),
                file.content
            );
        } catch (e) {
            console.error(e);
            error(e.message);
            return;
        }
    });

    return true;
};

export const getBufferItems = async (
    siteUUIDOrSite
): Promise<IBufferItem[]> => {
    const site =
        typeof siteUUIDOrSite === 'string'
            ? await getSite(siteUUIDOrSite)
            : siteUUIDOrSite;
    const structurePaths = getStructurePaths(site.structure);
    const themeManifest = await getThemeManifest(site.theme);
    const bufferItems = [];

    if (!themeManifest) {
        modal.alert('Could not find theme manifest.');
        throw 'Could not find theme manifest.';
    }

    const posts = await structureToBufferItems(structurePaths, site.uuid);

    structurePaths.forEach(item => {
        const path = item.split('/');
        let post;

        const mappedPath = path.map(postId => {
            if (!postId) {
                return '';
            }

            post = posts[postId];

            return post.slug;
        });

        /**
         * Parent Ids
         */
        const parentIds = path.slice(
            1,
            bufferItems.indexOf(path[path.length - 1])
        );

        /**
         * Aggregate data
         */
        const vars = {
            ...(site.vars || {}),
            ...(getAggregateItemPropValues(
                'item.vars',
                parentIds,
                bufferItems
            ) || {}),
            ...(post.vars || {})
        };

        const headHtml =
            (site.headHtml || '') +
            (getAggregateItemPropValues(
                'item.headHtml',
                parentIds,
                bufferItems
            ) || '') +
            (post.headHtml || '');

        const footerHtml =
            (site.footerHtml || '') +
            (getAggregateItemPropValues(
                'item.footerHtml',
                parentIds,
                bufferItems
            ) || '') +
            (post.footerHtml || '');

        const sidebarHtml =
            (site.sidebarHtml || '') +
            (getAggregateItemPropValues(
                'item.sidebarHtml',
                parentIds,
                bufferItems
            ) || '') +
            (post.sidebarHtml || '');

        /**
         * Paths
         */
        const basePostPathArr = mappedPath.slice(2); // Relative to root post
        const postPath = basePostPathArr.join('/');
        const rootPath = basePostPathArr.length
            ? basePostPathArr.map(() => '../').join('')
            : '';

        if (post) {
            bufferItems.push({
                path: '/' + postPath,
                templateId: `${site.theme}.${post.template}`,
                parser: themeManifest.parser,
                item: post as IPostItem,
                site: site as ISite, // Will be removed in bufferItem parser, replaced by PRSSConfig
                rootPath,
                headHtml,
                footerHtml,
                sidebarHtml,
                vars
            } as IBufferItem);
        }
    });

    return bufferItems;
};

export const structureToBufferItems = (structurePaths, siteUUID: string) => {
    return new Promise(async resolve => {
        const postIds = [];
        const postPromises = [];

        structurePaths.forEach(item => {
            const path = item.split('/');
            path.forEach(postId => {
                if (!postId) {
                    return;
                }

                postIds.push(postId);
                postPromises.push(getItem(siteUUID, postId));
            });
        });

        const values = await Promise.all(postPromises);
        const output = {};

        postIds.forEach((postId, index) => {
            output[postId] = values[index];
        });

        resolve(output);
    });
};

export const getAggregateItemPropValues = (
    propQuery: string,
    itemsIds: string[],
    bufferItems: IBufferItem[]
) => {
    let aggregate;

    itemsIds.forEach(itemId => {
        const bufferItem = bufferItems.find(
            bItem => bItem.item.uuid === itemId
        );
        const itemPropValue = objGet(propQuery, bufferItem) || '';

        /**
         * Filter excluded vars
         */
        if (
            propQuery === 'item.vars' &&
            Array.isArray(bufferItem.item.exclusiveVars) &&
            bufferItem.item.exclusiveVars.length
        ) {
            bufferItem.item.exclusiveVars.forEach(excludedVar => {
                !!excludedVar && delete itemPropValue[excludedVar];
            });
        }

        if (typeof itemPropValue === 'string') {
            if (!aggregate) aggregate = '';

            aggregate += objGet(propQuery, bufferItem) || '';
        } else if (Array.isArray(itemPropValue)) {
            if (!aggregate) aggregate = [];
            aggregate = [
                ...(aggregate || []),
                ...(objGet(propQuery, bufferItem) || [])
            ];
        } else if (typeof itemPropValue === 'object') {
            if (!aggregate) aggregate = {};
            aggregate = {
                ...(aggregate || {}),
                ...(objGet(propQuery, bufferItem) || {})
            };
        }
    });

    return aggregate;
};

export const getStructurePaths = (nodes, prefix = '', store = []) => {
    nodes.forEach(node => {
        const pathNode = node.key;
        const curPath = `${prefix}/${pathNode}`;

        store.push(curPath);

        if (node.children) {
            getStructurePaths(node.children, curPath, store);
        }
    });

    return store;
};

export const walkStructure = async (
    siteUUID: string,
    nodes,
    itemCb?
): Promise<any> => {
    if (!Array.isArray(nodes)) {
        console.error('walkStructure: Nodes must be an array', nodes);
        return false;
    }

    let outputNodes = [...nodes];
    const posts = await getItems(siteUUID);

    const parseNodes = obj => {
        const { key, children = [] } = obj;
        const post = posts.find(p => p.uuid === key && p.siteId === siteUUID);

        if (!post) return obj;

        const parsedNode = {
            key,
            ...(itemCb ? itemCb(post) : {}),
            children: children.map(parseNodes)
        };

        return parsedNode;
    };

    outputNodes = outputNodes.map(node => parseNodes(node));

    return outputNodes;
};

export const findInStructure = (uuid: string, nodes: IStructureItem) => {
    return toJson(nodes).includes(uuid);
};
