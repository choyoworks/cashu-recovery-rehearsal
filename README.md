# Rehearse a Cashu wallet recovery with test funds

A seed recovery can find old signatures without recovering a spendable balance. This exercise reproduces both outcomes against Cashu's official demo mint. It uses two new disposable seeds and three demo sats, and waits for the mint to settle its own simulated invoice. It requires no existing wallet, account, deposit or Lightning payment.

## Run the rehearsal

Use Node.js 24 and npm in an empty working directory. Save [the reproduction script](nutnovember-cashu-recovery.mjs) there. Install the pinned public SDK and mnemonic library, then run the script.

```sh
npm install --ignore-scripts --no-audit --no-fund --save-exact @cashu/cashu-ts@4.13.1 @scure/bip39@2.0.1
node nutnovember-cashu-recovery.mjs
```

The script talks only to `https://testnut.cashu.space`. It creates its own seeds in memory. It prints amounts and states without printing seeds, bearer proofs, or invoices. A test invoice that remains unpaid causes the exercise to stop. [Cashu demo mint documentation](https://docs.cashu.space/faq)

| Case | Signed test sats | Spendable test sats |
| --- | ---: | ---: |
| Same mint and keyset, new unrelated seed | 0 | 0 |
| Same mint and keyset, original seed | 3 | 3 |
| Original seed after the original proofs are swapped into a separate test wallet | 3 | 0 |

The demo mints deterministic outputs, creates a fresh wallet from the original seed, and restores through the same mint and keyset. The first restore asks for signatures matching the regenerated blinded messages. The state check that follows determines which proofs remain unspent. Swapping consumes the old proofs and creates new ones for the second test wallet. [Signature restoration](https://cashubtc.github.io/nuts/09/) · [Proof states](https://cashubtc.github.io/nuts/07/) · [Deterministic recovery](https://cashubtc.github.io/nuts/13/)

## Apply the result to your backup

- Save the seed securely and keep the exact mint URLs and units used by the wallet. Restore with a wallet that supports seed recovery for the relevant mints and keysets. Keep the old installation or backup available until the recovered balance is verified. [Cashu wallet-seed FAQ](https://docs.cashu.space/faq)
- An empty result from a reachable mint means no matching signatures were found in the counters searched. Verify the seed, original mint URL, unit, keyset coverage and scan range before drawing a conclusion. A mint that times out or cannot be reached leaves recovery unresolved.
- A signature match followed by a spent state identifies a proof the mint has already consumed. A pending state needs a later check. Use only proofs the mint reports unspent in a spendable balance. [Proof-state definitions](https://cashubtc.github.io/nuts/07/)
- A real recovery must cover the relevant historical keysets and enough counters for the original wallet's usage. This rehearsal scans 16 counters on the single known keyset used for the three test sats. The protocol describes the wider batch scan expected of recovery tools. [NUT-13 restore batches](https://cashubtc.github.io/nuts/13/#restoring-batches)

The rehearsal was verified on Windows with Node.js 24.22.3 against Testnut on November 22, 2026 JST. It addresses wallet recovery while a mint still has the signatures and can answer queries. Keep separate recovery expectations for an unavailable mint.
