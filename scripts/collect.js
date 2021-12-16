/* eslint-disable @typescript-eslint/no-var-requires */
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { Chess } = require('chess.js');

const OPENING_BASE = 'https://explorer.lichess.ovh/lichess';

async function getOpeningFromLichess(fen) {
  const params = new URLSearchParams();
  params.append('fen', fen);
  const speeds = ['blitz', 'rapid', 'classical', 'correspondence'];
  params.append('speeds', speeds.join(','));
  const ratings = [2000, 2200, 2500];
  params.append('ratings', ratings.join(','));
  const res = await fetch(`${OPENING_BASE}?${params}`).then((e) => e.json());
  console.log(res);
}

async function main() {
  const chess = new Chess();
  await getOpeningFromLichess(chess.fen());
}

main();
