// Shared swap path constants and helpers.
// Plain module (no 'use server') — safe to import anywhere.

export const SWAP_DIR = '/swapper';

export const PERSISTENT_SWAP_PREFIX = 'persistent_';
export const DYNAMIC_SWAP_PREFIX = 'dynamic_';

function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
}

/** e.g. persistent_2048mb_a3f9kz */
export function persistentSwapName(sizeMb: number) {
    return `${PERSISTENT_SWAP_PREFIX}${sizeMb}mb_${randomSuffix()}`;
}

export function persistentSwapPath(sizeMb: number) {
    return `${SWAP_DIR}/${persistentSwapName(sizeMb)}`;
}

/** e.g. dynamic_2048mb_1747123456_a3f9kz */
export function dynamicSwapPath(sizeMb: number, uniqueId: string) {
    return `${SWAP_DIR}/${DYNAMIC_SWAP_PREFIX}${sizeMb}mb_${uniqueId}`;
}
