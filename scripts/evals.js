/* eslint-disable @typescript-eslint/no-var-requires */
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
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

async function getEvalFromLichess(fen) {
  const params = new URLSearchParams();
  params.append('fen', fen);
  return fetch(`https://lichess.org/api/cloud-eval?${params}`).then((res) => {
    if (res.status === 429) throw new TooManyRequests();
    if (res.status !== 200) {
      console.error(res);
    }
    return res.json();
  });
}

async function main() {
  const positions = new Set();
  for (const { speed, rating } of PERMUTATIONS) {
    const data = require(`../data/10000/${speed}-${rating}.json`);
    data.forEach(({ fen }) => {
      positions.add(fen);
    });
  }
  console.log(positions.size);
}

main();
