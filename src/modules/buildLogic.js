// src/modules/buildLogic.js
import RulesModule from './RulesModule';

    // Helper to get the build value of a card (Ace=1)
    const getBuildValue = (card) => {
      if (!card) return 0;
      if (card.rank === 'A') return 1;
      if (["J", "Q", "K"].includes(card.rank)) return 0; // Face cards have no build value
      const numRank = parseInt(card.rank);
      return isNaN(numRank) ? 0 : numRank;
    };
  

    // Helper to get the value of a table item for building/matching
    const getItemValue = (item) => {
      if (!item) return 0;
      if (!item.type) {
        console.error("Item missing type:", item);
        return 0;
      }

      if (item.type === 'card') {
        if (!item.rank) { console.error("Card item missing rank:", item); return 0; }
        return getBuildValue(item); // Ace=1, JQK=0
      }
      if (item.type === 'build') {
        if (typeof item.value !== 'number') { console.error("Build item missing value:", item); return 0; }
        return item.value; // Single or Multi-Build value
      }
      return 0; // Pairs or other types
    };

    // Helper to check if a card is a face card
    const isFaceCard = (card) => {
      if (!card || !card.rank) return false;
      return ['J', 'Q', 'K'].includes(card.rank);
    };

    // Helper to partition cards into Builds with the same value
    // Tries to partition `cards` + `playedCard` into builds summing to `targetValue`.
    // Returns an array of build objects {cards: [...], value: targetValue} if successful, otherwise null.
    const findBuildPartitions = (playedCard, cards, targetValue) => {
      const builds = [];
      let allCardsToPartition = [playedCard, ...cards]; // Include played card from the start
      let remainingCards = [...allCardsToPartition];

      while (remainingCards.length > 0) {
        let foundBuild = false;
        const n = remainingCards.length;

        // Iterate through all non-empty subsets of remainingCards
        for (let i = 1; i < (1 << n); i++) {
          const subset = [];
          let sum = 0;

          for (let j = 0; j < n; j++) {
            if ((i >> j) & 1) {
              const card = remainingCards[j];
              sum += getBuildValue(card);
              subset.push(card);
            }
          }

          // If subset sums to the target value
          if (sum === targetValue && subset.length > 0) {
            builds.push({ cards: subset, value: targetValue });
            // Remove the cards in the found subset from remainingCards
            remainingCards = remainingCards.filter(c => !subset.some(sc => sc.suitRank === c.suitRank));
            foundBuild = true;
            break; // Move to the next iteration of the while loop to find the next build
          }
        }

        // If no subset summing to targetValue was found in this iteration, partitioning fails
        if (!foundBuild) {
          return null; // Cannot partition remaining cards
        }
      }

      // Check if at least two builds were formed and all cards were used
      // Also ensure the played card was actually used in one of the builds
      const playedCardWasUsed = builds.some(build => build.cards.some(c => c.suitRank === playedCard.suitRank));

      if (builds.length >= 2 && remainingCards.length === 0 && playedCardWasUsed) {
        return builds;
      }
      return null; // Failed if less than 2 builds, cards remain, or played card wasn't used
    };


    export const validateBuild = (playedCard, selectedItems, playerHand, tableItems, currentPlayer) => {
      // --- Rules Enforcement ---
      // 1. Cannot build twice in a turn (should be checked in turn handler, not here)
      // 2. Cannot build on opponent's concrete build
      if (selectedItems.some(item => item.type === 'build' && RulesModule.cannotBuildOnOpponentsConcreteBuild({ build: item, player: currentPlayer }))) {
        return { isValid: false, message: "Cannot build on opponent's concrete build." };
      }
      // 3. Cannot break up or combine builds
      if (selectedItems.filter(item => item.type === 'build').length > 1) {
        if (RulesModule.cannotBreakOrCombineBuilds({ table: tableItems, action: { type: 'combine', items: selectedItems } })) {
          return { isValid: false, message: "Cannot combine or break up builds." };
        }
      }
      // 4. No two builds of same capture value
      // NOTE: enforce duplicate-build checks later when evaluating a specific target value
      // so that modifications which resolve duplicates aren't improperly blocked here.
      // --- Initial Checks ---
      if (!playedCard || !selectedItems || selectedItems.length === 0) {
        return { isValid: false, message: "Select a card from hand and items from table." };
      }
      if (!selectedItems.every(item => item && item.id)) {
        console.error("Validation Error: Some selected items are invalid or missing IDs.");
        return { isValid: false, message: "Internal error: Invalid items selected." };
      }
      if (isFaceCard(playedCard)) {
        return { isValid: false, message: "Face cards cannot be used in builds." };
      }
      if (selectedItems.some(item => item.type === 'pair')) {
        return { isValid: false, message: "Cannot select pairs for building." };
      }
      const playedCardValue = getBuildValue(playedCard);
      // Allow playedCardValue to be 0 if it's part of a multi-build partition
      // if (playedCardValue === 0) {
      //   return { isValid: false, message: "Played card has no build value." };
      // }

      // --- Separate Build Types ---
      const selectedBuilds = selectedItems.filter(item => item.type === 'build');
      const selectedCards = selectedItems.filter(item => item.type === 'card');

      // Case 1: Increasing a Multi-Build
      if (selectedBuilds.length === 1 && selectedBuilds[0].isCompound) {
        const targetMultiBuild = selectedBuilds[0];
        // Cannot increase a called combination
        if (targetMultiBuild.isCall) {
          return { isValid: false, message: "Cannot increase a called combination." };
        }
        // Only the build owner can increase their multi-build
        if (targetMultiBuild.controller !== currentPlayer) {
          return { isValid: false, message: "Only the build owner can increase this Multi-Build." };
        }
        // Cannot select other builds when increasing a multi-build
        if (selectedItems.length !== selectedCards.length + 1) {
             return { isValid: false, message: "Cannot select other builds when increasing a Multi-Build." };
        }
        if (selectedCards.some(card => isFaceCard(card))) {
          return { isValid: false, message: "Face cards cannot be used in builds." };
        }

        const summingValue = playedCardValue + selectedCards.reduce((sum, card) => sum + getBuildValue(card), 0);
        if (summingValue !== targetMultiBuild.value) {
          return { isValid: false, message: `New Build must sum to Multi-Build value ${targetMultiBuild.value}.` };
        }

        const hasHoldingCard = playerHand.some(
          handCard =>
            handCard.suitRank !== playedCard.suitRank &&
            getBuildValue(handCard) === targetMultiBuild.value
        );
        if (!hasHoldingCard) {
          return { isValid: false, message: `Need a ${targetMultiBuild.value} in hand to increase Multi-Build.` };
        }

        const existingPlayerBuild = tableItems.find(
          item =>
            item.type === 'build' &&
            item.value === targetMultiBuild.value &&
            item.controller === currentPlayer &&
            item.id !== targetMultiBuild.id
        );
        if (existingPlayerBuild) {
          return { isValid: false, message: `You already control a Build of ${targetMultiBuild.value}.` };
        }

        return {
          isValid: true,
          buildValue: targetMultiBuild.value,
          isModification: true,
          targetBuild: targetMultiBuild,
          summingItems: selectedCards, // Only the cards are the summing items here
          cascadingItems: [],
          isMultiBuildIncrease: true,
          message: `Increased Multi-Build of ${targetMultiBuild.value}.`
        };
      }

      // Case 2: Multi-Build from multiple single Builds
      // Case 2: Convert a single existing single-Build into a Multi-Build using additional cards
      if (selectedBuilds.length === 1 && !selectedBuilds[0].isCompound && selectedCards.length > 0) {
        const baseBuild = selectedBuilds[0];
        // Only the owner of the existing single build can convert it into a Multi-Build
        if (baseBuild.controller !== currentPlayer) {
          return { isValid: false, message: "Only the build owner can convert this Build into a Multi-Build." };
        }

        // Collect the table cards that will participate in partitioning: the cards from the base build + the extra selected cards
        const cardsToPartition = [];
        if (Array.isArray(baseBuild.cards)) cardsToPartition.push(...baseBuild.cards);
        cardsToPartition.push(...selectedCards);

        // Try partitioning into multiple builds for each possible target value
        for (let targetValue = 1; targetValue <= 10; targetValue++) {
          const builds = findBuildPartitions(playedCard, cardsToPartition, targetValue);
          if (!builds) continue;

          // Need a holding card in hand for this player (not counting the played card)
          const hasHoldingCard = playerHand.some(
            handCard => handCard.suitRank !== playedCard.suitRank && getBuildValue(handCard) === targetValue
          );
          if (!hasHoldingCard) continue;

          // Standard rule: only one build per targetValue allowed on the table
          const existingBuild = tableItems.find(
            item => item.type === 'build' && item.value === targetValue && item.id !== baseBuild.id
          );
          if (existingBuild) continue;

          // Success: the base build plus selected cards can be partitioned into a Multi-Build
          return {
            isValid: true,
            buildValue: targetValue,
            isMultiBuildCreation: true,
            multiBuildBuilds: builds,
            summingItems: selectedCards, // cards from table (excluding the original build object)
            cascadingItems: [],
            targetBuild: baseBuild,
            message: `Converted Build ${baseBuild.value} into Multi-Build of ${targetValue}.`
          };
        }
        // If no partitioning succeeded, fall through to other checks below
      }

      if (selectedBuilds.length > 1) {
        // Merging two separate builds into one is not allowed by game rules
        return { isValid: false, message: "Cannot merge separate Builds into a Multi-Build." };
        
        // (If later we want to allow combining builds, add strict ownership and non-compound checks here.)
  }

      // Case 3: Multi-Build from cards (including played card)
      // This happens if only cards are selected (selectedBuilds.length === 0)
      if (selectedBuilds.length === 0 && selectedCards.length > 0) {
        for (let targetValue = 1; targetValue <= 10; targetValue++) {
          // Try partitioning all selected cards + the played card
          const builds = findBuildPartitions(playedCard, selectedCards, targetValue);
          if (builds) { // findBuildPartitions returns null if partitioning fails or < 2 builds
            const hasHoldingCard = playerHand.some(
              handCard =>
                handCard.suitRank !== playedCard.suitRank &&
                getBuildValue(handCard) === targetValue
            );
            if (!hasHoldingCard) {
              continue; // Try next target value if no holding card for this one
            }

            // Standard rule: only one build per targetValue allowed on the table
            const existingBuild = tableItems.find(
              item => item.type === 'build' && item.value === targetValue
            );
            if (existingBuild) {
              continue; // Cannot create if any build of this value already exists
            }

            // Successfully partitioned into a multi-build
            return {
              isValid: true,
              buildValue: targetValue,
              isMultiBuildCreation: true,
              multiBuildBuilds: builds, // The partitions found
              summingItems: selectedCards, // All selected cards were used
              cascadingItems: [],
              message: `Created Multi-Build of ${targetValue}.`
            };
          }
        }
        // If loop finishes without finding a valid partition
      }


      // Case 4: Single Build or modifying a Single Build
      let targetBuild = null;
      let otherSelectedItems = [];
      let isModification = false;

      if (selectedBuilds.length === 1 && !selectedBuilds[0].isCompound) {
        targetBuild = selectedBuilds[0];
        otherSelectedItems = selectedCards;
        isModification = true;
      } else if (selectedBuilds.length === 0) { // Only cards selected
        otherSelectedItems = selectedCards;
        isModification = false;
      } else {
          // Invalid combination (e.g., selecting a compound build with cards without increasing)
          return { isValid: false, message: "Invalid selection for building." };
      }


      if (otherSelectedItems.some(item => isFaceCard(item))) {
        return { isValid: false, message: "Face cards cannot be used in builds." };
      }

      // Only the build owner can modify a solid build; anyone can construct on a non-solid build
      if (isModification && targetBuild) {
        const isSolid = RulesModule.isSolidBuild(targetBuild);
        if (isSolid && targetBuild.controller !== currentPlayer) {
          return { isValid: false, message: "Only the build owner can modify this solid Build." };
        }
      }

      const n = otherSelectedItems.length;

      // Iterate through subsets of otherSelectedItems (cards)
      for (let i = 0; i < (1 << n); i++) {
        const currentSummingGroup = []; // Cards from table contributing to the sum
        const currentRemainingIds = new Set(otherSelectedItems.map(item => item.id));
        let summingGroupValue = 0;

        for (let j = 0; j < n; j++) {
          if ((i >> j) & 1) {
            const item = otherSelectedItems[j];
            if (!item || !item.id) continue;
            currentSummingGroup.push(item);
            summingGroupValue += getItemValue(item);
            currentRemainingIds.delete(item.id);
          }
        }

        // Calculate the value of this potential build
        // Special-case: when modifying an existing single build and no summing cards
        // are selected, and the played card's build value equals the target build value,
        // treat the resulting build value as the existing build value (i.e., continue the build)
        let currentBuildValue;
        if (isModification && targetBuild && currentSummingGroup.length === 0 && playedCardValue === getItemValue(targetBuild)) {
          currentBuildValue = getItemValue(targetBuild);
        } else {
          currentBuildValue = playedCardValue + summingGroupValue + (targetBuild ? getItemValue(targetBuild) : 0);
        }
        if (currentBuildValue <= 0 || currentBuildValue > 10) continue; // Build value must be 1-10

        const currentRemainingItems = otherSelectedItems.filter(item => currentRemainingIds.has(item.id));

        // Check if remaining items "cascade" (match the build value)
        if (currentRemainingItems.some(item => getItemValue(item) !== currentBuildValue)) {
          continue; // This subset doesn't work because remaining items don't match
        }

        // Check holding card for the final build value
        // Holding-card rule:
        // - If modifying an existing single Build by playing a card that equals the build's value
        //   (i.e., no summing table cards selected and playedCardValue === targetBuild.value),
        //   require that the player hold another card equal to the ORIGINAL build value so they
        //   don't abandon control.
        // - Otherwise, require a holding card equal to the resulting build value as before.
        let hasHoldingCard = false;
        if (isModification && targetBuild && currentSummingGroup.length === 0 && playedCardValue === getItemValue(targetBuild)) {
          hasHoldingCard = playerHand.some(
            handCard => handCard.suitRank !== playedCard.suitRank && getBuildValue(handCard) === getItemValue(targetBuild)
          );
        } else {
          hasHoldingCard = playerHand.some(
            handCard => handCard.suitRank !== playedCard.suitRank && getBuildValue(handCard) === currentBuildValue
          );
        }
        if (!hasHoldingCard) {
          continue; // Need a holding card for this value
        }

        // Check duplicate Build
        const existingBuild = tableItems.find(
          item =>
            item.type === 'build' &&
            item.value === currentBuildValue &&
            (!targetBuild || item.id !== targetBuild.id) // Exclude the build being modified
        );
        if (existingBuild) {
          continue; // A build of this value already exists on the table
        }

        // If all checks pass for this subset, it's a valid single build
        // Detect 'call' combinations: when the played card equals the target value and the summing group is composed of table cards
  // A 'call' occurs when the played card's build value equals the SUM of the selected table cards
  // (e.g. play an 8 onto table cards that sum to 8). Detect that case explicitly.
  const isCall = !isModification && !targetBuild && currentSummingGroup.length > 0 && (playedCardValue === summingGroupValue) && currentSummingGroup.every(it => it.type === 'card');
        return {
          isValid: true,
          buildValue: currentBuildValue,
          isModification,
          targetBuild,
          summingItems: currentSummingGroup, // Cards from table used in the sum
          cascadingItems: currentRemainingItems, // Cards from table that matched the value
          isMultiBuildCreation: false, // Not creating a multi-build in this case
          multiBuildBuilds: null,
          isCall,
          message: `Build ${currentBuildValue} is valid.`
        };
      } // End of subset loop for single builds

      // --- Error Handling if no valid build found ---
      const fullSumValue = otherSelectedItems.reduce((sum, item) => sum + getItemValue(item), 0);
      const potentialFullTarget = playedCardValue + fullSumValue + (targetBuild ? getItemValue(targetBuild) : 0);
      const needsHoldingCardCheck = playerHand.some(
        handCard =>
          handCard.suitRank !== playedCard.suitRank &&
          getBuildValue(handCard) === potentialFullTarget
      );

      if (potentialFullTarget > 0 && potentialFullTarget <= 10 && !needsHoldingCardCheck) {
        return { isValid: false, message: `Invalid combination. You might need a ${potentialFullTarget} in hand.` };
      }
      return { isValid: false, message: "Invalid build combination selected." };
    };
