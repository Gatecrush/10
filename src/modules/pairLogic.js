// src/modules/pairLogic.js
import { getValue } from './deck'; // May not be needed if only using rank

/**
 * Validates if a pairing action is possible.
 * @param {object} playedCard - The card being played from the hand.
 * @param {array} selectedItems - The items selected from the table (must be cards).
 * @param {array} playerHand - The current player's hand.
 * @returns {object} - { isValid: boolean, rank: string | null, message: string }
 */
export const validatePair = (playedCard, selectedItems, playerHand) => {
  if (!playedCard || !selectedItems || selectedItems.length === 0) {
    return { isValid: false, message: "Select a card from hand and card(s) from table to pair." };
  }

  const targetRank = playedCard.rank;

  const selectedPair = selectedItems.length === 1 && selectedItems[0].type === 'pair';
  const selectedCardsOnly = selectedItems.every(item => item.type === 'card');

  // Rule 1: Pairing can be either:
  //  - creating/extending a pair with individual cards, or
  //  - extending an existing pair with one played card.
  if (!selectedCardsOnly && !selectedPair) {
    return { isValid: false, message: "Can only pair with individual cards or extend an existing pair." };
  }

  // Rule 2: All selected table items must match the rank of the played card.
  if (selectedItems.some(item => item.rank !== targetRank)) {
    return { isValid: false, message: `All selected items must be rank ${targetRank} to pair.` };
  }

  // Rule 3: Player must hold at least one more card of the same rank in hand after playing this one,
  // unless they are extending an existing pair on the table.
  const remainingMatchingCardsInHand = playerHand.filter(card =>
    card.rank === targetRank && card.suitRank !== playedCard.suitRank // Exclude the card being played
  ).length;

  const isExtendingExistingPair = selectedPair && selectedItems[0].rank === targetRank;

  if (remainingMatchingCardsInHand === 0 && !isExtendingExistingPair) {
    return { isValid: false, message: `You must hold another ${targetRank} in hand to make this pair.` };
  }

  // If all checks pass
  return { isValid: true, rank: targetRank, message: `Pairing ${targetRank}s is valid.` };
};
