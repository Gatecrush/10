// src/modules/turns.js
import { validateBuild } from './buildLogic';
import { validatePair } from './pairLogic';
import { getValue, captureValues, combinationValue } from './deck';
import { CaptureValidator, areItemSetsEqual } from './captureLogic';
import { asSelectableItems, popTopFromOwner, pushCapturedToPlayer } from './capturePile';

// Simple ID generator
let nextBuildId = 0;
const generateBuildId = () => `build-${nextBuildId++}`;
let nextPairId = 0;
const generatePairId = () => `pair-${nextPairId++}`;
// Toggle to true to enable verbose capture validation logging
const CAPTURE_DEBUG = true;

/**
 * Handles the build action, using the validated summing/cascading groups.
 */
export const handleBuild = (playedCard, selectedItems, currentPlayer, tableItems, playerHand, player1Pile, player2Pile) => {
        // When validating builds, include pile-top virtual items so builds can use opponent pile tops
        const augmentedTableForValidation = [...tableItems, ...asSelectableItems(player1Pile, player2Pile, currentPlayer)];
        const validation = validateBuild(playedCard, selectedItems, playerHand, augmentedTableForValidation, currentPlayer);
    if (!validation.isValid) {
            return { success: false, newTableItems: tableItems, message: validation.message, newP1Pile: player1Pile, newP2Pile: player2Pile };
    }

    const { buildValue, isModification, targetBuild, summingItems, cascadingItems, isMultiBuildCreation, multiBuildBuilds, isMultiBuildIncrease } = validation;
    let newTableItems = [...tableItems];
    let newBuildObject;

        // Track pile changes (if any selectedItems are pile-tops)
        let currentP1Pile = Array.isArray(player1Pile) ? [...player1Pile] : [];
        let currentP2Pile = Array.isArray(player2Pile) ? [...player2Pile] : [];
        const poppedFromPiles = [];
        // Pop any selected pile-top items before mutating table
        (selectedItems || []).forEach(item => {
            if (item && item.isPileTop && item.owner) {
                const { poppedCard, newP1Pile, newP2Pile } = popTopFromOwner(currentP1Pile, currentP2Pile, item.owner);
                currentP1Pile = newP1Pile;
                currentP2Pile = newP2Pile;
                if (poppedCard) poppedFromPiles.push(poppedCard);
            }
        });

        if (isMultiBuildCreation) {
        newBuildObject = {
            type: 'build',
            id: `multibuild-${Date.now()}`,
            builds: multiBuildBuilds,
            value: buildValue,
            controller: currentPlayer,
            isCompound: true,
            isCall: false
        };
        // Ensure selectedItems have IDs before filtering
        const selectedIds = selectedItems.filter(item => item && item.id).map(item => item.id);
        newTableItems = newTableItems.filter(
            item => item && item.id && !selectedIds.includes(item.id)
        );
        newTableItems.push(newBuildObject);
        return {
            success: true,
            newTableItems,
            newP1Pile: currentP1Pile,
            newP2Pile: currentP2Pile,
            message: `Player ${currentPlayer} created Multi-Build of ${buildValue}.`
        };
    } else if (isMultiBuildIncrease) {
        const newBuild = {
            cards: [playedCard, ...summingItems],
            value: buildValue
        };
        newTableItems = newTableItems.map(item => {
            if (item && item.id === targetBuild.id) {
                // Ensure targetBuild.builds exists and is an array
                const existingBuilds = Array.isArray(targetBuild.builds) ? targetBuild.builds : [];
                return {
                    ...item,
                    builds: [...existingBuilds, newBuild],
                    controller: currentPlayer,
                    isCompound: true, // Mark as compound after increasing
                    isCall: false
                };
            }
            return item;
        });
        // Ensure summingItems have IDs before filtering
        const summingIds = summingItems.filter(item => item && item.id).map(item => item.id);
        newTableItems = newTableItems.filter(
            item => item && item.id && !summingIds.includes(item.id)
        );
        return {
            success: true,
            newTableItems,
            newP1Pile: currentP1Pile,
            newP2Pile: currentP2Pile,
            message: `Player ${currentPlayer} increased Multi-Build of ${buildValue}.`
        };
    } else {
        // --- Single Build Creation/Modification ---
        let finalBuildCards = [playedCard];

        // Add cards from summing items (cards or builds)
        summingItems.forEach(item => {
            if (!item) return;
            if (item.type === 'card') finalBuildCards.push(item);
            else if (item.type === 'build' && Array.isArray(item.cards)) finalBuildCards.push(...item.cards);
        });

        // Add cards from cascading items (cards or builds)
        cascadingItems.forEach(item => {
             if (!item) return;
            if (item.type === 'card') finalBuildCards.push(item);
            else if (item.type === 'build' && Array.isArray(item.cards)) finalBuildCards.push(...item.cards);
        });

        // Add cards from the build being modified, excluding those already added
        if (isModification && targetBuild && Array.isArray(targetBuild.cards)) {
            const addedCardSuitRanks = new Set(finalBuildCards.map(c => c.suitRank));
            targetBuild.cards.forEach(card => {
                if (card && card.suitRank && !addedCardSuitRanks.has(card.suitRank)) {
                    finalBuildCards.push(card);
                }
            });
        }

        // Include any cards popped from piles into the final build cards
        poppedFromPiles.forEach(pc => { if (pc) finalBuildCards.push(pc); });

        // Ensure no duplicate cards in the final build
        const uniqueBuildCards = [];
        const seenSuitRanks = new Set();
        finalBuildCards.forEach(card => {
            if (card && card.suitRank && !seenSuitRanks.has(card.suitRank)) {
                uniqueBuildCards.push(card);
                seenSuitRanks.add(card.suitRank);
            }
        });


        newBuildObject = {
            type: 'build',
            id: (isModification && targetBuild) ? targetBuild.id : generateBuildId(), // Reuse ID if modifying
            value: buildValue,
            cards: uniqueBuildCards, // Use unique cards
            controller: currentPlayer,
            isCompound: false, // Single builds are not compound
            isCall: (validation && validation.isCall) ? true : false
        };

        // Remove selected items and the target build (if modifying) from the table
        const itemsToRemoveIds = new Set(selectedItems.filter(item => item && item.id).map(item => item.id));
        if (isModification && targetBuild && targetBuild.id) {
            itemsToRemoveIds.add(targetBuild.id);
        }

        newTableItems = newTableItems.filter(
            item => item && item.id && !itemsToRemoveIds.has(item.id)
        );
        newTableItems.push(newBuildObject); // Add the new/modified build

        // Return updated piles as part of the result so caller can update state
        return {
            success: true,
            newTableItems,
            newP1Pile: currentP1Pile,
            newP2Pile: currentP2Pile,
            message: `Player ${currentPlayer} ${isModification ? 'modified' : 'built'} ${buildValue}.`
        };
    }
};

/**
 * Handles the pairing action.
 */
export const handlePair = (playedCard, selectedItems, currentPlayer, tableItems, playerHand) => {
    // Basic validation first
    if (!playedCard || !selectedItems || !Array.isArray(selectedItems)) {
        return { success: false, newTableItems: tableItems, message: "Invalid input for pairing." };
    }
     // Ensure all selected items are valid objects with IDs
    if (!selectedItems.every(item => item && item.id)) {
      console.error("Pairing Error: Some selected items are invalid or missing IDs.");
      return { isValid: false, message: "Internal error: Invalid items selected for pair." };
    }

    const validation = validatePair(playedCard, selectedItems, playerHand);
    if (!validation.isValid) {
        return { success: false, newTableItems: tableItems, message: validation.message };
    }
    const { rank } = validation;

    let updatedTableItems = [...tableItems];
    let newPairObject;

    // Check if extending an existing pair (only one item selected, and it's a pair of the correct rank)
    const existingPair = selectedItems.length === 1 && selectedItems[0].type === 'pair' && selectedItems[0].rank === rank ? selectedItems[0] : null;

    if (existingPair) {
        // Ensure existingPair is valid before spreading
        if (!existingPair || !Array.isArray(existingPair.cards)) {
             console.error("Pairing Error: Invalid existing pair object.");
             return { success: false, newTableItems: tableItems, message: "Internal error: Invalid existing pair." };
        }
        // Add the played card to the existing pair
        newPairObject = {
            ...existingPair,
            cards: [...existingPair.cards, playedCard],
            controller: currentPlayer // Update controller
        };
        // Replace the old pair with the updated one
        updatedTableItems = tableItems.map(item => (item && item.id === existingPair.id ? newPairObject : item));
    } else {
        // Creating a new pair
        // Ensure selected items for pairing are only cards
        if (selectedItems.some(item => item.type !== 'card')) {
             return { success: false, newTableItems: tableItems, message: "Can only pair with cards." };
        }
        const itemsToRemoveIds = selectedItems.map(item => item.id);
        const combinedCards = [playedCard, ...selectedItems];
        newPairObject = {
            type: 'pair',
            id: generatePairId(),
            rank: rank,
            cards: combinedCards,
            controller: currentPlayer
        };
        // Filter out removed items and ensure table items are valid
        updatedTableItems = tableItems.filter(item => item && item.id && !itemsToRemoveIds.includes(item.id));
        updatedTableItems.push(newPairObject);
    }

    return {
        success: true,
        newTableItems: updatedTableItems,
        message: `Player ${currentPlayer} paired ${rank}s.`
    };
};


/**
 * Validates if the selected items constitute a valid capture given the played card.
 * Checks if every selected item is part of *at least one* valid capture set
 * generated by CaptureValidator.getValidCaptures.
 */
const isValidMultiCaptureSelection = (playedCard, selectedItems, tableItems) => {
    // Basic checks
    if (!playedCard || !selectedItems || !Array.isArray(selectedItems)) return false;
    if (selectedItems.length === 0) return true; // Empty selection is valid (captures nothing)

    // Ensure all items involved have IDs for reliable comparison
    if (!selectedItems.every(item => item && item.id)) {
        console.error("isValidMultiCaptureSelection Error: Some selected items are missing IDs");
        return false;
    }
    const selectedItemIds = new Set(selectedItems.map(item => item.id));

    // Generate all theoretically possible capture sets with the played card
    const allValidOptions = CaptureValidator.getValidCaptures(playedCard, tableItems);
    if (CAPTURE_DEBUG) {
        try {
            console.debug('CAPTURE DEBUG: playedCard=', playedCard);
            console.debug('CAPTURE DEBUG: selectedItemIds=', Array.from(selectedItemIds));
            console.debug('CAPTURE DEBUG: allValidOptions=', allValidOptions.map(opt => opt.map(i => ({ id: i.id, type: i.type, rank: i.rank, value: i.value }))) );
        } catch (e) {
            console.debug('CAPTURE DEBUG: error serializing options', e);
        }
    }
    if (!allValidOptions || !Array.isArray(allValidOptions)) {
         console.error("isValidMultiCaptureSelection Error: Invalid result from getValidCaptures");
         return false;
    }

    const coveredItemIds = new Set();

    // Iterate through all possible valid capture sets
    for (const option of allValidOptions) {
        // Ensure option is valid and its items have IDs
        if (!option || !Array.isArray(option) || !option.every(item => item && item.id)) {
            console.warn("isValidMultiCaptureSelection: Skipping invalid option from getValidCaptures", option);
            continue;
        }
        const optionIds = option.map(item => item.id);

        // Check if this valid capture set is fully contained within the user's selection
        const isOptionSelected = optionIds.every(id => selectedItemIds.has(id));

        // If this valid set *is* part of the user's selection, mark its items as 'covered'
        if (isOptionSelected) {
            optionIds.forEach(id => coveredItemIds.add(id));
        }
    }

    // The selection is valid IF AND ONLY IF:
    // 1. Every item the user selected is covered by at least one valid capture set.
    // 2. The set of covered items is exactly the same as the set of selected items (no extra items covered).
    return coveredItemIds.size === selectedItemIds.size &&
           [...selectedItemIds].every(id => coveredItemIds.has(id));
};


/**
 * Handles the capture action, allowing for multiple independent captures.
 */
export const handleCapture = (playedCard, selectedItems, currentPlayer,
    player1Score, player2Score, tableItems, lastCapturer, player1Pile, player2Pile) => {

    // Basic validation
    if (!playedCard || !selectedItems || !Array.isArray(selectedItems)) {
         return { success: false, message: "Invalid input for capture.", newP1Score: player1Score, newP2Score: player2Score, newTableItems: tableItems, newLastCapturer: lastCapturer, capturedCards: [] };
    }
    // Ensure selected items have IDs
    if (!selectedItems.every(item => item && item.id)) {
        console.error("Capture Error: Some selected items are missing IDs.");
        return { success: false, message: "Internal error: Invalid items selected.", newP1Score: player1Score, newP2Score: player2Score, newTableItems: tableItems, newLastCapturer: lastCapturer, capturedCards: [] };
    }

    // Include pile-top virtual items in validation
    const augmentedTable = [...tableItems, ...asSelectableItems(player1Pile, player2Pile, currentPlayer)];
    // Use the updated validation logic
    const isSelectionValid = isValidMultiCaptureSelection(playedCard, selectedItems, augmentedTable);

    if (!isSelectionValid) {
        return {
            success: false,
            newP1Score: player1Score,
            newP2Score: player2Score,
            newTableItems: tableItems,
            newLastCapturer: lastCapturer,
            message: "Invalid capture selection.",
            capturedCards: []
        };
    }

    // Check ownership ONLY for selected Builds and Pairs
    // Note: per standard Casino rules, opponent-built combinations can be captured
    // if the played card (and selected table items) form a valid capture. Do not block
    // captures based on `controller` here.

    // --- Capture is Valid ---
    // Mark the played card as the capturing/top card so we can ensure it becomes the top of the pile
    const capturingCard = { ...playedCard, __isCapturing: true };
    let capturedCards = [capturingCard]; // Start with the played card (marked)
    let currentP1Score = player1Score;
    let currentP2Score = player2Score;

    // We'll also update piles as we pop any selected pile-top items
    let currentP1Pile = Array.isArray(player1Pile) ? [...player1Pile] : [];
    let currentP2Pile = Array.isArray(player2Pile) ? [...player2Pile] : [];

    // Add cards from the selected items. If a selected item is a pile-top, pop it from the owner's pile.
    for (const item of selectedItems) {
        if (!item) { console.error("Undefined item in selectedItems during capture processing"); continue; }
        if (item.isPileTop && item.owner) {
            // Pop the real card from the owner's pile
            const { poppedCard, newP1Pile, newP2Pile } = popTopFromOwner(currentP1Pile, currentP2Pile, item.owner);
            currentP1Pile = newP1Pile;
            currentP2Pile = newP2Pile;
            if (poppedCard) capturedCards.push(poppedCard);
        } else if (item.type === 'card') {
            capturedCards.push(item);
        } else if ((item.type === 'build' || item.type === 'pair') && Array.isArray(item.cards)) {
            // Add all cards contained within the build/pair
            capturedCards.push(...item.cards);
        } else if (item.type === 'build' || item.type === 'pair') {
             console.error(`${item.type} item missing cards array:`, item);
        }
    }

    // Ensure captured cards are unique (important if a card was part of multiple captures)
    const uniqueCapturedCards = [];
    const seenCaptureSuitRanks = new Set();
    capturedCards.forEach(card => {
        if (card && card.suitRank && !seenCaptureSuitRanks.has(card.suitRank)) {
            uniqueCapturedCards.push(card);
            seenCaptureSuitRanks.add(card.suitRank);
        }
    });

    // Ensure the capturing card from hand is placed last so it becomes the top of the captured pile
    const capIndex = uniqueCapturedCards.findIndex(c => c && c.__isCapturing);
    if (capIndex >= 0) {
        const [capCard] = uniqueCapturedCards.splice(capIndex, 1);
        uniqueCapturedCards.push(capCard);
    }


    // Remove captured items from the table (pile-top items removed via pop above)
    const selectedItemIds = selectedItems.map(item => item && item.id).filter(Boolean);
    // Filter out null/undefined items before checking IDs
    const validTableItems = tableItems.filter(item => item && item.id);
    const newTableItems = validTableItems.filter(item => !selectedItemIds.includes(item.id));

    // Check for sweep
    let sweepMessage = "";
    // Sweep occurs if the table is cleared AND the table wasn't empty before the capture
    if (newTableItems.length === 0 && validTableItems.length > 0) {
        if (currentPlayer === 1) {
            currentP1Score += 1; // Award sweep point immediately
        } else {
            currentP2Score += 1; // Award sweep point immediately
        }
        sweepMessage = " Sweep!";
    }

    // --- Immediate per-card scoring (Aces, Big Casino D10, Little Casino S2) ---
    // Award these points at capture time so running scores update during play.
    if (uniqueCapturedCards.length > 0) {
        let pointsForCapture = 0;
        uniqueCapturedCards.forEach(card => {
            if (!card) return;
            // Ace = 1 point
            if (card.rank === 'A') pointsForCapture += 1;
            // Diamond 10 (big casino) = 2 points
            if (card.suitRank === 'D10') pointsForCapture += 2;
            // Spade 2 (little casino) = 1 point
            if (card.suitRank === 'S2') pointsForCapture += 1;
        });
        if (currentPlayer === 1) currentP1Score += pointsForCapture; else currentP2Score += pointsForCapture;
    }

    // Add captured cards to the capturing player's pile (they go face-up on top)
    const pushResult = pushCapturedToPlayer(currentP1Pile, currentP2Pile, currentPlayer, uniqueCapturedCards);

    return {
        success: true,
        newP1Score: currentP1Score,
        newP2Score: currentP2Score,
        newTableItems: newTableItems,
        newLastCapturer: currentPlayer, // Update last capturer
        message: `Player ${currentPlayer} captured ${selectedItems.length} item(s).${sweepMessage}`,
        capturedCards: uniqueCapturedCards, // Return the unique list of cards
        newP1Pile: pushResult.newP1Pile,
        newP2Pile: pushResult.newP2Pile
    };
};
