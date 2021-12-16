/* eslint-disable @typescript-eslint/no-var-requires */
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { Chess } = require('chess.js');
const fs = require('fs');

const OPENING_BASE = 'https://explorer.lichess.ovh/lichess';

class TooManyRequests extends Error {
  constructor(message) {
    super(message);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

const SPEEDS = [
  'ultraBullet',
  'bullet',
  'blitz',
  'rapid',
  'classical',
  'correspondence',
];
const RATINGS = [1600, 1800, 2000, 2200, 2500];

const PERMUTATIONS = [];
SPEEDS.forEach((speed) =>
  RATINGS.forEach((rating) => {
    PERMUTATIONS.push({ speed, rating, id: `${speed}${rating}` });
  })
);

const MIN_GAME_LIMIT = 100000;
const MOVES_PER_VARIATION = 2;

async function getOpeningFromLichess(fen, speeds, ratings) {
  const params = new URLSearchParams();
  params.append('fen', fen);
  params.append('speeds', speeds.join(','));
  params.append('ratings', ratings.join(','));
  params.append('moves', MOVES_PER_VARIATION);
  return fetch(`${OPENING_BASE}?${params}`).then((res) => {
    if (res.status === 429) throw new TooManyRequests();
    if (res.status !== 200) {
      console.error(res);
    }
    return res.json();
  });
}

async function retryableGetOpening(fen) {
  const allResults = [];
  let todo = [...PERMUTATIONS];
  while (allResults.length < PERMUTATIONS.length) {
    console.log(`todo: ${todo.length}`);
    const results = await Promise.allSettled(
      todo.map(async ({ speed, rating, id }) => {
        const res = await getOpeningFromLichess(fen, [speed], [rating]);
        return { res, id, speed, rating };
      })
    );
    let hitRateLimit = false;
    results.forEach((pres) => {
      if (pres.status === 'fulfilled') {
        const { res, speed, rating, id } = pres.value;
        allResults.push({ res, speed, rating });
        todo = todo.filter((e) => e.id !== id);
      } else if (pres.reason instanceof TooManyRequests) {
        hitRateLimit = true;
      } else {
        throw new Error(pres.reason);
      }
    });
    if (hitRateLimit) {
      console.log('Hit rate limit, waiting a minute');
      await wait(1000 * 65);
    }
  }
  return allResults;
}

async function getAllOpeningsFromLichess(fen) {
  const allResults = await retryableGetOpening(fen);
  const results = [];
  const moves = {};
  allResults.forEach(({ res, speed, rating }) => {
    results.push({
      speed,
      rating,
      result: { white: res.white, black: res.black, draws: res.draws },
      fen,
    });
    res.moves.forEach((move) => {
      const playedCount = res.white + res.draws + res.black;
      moves[move.san] = (moves[move.san] || 0) + playedCount;
    });
  });
  console.log(moves);
  const movesToCheck = Object.keys(moves).filter(
    (move) => moves[move] >= MIN_GAME_LIMIT
  );
  return { results, movesToCheck };
}

async function main() {
  const chess = new Chess();
  const checkedPositions = new Set();
  const positionsToCheck = [chess.fen()];
  const allResults = [];
  while (positionsToCheck.length > 0) {
    console.log(`${positionsToCheck.length} positions left in queue`);
    const pos = positionsToCheck.shift();
    console.log('Checking:');
    console.log(new Chess(pos).ascii());
    const { results, movesToCheck } = await getAllOpeningsFromLichess(pos);
    allResults.push(...results);
    checkedPositions.add(pos);
    movesToCheck.forEach((move) => {
      const newGame = new Chess(pos);
      newGame.move(move);
      if (checkedPositions.has(newGame.fen())) return;
      positionsToCheck.push(newGame.fen());
    });
  }
  console.log(allResults.length);
  fs.writeFileSync('./data/data.json', JSON.stringify(allResults));
}

main();
