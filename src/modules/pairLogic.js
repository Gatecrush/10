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

  // Rule 1: All selected items must be cards.
  if (selectedItems.some(item => item.type !== 'card')) {
    return { isValid: false, message: "Can only pair with individual cards on the table." };
  }

  // Rule 2: All selected table cards must have the same rank as the played card.
  if (selectedItems.some(item => item.rank !== targetRank)) {
    return { isValid: false, message: `All selected table cards must be rank ${targetRank} to pair.` };
  }

  // Rule 3: Player must hold at least one more card of the same rank in hand (after playing this one).
  const remainingMatchingCardsInHand = playerHand.filter(card =>
    card.rank === targetRank && card.suitRank !== playedCard.suitRank // Exclude the card being played
  ).length;

  // Allow extending an existing pair on the table even if this is the last matching card in hand.
  // If player is extending an existing pair (selectedItems contains a single pair of the same rank), allow it.
  const isExtendingExistingPair = selectedItems.length === 1 && selectedItems[0].type === 'pair' && selectedItems[0].rank === targetRank;

  if (remainingMatchingCardsInHand === 0 && !isExtendingExistingPair) {
    return { isValid: false, message: `You must hold another ${targetRank} in hand to make this pair.` };
  }

  // If all checks pass
  return { isValid: true, rank: targetRank, message: `Pairing ${targetRank}s is valid.` };
};
