/* eslint-disable @typescript-eslint/no-var-requires */
/* Comment out for browser */
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { Chess } = require('chess.js');
const fs = require('fs');
/* Done */

/* Uncomment for browser */
// const fs = {
//   writeFileSync: (_, data) => console.log(data),
// };
/* Done */

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

class TooManyRequests extends Error {
  constructor(message) {
    super(message);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

// Need 25k+ an hour probably

const MIN_GAME_LIMIT = 1000;

const playFromChess = (chess) =>
  chess
    .history({ verbose: true })
    .map(({ to, from }) => `${from}${to}`)
    .join(',');

async function getOpeningFromLichess(chess, speeds, ratings, agent) {
  const params = new URLSearchParams();
  params.append('variant', 'standard');
  params.append('fen', chess.fen());
  const play = playFromChess(chess);
  if (play) params.append('play', playFromChess(chess));
  params.append('speeds', speeds.join(','));
  params.append('ratings', ratings.join(','));
  // TODO: maybe reenable
  // params.append('moves', 50);
  return fetch(`https://explorer.lichess.ovh/lichess?${params}`, {
    agent,
  }).then(async (res) => {
    if (res.status === 429) throw new TooManyRequests();
    if (res.status !== 200) {
      console.log(chess.ascii());
      console.log(chess.fen());
      console.error(res);
      const text = await res.text();
      console.error(text);
      throw Error(text);
    }
    return res.json();
  });
}

async function retryableGetOpening(chess, speed, rating) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await getOpeningFromLichess(chess, [speed], [rating]);
      return res;
    } catch (err) {
      if (err instanceof TooManyRequests) {
        console.log('hit rate limit, waiting 60 sec');
        await wait(62 * 1000);
      } else {
        throw err;
      }
    }
  }
}

const getTotalMoves = (move) => move.white + move.draws + move.black;

const START_INDEX = 0;

const start = Date.now();
let completed = 0;

const chessFromMoves = (moves) => {
  const chess = new Chess();
  for (const move of moves) {
    chess.move(move);
  }
  return chess;
};

async function getAllPositionsForGroup(lp, speed, rating) {
  const checkedPositions = new Set();
  const positionsToCheck = [new Chess().history()];
  const allResults = [];
  while (positionsToCheck.length > 0) {
    console.log(`${lp}${positionsToCheck.length} positions left in queue`);
    const elapsedMinutes = (Date.now() - start) / (60 * 1000);
    const rate = ((completed / elapsedMinutes) * 60).toFixed(0);
    if (completed % 25 === 0)
      console.log(`${lp}Current rate is ${rate} positions per hour`);
    const pos = chessFromMoves(positionsToCheck.shift());
    // console.log('Checking:');
    // console.log(pos.ascii());
    const res = await retryableGetOpening(pos, speed, rating);
    allResults.push({
      result: { white: res.white, black: res.black, draws: res.draws },
      fen: pos.fen(),
    });
    res.moves.forEach((move) => {
      if (getTotalMoves(move) < MIN_GAME_LIMIT) return;
      pos.move(move.san);
      if (!checkedPositions.has(pos.fen())) {
        positionsToCheck.push(pos.moves());
        checkedPositions.add(pos);
      }
      pos.undo();
    });
    completed++;
  }
  console.log(allResults.length);
  const fileName = `${speed}-${rating}.json`;
  fs.writeFileSync(
    `./data/${MIN_GAME_LIMIT}/${fileName}`,
    JSON.stringify(allResults)
  );
}

async function main() {
  for (let i = START_INDEX; i < PERMUTATIONS.length; i++) {
    const p = PERMUTATIONS[i];
    const logPrefix = `P ${i} of ${PERMUTATIONS.length} | `;
    await getAllPositionsForGroup(logPrefix, p.speed, p.rating);
  }
}

main();
