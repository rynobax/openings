/* eslint-disable @typescript-eslint/no-var-requires */
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { Chess } = require('chess.js');
const fs = require('fs');
const { PERMUTATIONS, TooManyRequests, wait } = require('./util');

const MIN_GAME_LIMIT = 1000;
const MOVES_PER_VARIATION = 50;

async function getOpeningFromLichess(fen, speeds, ratings) {
  const params = new URLSearchParams();
  params.append('fen', fen);
  params.append('speeds', speeds.join(','));
  params.append('ratings', ratings.join(','));
  params.append('moves', MOVES_PER_VARIATION);
  return fetch(`https://explorer.lichess.ovh/lichess?${params}`).then((res) => {
    if (res.status === 429) throw new TooManyRequests();
    if (res.status !== 200) {
      console.error(res);
    }
    return res.json();
  });
}

async function retryableGetOpening(fen, speed, rating) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await getOpeningFromLichess(fen, [speed], [rating]);
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

async function getAllPositionsForGroup(lp, speed, rating) {
  const chess = new Chess();
  const checkedPositions = new Set();
  const positionsToCheck = [chess.fen()];
  const allResults = [];
  while (positionsToCheck.length > 0) {
    console.log(`${lp}${positionsToCheck.length} positions left in queue`);
    const elapsedMinutes = (Date.now() - start) / (60 * 1000);
    const rate = ((completed / elapsedMinutes) * 60).toFixed(0);
    if (completed % 25 === 0)
      console.log(`${lp}Current rate is ${rate} positions per hour`);
    const pos = positionsToCheck.shift();
    // console.log('Checking:');
    // console.log(new Chess(pos).ascii());
    const res = await retryableGetOpening(pos, speed, rating);
    allResults.push({
      result: { white: res.white, black: res.black, draws: res.draws },
      fen: pos,
    });
    res.moves.forEach((move) => {
      if (getTotalMoves(move) < MIN_GAME_LIMIT) return;
      const newGame = new Chess(pos);
      newGame.move(move.san);
      if (checkedPositions.has(newGame.fen())) return;
      positionsToCheck.push(newGame.fen());
      checkedPositions.add(pos);
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