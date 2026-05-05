import { CaptureValidator } from '../src/modules/captureLogic.js';

// Scenario: played 5S, table has 2S, 3D, and a Build of value 5
const playedCard = { type: 'card', rank: '5', suit: 'S', suitRank: 'S5', id: 'hand-S5' };

const card2S = { type: 'card', rank: '2', suit: 'S', suitRank: 'S2', id: 'card-S2' };
const card3D = { type: 'card', rank: '3', suit: 'D', suitRank: 'D3', id: 'card-D3' };
// Build of value 5 containing one or more cards
const build5 = { type: 'build', id: 'build-5', value: 5, cards: [{ type: 'card', rank: '5', suit: 'H', suitRank: 'H5', id: 'card-H5' }], controller: 2 };

const tableItems = [card2S, card3D, build5];

const options = CaptureValidator.getValidCaptures(playedCard, tableItems);

console.log('Valid capture options count:', options.length);
options.forEach((opt, i) => {
  console.log(`Option ${i + 1}:`, opt.map(it => ({ id: it.id, type: it.type, value: it.value || null, rank: it.rank || null }))); 
});

// Also check whether the combined set [build5, 2S, 3D] is present
const targetIds = ['build-5', 'card-S2', 'card-D3'];
const found = options.some(opt => {
  const ids = opt.map(it => it.id).sort();
  const sortedTarget = [...targetIds].sort();
  return ids.length === sortedTarget.length && ids.every((v, idx) => v === sortedTarget[idx]);
});
console.log('Contains combined build+2+3 capture?:', found);
