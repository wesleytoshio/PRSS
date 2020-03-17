import path from 'path';

import { store } from './Store';
import strings from './strings.json';

export const set = (...params) =>
    typeof params[0] === 'object'
        ? store.set(params[0])
        : store.set(params[0], params[1]);
export const get = (param: any) => store.get(param);
export const rem = (param: any) => store.delete(param);

export const globalRequire = __non_webpack_require__;

export const vendorModulePath = pathName => {
    const vendorDir = get('paths.vendor');
    const vendorModulesDir = path.join(vendorDir, 'node_modules', pathName);
    return vendorModulesDir;
};

export const getString = (id: string, replaceWith: string[] = []) => {
    let str = strings[id] || '';

    replaceWith.forEach(replacement => {
        str = str.replace('%s', replacement);
    });

    return str;
};

export const toBase64 = file =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
