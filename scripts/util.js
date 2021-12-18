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

module.exports = { PERMUTATIONS, TooManyRequests, wait };
