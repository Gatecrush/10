// dealing.js
export const dealInitialCards = (deck) => {
  const p1Hand = [];
  const p2Hand = [];
  const table = [];

  // Deal 4 cards to each player and 4 to the table, popping from the end of the deck
  for (let i = 0; i < 4; i++) {
    if (deck.length > 0) p1Hand.push(deck.pop());
    if (deck.length > 0) p2Hand.push(deck.pop());
    if (deck.length > 0) table.push(deck.pop());
  }

  return {
    p1Hand,
    p2Hand,
    table,
    updatedDeck: [...deck],
  };
};
