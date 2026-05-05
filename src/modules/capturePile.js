// src/modules/capturePile.js
// Helper module to manage captured card piles for each player.

// Each pile is modeled as an array where the last element is the top card.
// Card objects should retain their suit, rank, suitRank and may include an `id`.

const ensureId = (card) => {
  if (!card) return card;
  if (!card.id) card.id = `card-${card.suitRank}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  return card;
};

export const asSelectableItems = (p1Pile, p2Pile, currentPlayer) => {
  // Return virtual selectable items representing the top card of opponent piles only (top-1 per opponent)
  const items = [];
  // player 1's pile top is selectable by player 2, and vice versa
  if (currentPlayer === 1) {
    // expose player 2's top if exists
    if (Array.isArray(p2Pile) && p2Pile.length > 0) {
      const top = p2Pile[p2Pile.length - 1];
      items.push({
        type: 'card',
        id: `pile-2-top-${top.suitRank}`,
        suit: top.suit,
        rank: top.rank,
        suitRank: top.suitRank,
        isPileTop: true,
        owner: 2,
        source: 'pile'
      });
    }
  } else {
    if (Array.isArray(p1Pile) && p1Pile.length > 0) {
      const top = p1Pile[p1Pile.length - 1];
      items.push({
        type: 'card',
        id: `pile-1-top-${top.suitRank}`,
        suit: top.suit,
        rank: top.rank,
        suitRank: top.suitRank,
        isPileTop: true,
        owner: 1,
        source: 'pile'
      });
    }
  }
  return items;
};

export const peekTop = (p1Pile, p2Pile, owner) => {
  if (owner === 1) {
    return (Array.isArray(p1Pile) && p1Pile.length > 0) ? p1Pile[p1Pile.length - 1] : null;
  }
  return (Array.isArray(p2Pile) && p2Pile.length > 0) ? p2Pile[p2Pile.length - 1] : null;
};

export const popTopFromOwner = (p1Pile, p2Pile, owner) => {
  // Return { poppedCard, newP1Pile, newP2Pile }
  const newP1 = Array.isArray(p1Pile) ? [...p1Pile] : [];
  const newP2 = Array.isArray(p2Pile) ? [...p2Pile] : [];
  let popped = null;
  if (owner === 1) {
    if (newP1.length > 0) popped = newP1.pop();
  } else {
    if (newP2.length > 0) popped = newP2.pop();
  }
  return { poppedCard: popped || null, newP1Pile: newP1, newP2Pile: newP2 };
};

export const pushCapturedToPlayer = (p1Pile, p2Pile, capturer, cards) => {
  const newP1 = Array.isArray(p1Pile) ? [...p1Pile] : [];
  const newP2 = Array.isArray(p2Pile) ? [...p2Pile] : [];
  const toAdd = (Array.isArray(cards) ? cards : (cards ? [cards] : [])).map(c => ensureId({ ...c }));
  if (capturer === 1) {
    newP1.push(...toAdd);
  } else {
    newP2.push(...toAdd);
  }
  return { newP1Pile: newP1, newP2Pile: newP2 };
};

export default {
  asSelectableItems,
  peekTop,
  popTopFromOwner,
  pushCapturedToPlayer
};
