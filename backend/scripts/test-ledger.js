/* eslint-disable no-console */
'use strict';

// End-to-end ledger smoke test. Inserts fixtures, calls ledger.service directly,
// asserts the running balance matches the spec for each scenario.
//
// Run inside the backend container:
//   docker exec billsplit_backend node scripts/test-ledger.js

const { findOne, executeQuery } = require('../config/database');
const ledger = require('../services/ledger.service');

const PASS = '\x1b[32m✔\x1b[0m';
const FAIL = '\x1b[31m✘\x1b[0m';

let failures = 0;
function assertEqual(label, actual, expected) {
  const a = Number(actual).toFixed(2);
  const e = Number(expected).toFixed(2);
  if (a === e) {
    console.log(`  ${PASS} ${label}: $${a}`);
  } else {
    console.log(`  ${FAIL} ${label}: got $${a}, expected $${e}`);
    failures++;
  }
}

async function cleanUsers() {
  // Cascade deletes participants, ledger, etc.
  await executeQuery("DELETE FROM users WHERE id LIKE 'ledger-test-%'");
}

async function makeUser(id, currency = 'USD') {
  await executeQuery(
    `INSERT INTO users (id, username, email, currency) VALUES (?, ?, ?, ?)`,
    [id, id, `${id}@example.com`, currency]
  );
}

(async () => {
  await cleanUsers();

  // ── User A: solo (will own transactions) ─────────────────────────
  await makeUser('ledger-test-A');
  await makeUser('ledger-test-B');
  await makeUser('ledger-test-C');
  const A = 'ledger-test-A';
  const B = 'ledger-test-B';
  const C = 'ledger-test-C';

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 1: Onboarding initial balance = $1000');
  await ledger.recordEntry({
    userId: A, amount: 1000, entryType: 'initial_balance',
    ...ledger.srcInitial(A), description: 'Starting balance',
  });
  assertEqual('A balance', await ledger.getBalance(A), 1000);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 2: Normal expense $100 — immediate debit');
  const ex1 = await executeQuery(
    `INSERT INTO transactions (user_id, type, title, amount, is_shared, status)
     VALUES (?, 'expense', 'Coffee', 100, 0, 'pending')`,
    [A]
  );
  await ledger.recordEntry({
    userId: A, amount: -100, entryType: 'expense',
    ...ledger.srcTransaction(ex1.insertId), description: 'Coffee',
  });
  assertEqual('A balance after $100 expense', await ledger.getBalance(A), 900);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 3: Non-shared bill $200 created → balance unchanged');
  const billSolo = await executeQuery(
    `INSERT INTO transactions (user_id, type, title, amount, is_shared, status)
     VALUES (?, 'bill', 'Electricity', 200, 0, 'pending')`,
    [A]
  );
  assertEqual('A balance after creating $200 bill (unpaid)', await ledger.getBalance(A), 900);

  console.log('  …marking it paid');
  await ledger.recordEntry({
    userId: A, amount: -200, entryType: 'bill_payment',
    ...ledger.srcTransaction(billSolo.insertId), description: 'Electricity',
  });
  assertEqual('A balance after paying $200 bill', await ledger.getBalance(A), 700);

  console.log('  …toggling it back to unpaid');
  await ledger.removeEntry({ userId: A, ...ledger.srcTransaction(billSolo.insertId), entryType: 'bill_payment' });
  assertEqual('A balance after un-paying $200 bill', await ledger.getBalance(A), 900);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 4: Shared expense — A pays $100 dinner; B owes $50');
  // Per spec: A's balance immediately drops by full $100. B owes A.
  // When B marks paid: A gains $50, B loses $50.
  const dinner = await executeQuery(
    `INSERT INTO transactions (user_id, type, title, amount, is_shared, status)
     VALUES (?, 'expense', 'Dinner', 100, 1, 'pending')`,
    [A]
  );
  const dinnerPart = await executeQuery(
    `INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status)
     VALUES (?, ?, 50, 'pending', 'accepted')`,
    [dinner.insertId, B]
  );
  // On create: owner -= full
  await ledger.recordEntry({
    userId: A, amount: -100, entryType: 'expense',
    ...ledger.srcTransaction(dinner.insertId), description: 'Dinner',
  });
  assertEqual('A balance after $100 shared expense', await ledger.getBalance(A), 800);
  assertEqual('B balance before reimbursing', await ledger.getBalance(B), 0);

  // B marks their share paid: friend -= owed, owner += owed
  const dinnerPartId = dinnerPart.insertId;
  await ledger.recordEntry({
    userId: B, amount: -50, entryType: 'reimbursement_paid',
    ...ledger.srcParticipant(dinnerPartId), description: 'Reimbursed Dinner',
  });
  await ledger.recordEntry({
    userId: A, amount: +50, entryType: 'reimbursement_received',
    ...ledger.srcParticipant(dinnerPartId), description: 'Reimbursement from B',
  });
  assertEqual('A balance after B reimburses $50', await ledger.getBalance(A), 850);
  assertEqual('B balance after reimbursing $50', await ledger.getBalance(B), -50);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 5: Shared BILL — $300 split 3 ways. No one debited until each marks own share.');
  const shareBill = await executeQuery(
    `INSERT INTO transactions (user_id, type, title, amount, is_shared, status)
     VALUES (?, 'bill', 'Vacation rental', 300, 1, 'pending')`,
    [A]
  );
  // A is owner, B & C are participants. Each owes $100. Owner portion = 300 - (100+100) = 100.
  const sbB = await executeQuery(
    `INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status)
     VALUES (?, ?, 100, 'pending', 'accepted')`,
    [shareBill.insertId, B]
  );
  const sbC = await executeQuery(
    `INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status)
     VALUES (?, ?, 100, 'pending', 'accepted')`,
    [shareBill.insertId, C]
  );

  const balA0 = await ledger.getBalance(A);
  const balB0 = await ledger.getBalance(B);
  const balC0 = await ledger.getBalance(C);
  console.log(`  (snapshot before any payment — A=$${balA0}, B=$${balB0}, C=$${balC0})`);
  assertEqual('A balance unchanged on shared bill create', await ledger.getBalance(A), 850);
  assertEqual('B balance unchanged on shared bill create', await ledger.getBalance(B), -50);
  assertEqual('C balance unchanged on shared bill create', await ledger.getBalance(C), 0);

  // B marks share paid
  await ledger.recordEntry({
    userId: B, amount: -100, entryType: 'bill_payment',
    ...ledger.srcParticipant(sbB.insertId), description: 'My share of Vacation rental',
  });
  assertEqual('B balance after paying own share', await ledger.getBalance(B), -150);
  assertEqual('A unchanged when B pays own share of bill', await ledger.getBalance(A), 850);
  assertEqual('C unchanged when B pays own share of bill', await ledger.getBalance(C), 0);

  // A pays owner portion (100)
  await ledger.recordEntry({
    userId: A, amount: -100, entryType: 'bill_payment',
    ...ledger.srcTransaction(shareBill.insertId), description: 'Vacation rental (owner share)',
  });
  assertEqual('A balance after paying owner portion', await ledger.getBalance(A), 750);

  // C still unpaid — balance unchanged
  assertEqual('C still unchanged before paying', await ledger.getBalance(C), 0);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 6: Idempotency — re-marking same cycle paid is a no-op');
  const cycleSrc = ledger.srcCycle(999, 2026, 5, 1);
  const r1 = await ledger.recordEntry({
    userId: A, amount: -25, entryType: 'bill_payment', ...cycleSrc,
  });
  const balAfter1 = await ledger.getBalance(A);
  const r2 = await ledger.recordEntry({
    userId: A, amount: -25, entryType: 'bill_payment', ...cycleSrc,
  });
  const balAfter2 = await ledger.getBalance(A);
  assertEqual('First insert applied', balAfter1, 725);
  assertEqual('Duplicate insert is a no-op (idempotent)', balAfter2, 725);
  console.log(`  inserted? first=${r1.inserted}, second=${r2.inserted}`);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 7: Balance persists across months (no monthly reset)');
  // Fresh user — entries spread across 4 months. Sum must accumulate; no slice should drop.
  const M = 'ledger-test-M';
  await makeUser(M);

  const entries = [
    // 3 months ago: starting balance + a paid bill
    { amount: +500, entry: 'initial_balance',   src: 'initial',     id: M,            occurredAt: '2026-02-15 10:00:00' },
    { amount: -120, entry: 'bill_payment',      src: 'transaction', id: 'm-bill-feb', occurredAt: '2026-02-20 10:00:00' },
    // 2 months ago: shared dinner paid full, then friend reimbursed
    { amount: -100, entry: 'expense',           src: 'transaction', id: 'm-tx-mar',   occurredAt: '2026-03-10 19:00:00' },
    { amount: +50,  entry: 'reimbursement_received', src: 'transaction_participant', id: 'm-part-mar', occurredAt: '2026-03-12 12:00:00' },
    // 1 month ago: monthly salary credited; one expense
    { amount: +1000, entry: 'income',           src: 'transaction_cycle', id: 'm-salary:2026:4:M', occurredAt: '2026-04-01 09:00:00' },
    { amount: -200, entry: 'expense',           src: 'transaction', id: 'm-tx-apr',   occurredAt: '2026-04-22 14:00:00' },
    // Current month (May): another expense + bill payment + manual adjustment
    { amount: -75,  entry: 'expense',           src: 'transaction', id: 'm-tx-may',   occurredAt: '2026-05-05 11:00:00' },
    { amount: -40,  entry: 'bill_payment',      src: 'transaction', id: 'm-bill-may', occurredAt: '2026-05-15 11:00:00' },
    { amount: +25,  entry: 'manual_adjustment', src: 'adjustment',  id: 'm-adj-1',    occurredAt: '2026-05-20 11:00:00' },
  ];

  for (const e of entries) {
    await ledger.recordEntry({
      userId: M, amount: e.amount, entryType: e.entry,
      sourceType: e.src, sourceId: e.id,
      description: `${e.entry} ${e.occurredAt.slice(0,7)}`,
      occurredAt: e.occurredAt,
    });
  }

  const expectedTotal = entries.reduce((s, e) => s + e.amount, 0); // 500-120-100+50+1000-200-75-40+25 = 1140
  assertEqual('Multi-month running balance', await ledger.getBalance(M), expectedTotal);

  // Spot-check: history endpoint returns every entry across months
  const hist = await ledger.getHistory(M, { limit: 100 });
  assertEqual('History row count across 4 months', hist.length, entries.length);

  // Spot-check: oldest entry is from Feb, newest from May (ORDER BY occurred_at DESC)
  if (hist[0].occurred_at.toISOString().slice(0,10) !== '2026-05-20') {
    console.log(`  ${FAIL} Newest entry is not 2026-05-20 (got ${hist[0].occurred_at.toISOString()})`); failures++;
  } else {
    console.log(`  ${PASS} Newest entry is 2026-05-20`);
  }
  if (hist[hist.length - 1].occurred_at.toISOString().slice(0,10) !== '2026-02-15') {
    console.log(`  ${FAIL} Oldest entry is not 2026-02-15 (got ${hist[hist.length-1].occurred_at.toISOString()})`); failures++;
  } else {
    console.log(`  ${PASS} Oldest entry is 2026-02-15`);
  }

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 8: Yearly recurring bill — each year is an independent cycle');
  // Yearly bills now go through markTransactionCyclePaid with cycle_week=NULL.
  // Same source_id convention: transaction_cycle:{txId}:{year}:{month}:M (M = "monthly slot")
  const yearlyTx = 5001;
  await ledger.recordEntry({
    userId: M, amount: -300, entryType: 'bill_payment',
    ...ledger.srcCycle(yearlyTx, 2025, 1, null),
    description: 'Insurance 2025',
    occurredAt: '2025-01-15 10:00:00',
  });
  await ledger.recordEntry({
    userId: M, amount: -320, entryType: 'bill_payment',
    ...ledger.srcCycle(yearlyTx, 2026, 1, null),
    description: 'Insurance 2026',
    occurredAt: '2026-01-15 10:00:00',
  });
  // Each year is a distinct cycle key, so both insert successfully.
  assertEqual('Balance after two yearly cycles', await ledger.getBalance(M), expectedTotal - 300 - 320);

  // ─────────────────────────────────────────────────────────────────
  console.log('\n▶ Scenario 9: Recurring income credits the ledger per cycle');
  // Salary: $2000 every month for 2 months.
  const salaryTx = 5002;
  for (const m of [3, 4]) {
    await ledger.recordEntry({
      userId: M, amount: +2000, entryType: 'income',
      ...ledger.srcCycle(salaryTx, 2026, m, null),
      description: `Salary 2026-${String(m).padStart(2,'0')}`,
      occurredAt: `2026-${String(m).padStart(2,'0')}-01 09:00:00`,
    });
  }
  assertEqual('Balance after 2 months recurring income', await ledger.getBalance(M), expectedTotal - 300 - 320 + 4000);

  // Cleanup
  await cleanUsers();

  console.log(failures === 0
    ? `\n${PASS} All ledger scenarios passed.\n`
    : `\n${FAIL} ${failures} assertion(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
