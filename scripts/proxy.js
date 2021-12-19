/* eslint-disable @typescript-eslint/no-var-requires */
const fetch = require('node-fetch');
const { wait } = require('./util');
const HttpsProxyAgent = require('https-proxy-agent');

const ONE_SECOND = 1000;
const TIME_TO_WAIT_AFTER_RATE_LIMIT = ONE_SECOND * 62;

const MAX_THREADS = 10;

class Proxy {
  constructor(url) {
    this.agent = new HttpsProxyAgent(url);
  }

  canBeUsed = () => {
    const timeSinceLastRateLimited = Date.now() - this.lastRateLimitedAt;
    return (
      !this.inUse && timeSinceLastRateLimited > TIME_TO_WAIT_AFTER_RATE_LIMIT
    );
  };

  lastRateLimitedAt = 0;
  inUse = false;
}

class ProxyManager {
  constructor(proxyInfo) {
    this.proxies = proxyInfo.map((info) => new Proxy(info));
  }

  inProgress = 0;

  getAvailableProxy = async () => {
    for (let i = 0; i < 100; i++) {
      const available = this.proxies.find((p) => p.canBeUsed());
      if (available) return available;
      await wait(3000);
    }
    throw Error('Could not find available proxy');
  };

  fetch = async (url) => {
    const { agent } = await this.getAvailableProxy();
    console.log({ agent });
    try {
      const res = await fetch(url, { agent });
      if (res.status !== 200) {
        console.log(res);
      }
      return res.json();
    } catch (err) {
      console.error(err);
    }
  };

  fetchAll = async (urls, fn) => {
    const pending = new Map();
    for (const url of urls) {
      if (pending.size > MAX_THREADS) {
        // wait
        await Promise.race(pending.values());
      }
      const p = this.fetch(url);
      pending.set(url, p);
      p.then((res) => {
        fn(res);
        pending.delete(url);
      });
    }
  };
}

const manager = new ProxyManager([{ host: '209.127.191.180', port: '9279' }]);

const FAKE_URL =
  'http://explorer.lichess.ovh/masters?play=d2d4,d7d5,c2c4,c7c6,c4d5';

async function main() {
  manager.fetchAll([FAKE_URL], (res) => {
    console.log(res);
  });
}

main();
