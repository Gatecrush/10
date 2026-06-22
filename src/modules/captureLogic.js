// src/modules/captureLogic.js
import { getValue, captureValues, combinationValue } from './deck';

export class CaptureValidator {

    /**
     * Finds all valid sets of table items that can be captured by the played card.
     * Includes rank matches, value matches (A=14), combination sums (A=1),
     * and direct build value matches (A=1).
     * Ensures items have IDs.
     * @param {object} playedCard - The card played from the hand.
     * @param {array} tableItems - Current items on the table (cards, builds, pairs).
     * @returns {array<array<object>>} - An array of valid capture sets. Each set is an array of table items.
     */
    static getValidCaptures(playedCard, tableItems) {
        if (!playedCard || !tableItems || !Array.isArray(tableItems)) return [];

        const validCaptureSets = [];
        const playedRank = playedCard.rank;
        const playedCaptureValue = captureValues[playedRank]; // Value for build capture (A=14, J=11...)
        const playedCombinationValue = combinationValue(playedRank); // Value for sum/direct match (A=1, 2=2...)
        const isPlayedCardNumeric = !['J', 'Q', 'K'].includes(playedRank); // Ace is numeric here

        // Filter out invalid items early
        const validTableItems = tableItems.filter(item => item && item.id && item.type);

        // --- 1. Capture by Rank (Cards and Pairs) ---
        const rankMatchItems = validTableItems.filter(
            item =>
                ((item.type === 'card' && item.rank === playedRank) ||
                 (item.type === 'pair' && item.rank === playedRank))
        );
        if (rankMatchItems.length > 0) {
            // Rank capture takes ALL matching rank items (cards and pairs) together
            validCaptureSets.push([...rankMatchItems]);
        }

        // --- 2. Capture by Value (Only for Numeric Cards: 2-10, A) ---
        if (isPlayedCardNumeric) {
            // --- 2a. Capture Builds by Capture Value (A=14, etc.) ---
            // Note: Standard Casino usually uses combination value (A=1) for build capture too.
            // Let's align with that common rule. If A=14 is needed, adjust here.
            // Using playedCombinationValue (A=1) for build capture
            const buildValueMatches = validTableItems.filter(
                item =>
                    item.type === 'build' &&
                    Number(item.value) === playedCombinationValue // Match build value (A=1)
            );
            // Each matching build is an independent capture option
            buildValueMatches.forEach(build => {
                validCaptureSets.push([build]);
            });

            // --- 2a.5. Capture opponent pile-top if its combination value equals target ---
            // (e.g., opponent's pile top of rank 5 can be captured when capturing value 5)
            const pileTopMatches = validTableItems.filter(
                item => item.isPileTop && item.type === 'card' && combinationValue(item.rank) === playedCombinationValue
            );
            pileTopMatches.forEach(pt => validCaptureSets.push([pt]));

            // --- 2b. Capture Combinations Summing to Combination Value (A=1), including builds ---
            // Items eligible for combinations: individual numeric cards (Ace=1) and *all* Builds (using their value)
            // PAIRS CANNOT BE USED IN VALUE COMBINATIONS
            const combinableItems = validTableItems.filter(
                item =>
                    (item.type === 'card' && !['J', 'Q', 'K'].includes(item.rank)) || // Numeric cards (A=1)
                    (item.type === 'build') // Builds (single or compound)
            );

            if (combinableItems.length > 0) {
                const n = combinableItems.length;
                // Precompute values for speed (cards: combinationValue, builds: build.value)
                const values = combinableItems.map(item => (item.type === 'card' ? combinationValue(item.rank) : Number(item.value)));

                // Helper: check whether a mask (subset) can be partitioned into disjoint submasks each summing to target
                const canPartitionMask = (mask, target) => {
                    // Build list of submasks of mask that sum exactly to target
                    const submasks = [];
                    for (let sub = mask; sub; sub = (sub - 1) & mask) {
                        let ssum = 0;
                        for (let k = 0; k < n; k++) {
                            if ((sub >> k) & 1) ssum += values[k];
                        }
                        if (ssum === target) submasks.push(sub);
                    }

                    if (submasks.length === 0) return false;

                    // Try to cover the full mask by selecting disjoint submasks from the list
                    const memo = new Map();
                    const cover = (remaining) => {
                        if (remaining === 0) return true;
                        if (memo.has(remaining)) return memo.get(remaining);
                        for (const s of submasks) {
                            if ((s & remaining) === s) {
                                if (cover(remaining ^ s)) {
                                    memo.set(remaining, true);
                                    return true;
                                }
                            }
                        }
                        memo.set(remaining, false);
                        return false;
                    };

                    return cover(mask);
                };

                // Iterate through all possible subsets (masks) of combinable items
                for (let mask = 1; mask < (1 << n); mask++) {
                    let total = 0;
                    const subset = [];
                    let containsBuild = false;
                    for (let j = 0; j < n; j++) {
                        if ((mask >> j) & 1) {
                            const item = combinableItems[j];
                            subset.push(item);
                            total += values[j];
                            if (item.type === 'build') containsBuild = true;
                        }
                    }

                    // If total equals the target, add like before (single group)
                    if (total === playedCombinationValue) {
                        if (subset.length > 1 || (subset.length === 1 && subset[0].type === 'card')) {
                            validCaptureSets.push(subset);
                        }
                        continue;
                    }

                    // If total is a multiple of the target, check whether it can be partitioned into
                    // disjoint groups each summing to the target (allows capturing multiple groups at once)
                    if (total > playedCombinationValue && total % playedCombinationValue === 0) {
                        if (canPartitionMask(mask, playedCombinationValue)) {
                            // Avoid adding a mask that is exactly a single build (already handled)
                            if (!(subset.length === 1 && subset[0].type === 'build')) {
                                validCaptureSets.push(subset);
                            }
                        }
                    }
                }
            }
                // -- 2c. Capture a Build plus table cards that sum to the Build value ---
                // For example: played combination 9 can capture an existing Build(9) plus table cards [7,2].
                const cardOnlyItems = validTableItems.filter(item => item.type === 'card');
                const buildsMatching = validTableItems.filter(item => item.type === 'build' && Number(item.value) === playedCombinationValue);
                if (buildsMatching.length > 0 && cardOnlyItems.length > 0) {
                    const m = cardOnlyItems.length;
                    const cardValues = cardOnlyItems.map(c => combinationValue(c.rank));
                    for (const build of buildsMatching) {
                        for (let mask = 1; mask < (1 << m); mask++) {
                            let ssum = 0;
                            const subset = [];
                            for (let k = 0; k < m; k++) {
                                if ((mask >> k) & 1) {
                                    ssum += cardValues[k];
                                    subset.push(cardOnlyItems[k]);
                                }
                            }
                            if (ssum === playedCombinationValue) {
                                // Create the capture set: [build, ...subset]
                                validCaptureSets.push([build, ...subset]);
                            }
                        }
                    }
                }
        }

        // --- 3. Remove duplicate sets ---
        // (Using IDs ensures object reference differences don't create duplicates)
        const uniqueSets = [];
        const seenSetSignatures = new Set();

        validCaptureSets.forEach(set => {
            // Ensure set is valid and items have IDs before creating signature
            if (set && Array.isArray(set) && set.length > 0 && set.every(item => item && item.id)) {
                const signature = set.map(item => item.id).sort().join(',');
                if (!seenSetSignatures.has(signature)) {
                    seenSetSignatures.add(signature);
                    uniqueSets.push(set);
                }
            } else if (set && Array.isArray(set) && set.length > 0) {
                // Log error if items are missing IDs but the set structure is otherwise okay
                console.error("Capture set generation error: item missing ID in potential set:", set);
            }
        });

        return uniqueSets;
    }
}

// Helper function to compare if two arrays of items are the same set (order-independent)
export const areItemSetsEqual = (set1, set2) => {
    if (!set1 || !set2 || !Array.isArray(set1) || !Array.isArray(set2) || set1.length !== set2.length) {
        return false;
    }
    // Ensure items have IDs before comparing
    if (!set1.every(item => item && item.id) || !set2.every(item => item && item.id)) {
        console.error("areItemSetsEqual Error: Attempted to compare sets with missing IDs");
        return false; // Cannot compare reliably
    }
    const ids1 = set1.map(item => item.id).sort();
    const ids2 = set2.map(item => item.id).sort();
    return ids1.every((id, index) => id === ids2[index]);
};
