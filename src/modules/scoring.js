// scoring.js
// Full scoring helper (keeps existing behavior if needed elsewhere).
// NOTE: In this project we use immediate per-capture scoring for A/D10/S2,
// so end-of-game scoring should only apply the *final bonuses* (most cards, most spades)
// to avoid double-counting. The helper below computes those end-game bonuses.
export const calculateEndGameBonuses = (player1Pile, player2Pile) => {
  let p1Bonus = 0;
  let p2Bonus = 0;

  // --- Most cards ---
  // Award 3 points to the player with the most cards. If tied, no points.
  if (player1Pile.length > player2Pile.length) p1Bonus += 3;
  else if (player2Pile.length > player1Pile.length) p2Bonus += 3;

  // --- Most spades ---
  const p1Spades = player1Pile.filter((card) => card.suit === 'S').length;
  const p2Spades = player2Pile.filter((card) => card.suit === 'S').length;
  if (p1Spades > p2Spades) p1Bonus += 1;
  else if (p2Spades > p1Spades) p2Bonus += 1;

  return { p1Bonus, p2Bonus };
};

// Backwards-compatible full calculation (not used by default).
export const calculateScores = (player1Pile, player2Pile, player1Score = 0, player2Score = 0) => {
  let p1Score = player1Score;
  let p2Score = player2Score;

  // --- Card points (Aces, Big Casino, Little Casino) ---
  player1Pile.forEach(card => {
    if (card.rank === 'A') p1Score += 1;
    if (card.suitRank === 'D10') p1Score += 2;
    if (card.suitRank === 'S2') p1Score += 1;
  });
  
  player2Pile.forEach(card => {
    if (card.rank === 'A') p2Score += 1;
    if (card.suitRank === 'D10') p2Score += 2;
    if (card.suitRank === 'S2') p2Score += 1;
  });

  // Add end-game bonuses
  const { p1Bonus, p2Bonus } = calculateEndGameBonuses(player1Pile, player2Pile);
  p1Score += p1Bonus;
  p2Score += p2Bonus;

  return { p1Score, p2Score };
};
