// RulesModule.js
// Centralized rules logic for the card game. Each rule is a pure function or helper.
// All rule checks should be called from game logic modules (buildLogic, turns, etc).

const RulesModule = {
  // 1. Cannot build on opponent's concrete build
  cannotBuildOnOpponentsConcreteBuild({ build, player }) {
    return build.owner !== player && build.isConcrete;
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
    // (Implement logic to check if player is using all cards that could capture their own build)
    // Placeholder: always false
    return false;
  },

  // 4. Cannot build twice on the table in one turn
  cannotBuildTwiceInTurn({ player, table, turnActions }) {
    // turnActions: array of actions this turn
    const buildCount = turnActions.filter(a => a.type === 'build' && a.player === player).length;
    return buildCount > 1;
  },

  // 5. Cannot trail while building
  cannotTrailWhileBuilding({ player, isBuilding }) {
    return isBuilding;
  },

  // 6. Never break up or combine builds
  cannotBreakOrCombineBuilds({ table, action }) {
    // action: attempted build/modify
    // Placeholder: always true (never allowed)
    return true;
  },

  // 7. No two builds of same capture value
  cannotHaveDuplicateBuildValues({ table }) {
    const values = table.filter(i => i.type === 'build').map(b => b.captureValue);
    return new Set(values).size !== values.length;
  },

  // 8. Cannot discard (trail) if you own a build
  cannotTrailIfOwnBuild({ player, table }) {
    return table.some(i => i.type === 'build' && i.owner === player);
  },

  // 9. Cannot have more than one build at end of turn (unless stealing and chowing)
  cannotEndTurnWithMultipleBuilds({ player, table, turnActions }) {
    const ownBuilds = table.filter(i => i.type === 'build' && i.owner === player);
    // Allow if last action is 'chow' (capture one of the builds)
    const lastAction = turnActions[turnActions.length - 1];
    if (ownBuilds.length > 1 && !(lastAction && lastAction.type === 'chow')) {
      return true;
    }
    return false;
  },
};

export default RulesModule;
