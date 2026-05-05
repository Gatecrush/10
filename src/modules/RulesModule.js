// RulesModule.js
// Centralized rules logic for the card game. Each rule is a pure function or helper.
// All rule checks should be called from game logic modules (buildLogic, turns, etc).

const RulesModule = {
  // 1. Cannot build on opponent's concrete build
  cannotBuildOnOpponentsConcreteBuild({ build, player }) {
    if (!build) return false;
    // The codebase uses 'controller' as owner and 'value' for build value
    return build.controller !== player && (build.isConcrete || build.isSolid || RulesModule.isSolidBuild(build));
  },

  // 2. Previous loser is dealt first and starts next round
  // (This is a stateful rule, not a pure function. Use in dealing logic.)
  getNextDealerAndStarter({ previousLoser, players }) {
    // Returns { dealer, starter }
    return {
      dealer: previousLoser,
      starter: previousLoser,
    };
  },

  // 3. Cannot abandon your own build by using up all capture cards
  cannotAbandonOwnBuild({ player, build, hand, table }) {
    // Returns true if player would abandon their build
    // Placeholder: always false until more detailed logic is added
    return false;
  },

  // 4. Cannot build twice on the table in one turn
  cannotBuildTwiceInTurn({ player, table, turnActions }) {
    const buildCount = Array.isArray(turnActions) ? turnActions.filter(a => a.type === 'build' && a.player === player).length : 0;
    return buildCount > 1;
  },

  // 5. Cannot trail while building
  cannotTrailWhileBuilding({ player, isBuilding }) {
    return !!isBuilding;
  },

  // 6. Never break up or combine builds
  cannotBreakOrCombineBuilds({ table, action }) {
    // action: attempted build/modify
    // Default: disallow
    return true;
  },

  // 7. No two builds of same capture value
  cannotHaveDuplicateBuildValues({ table }) {
    const values = (Array.isArray(table) ? table.filter(i => i.type === 'build').map(b => b.value) : []);
    return new Set(values).size !== values.length;
  },

  // 8. Cannot discard (trail) if you own a build
  cannotTrailIfOwnBuild({ player, table }) {
    return Array.isArray(table) && table.some(i => i.type === 'build' && i.controller === player);
  },

  // 9. Cannot have more than one build at end of turn (unless stealing and chowing)
  cannotEndTurnWithMultipleBuilds({ player, table, turnActions }) {
    const ownBuilds = Array.isArray(table) ? table.filter(i => i.type === 'build' && i.controller === player) : [];
    const lastAction = Array.isArray(turnActions) && turnActions.length ? turnActions[turnActions.length - 1] : null;
    if (ownBuilds.length > 1 && !(lastAction && lastAction.type === 'chow')) {
      return true;
    }
    return false;
  },
};

// Returns true if a build contains a card matching its own value (solid/concrete build)
RulesModule.isSolidBuild = function(build) {
  if (!build || !Array.isArray(build.cards) || typeof build.value !== 'number') return false;
  return build.cards.some(card => {
    if (!card) return false;
    if (build.value === 1 && card.rank === 'A') return true;
    return String(card.rank) === String(build.value);
  });
};

export default RulesModule;
