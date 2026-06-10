/**
 * Paigutab imporditud noodiplokid kujundaja lehtedele:
 * üks SVG-plokk lehe kohta, alustades pärast olemasolevat sisu.
 * Tekstialadega lehtedele automaatset importi ei tehta.
 */

import {
  composerPageHasTextBlocks,
  findNextNotationImportPageIndex,
  isPageAvailableForNotationImport,
} from '../document/composerDocumentModel';

export function composerPageHasContent(page) {
  if (!page) return false;
  if ((page.blocks?.length || 0) > 0) return true;
  if ((page.textBoxes?.length || 0) > 0) return true;
  return false;
}

export function getLastContentPageIndex(pages) {
  let last = -1;
  for (let i = 0; i < (pages?.length || 0); i += 1) {
    if (composerPageHasContent(pages[i])) last = i;
  }
  return last;
}

/**
 * @param {Array} pages — olemasolevad kujundaja lehed
 * @param {Array} blockSeeds — renderitud lehtede seemned (svgMarkup jne)
 * @param {() => object} createPage — uue lehe tehas
 * @param {(seed: object) => object} createBlock — ploki tehas
 * @returns {{ pages: Array, activePageId: string, placedBlockIds: string[], startPageIndex: number }}
 */
export function placeImportedBlocksOnPages(pages, blockSeeds, createPage, createBlock) {
  const nextPages = [...(pages || [])];
  const seeds = Array.isArray(blockSeeds) ? blockSeeds : [];
  if (seeds.length === 0) {
    return {
      pages: nextPages,
      activePageId: nextPages[0]?.id || '',
      placedBlockIds: [],
      startPageIndex: -1,
    };
  }

  let cursor = getLastContentPageIndex(nextPages) + 1;
  const placedBlockIds = [];
  let firstPlacedIndex = -1;

  seeds.forEach((seed) => {
    let targetIndex = findNextNotationImportPageIndex(nextPages, cursor);
    if (targetIndex >= nextPages.length) {
      nextPages.push(createPage());
      targetIndex = nextPages.length - 1;
    }
    if (firstPlacedIndex < 0) firstPlacedIndex = targetIndex;

    const block = createBlock(seed);
    placedBlockIds.push(block.id);
    nextPages[targetIndex] = {
      ...nextPages[targetIndex],
      blocks: [block],
    };
    cursor = targetIndex + 1;
  });

  const lastTargetIndex = cursor - 1;
  const activePageId = nextPages[lastTargetIndex]?.id || nextPages[nextPages.length - 1]?.id || '';

  return {
    pages: nextPages,
    activePageId,
    placedBlockIds,
    startPageIndex: firstPlacedIndex,
  };
}

export { composerPageHasTextBlocks, isPageAvailableForNotationImport };
