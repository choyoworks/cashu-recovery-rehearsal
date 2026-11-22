import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Mint, Wallet } from '@cashu/cashu-ts';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Official Cashu demo mint. This exercise never pays a Lightning invoice.
const demoMint = 'https://testnut.cashu.space';
const testAmount = 3;
const restoreCounterWindow = 16;

function makeWallet(mint, seed) {
  return new Wallet(mint, { unit: 'sat', bip39seed: seed });
}

function sumAmount(proofs) {
  return proofs.reduce((total, proof) => total + proof.amount.toNumber(), 0);
}

async function ownRestoreResult(wallet, keysetId) {
  const { proofs } = await wallet.restore(0, restoreCounterWindow, { keysetId });
  if (proofs.length === 0) return { signed: 0, spendable: 0 };

  const states = await wallet.checkProofsStates(proofs);
  assert.equal(states.length, proofs.length);
  return {
    signed: sumAmount(proofs),
    spendable: sumAmount(proofs.filter((_, index) => states[index].state === 'UNSPENT')),
  };
}

async function rehearse() {
  const testMint = new Mint(demoMint);
  const info = await testMint.getInfo();
  assert.equal(info.name, 'Testnut mint');

  const seed = mnemonicToSeedSync(generateMnemonic(wordlist));
  const originalWallet = makeWallet(testMint, seed);
  await originalWallet.loadMint();
  let quote = await originalWallet.createMintQuoteBolt11(testAmount);
  for (let attempt = 0; quote.state === 'UNPAID' && attempt < 8; attempt++) {
    await delay(1500);
    quote = await originalWallet.checkMintQuoteBolt11(quote.quote);
  }
  assert.equal(quote.state, 'PAID', 'Test mint did not mark its fake invoice paid');
  const issued = await originalWallet.mintProofsBolt11(
    testAmount,
    quote,
    {},
    { type: 'deterministic', counter: 0 },
  );
  assert.equal(sumAmount(issued), testAmount);
  const keysetId = issued[0].id;

  const recoveredWallet = makeWallet(testMint, seed);
  const differentSeed = mnemonicToSeedSync(generateMnemonic(wordlist));
  const unrelatedWallet = makeWallet(testMint, differentSeed);
  await recoveredWallet.loadMint();
  await unrelatedWallet.loadMint();

  const control = await ownRestoreResult(unrelatedWallet, keysetId);
  assert.deepEqual(control, { signed: 0, spendable: 0 });
  console.log('Fresh different seed: 0 signed, 0 spendable test sats');

  const beforeSpend = await ownRestoreResult(recoveredWallet, keysetId);
  assert.deepEqual(beforeSpend, { signed: testAmount, spendable: testAmount });
  console.log('Original seed and same mint: 3 signed, 3 spendable test sats');

  // Swap the restored proofs into the second test wallet using ecash only.
  // This consumes the originals without issuing any Lightning payment.
  const { proofs: restored } = await recoveredWallet.restore(0, restoreCounterWindow, { keysetId });
  await unrelatedWallet.receive(restored);

  const afterSpend = await ownRestoreResult(recoveredWallet, keysetId);
  assert.deepEqual(afterSpend, { signed: testAmount, spendable: 0 });
  console.log('After the test swap: 3 signed, 0 spendable test sats');
}

const watchdog = setTimeout(() => {
  console.error('The demo mint did not complete the rehearsal within 60 seconds.');
  process.exit(1);
}, 60_000);

try {
  await rehearse();
} catch (error) {
  // Avoid printing test seeds, proofs, quotes or remote response bodies.
  console.error('Recovery rehearsal failed:', error.name, error.code ?? '');
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
