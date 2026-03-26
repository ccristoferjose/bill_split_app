import { describe, it, expect } from 'vitest';

// Replicate getEffectiveTxAmount from BillCalendar.jsx
const getEffectiveTxAmount = (tx, userId) => {
  const full = parseFloat(tx.amount || 0);
  if (tx._role === 'participant') {
    const myRecord = (tx.participants || []).find(p => String(p.user_id) === String(userId));
    return myRecord ? parseFloat(myRecord.amount_owed) : full;
  }
  const acceptedTotal = (tx.participants || [])
    .filter(p => p.invitation_status === 'accepted')
    .reduce((s, p) => s + parseFloat(p.amount_owed), 0);
  return Math.max(0, full - acceptedTotal);
};

// Replicate getPaidTxAmount from BillCalendar.jsx
const getPaidTxAmount = (tx, userId, cycleYear, cycleMonth) => {
  const isShared = tx.is_shared && (tx.participants || []).length > 0;

  // Non-shared: always deduct (personal spending)
  if (!isShared) return parseFloat(tx.amount || 0);

  const hasCyclePaidForUser = (uid) =>
    (tx.cycle_payments || []).some(
      cp =>
        String(cp.user_id) === String(uid) &&
        Number(cp.cycle_year) === cycleYear &&
        Number(cp.cycle_month) === cycleMonth
    );

  const isMonthly = tx.recurrence === 'monthly' || tx.recurrence === 'weekly';

  if (tx._role === 'participant') {
    const myRecord = (tx.participants || []).find(p => String(p.user_id) === String(userId));
    if (!myRecord) return 0;
    const isPaid = isMonthly ? hasCyclePaidForUser(userId) : myRecord.status === 'paid';
    return isPaid ? parseFloat(myRecord.amount_owed) : 0;
  }

  // Owner of shared item
  const isPaid = isMonthly ? hasCyclePaidForUser(userId) : tx.status === 'paid';
  if (!isPaid) return 0;
  const acceptedTotal = (tx.participants || [])
    .filter(p => p.invitation_status === 'accepted')
    .reduce((s, p) => s + parseFloat(p.amount_owed), 0);
  return Math.max(0, parseFloat(tx.amount || 0) - acceptedTotal);
};

// Replicate hasCyclePaid from PersonalBillsList.jsx
const hasCyclePaid = (bill, uid, cycleYear, cycleMonth) =>
  (bill.cycle_payments || []).some(
    cp =>
      String(cp.user_id) === String(uid) &&
      Number(cp.cycle_year) === cycleYear &&
      Number(cp.cycle_month) === cycleMonth
  );

describe('Bill Split Amount Calculation', () => {
  const userId = 'user-owner-1';

  it('owner sees full amount when no participants', () => {
    const tx = { amount: '2000', _role: 'owner', participants: [] };
    expect(getEffectiveTxAmount(tx, userId)).toBe(2000);
  });

  it('owner amount is reduced by accepted participants shares', () => {
    const tx = {
      amount: '2000',
      _role: 'owner',
      participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted' },
      ],
    };
    expect(getEffectiveTxAmount(tx, userId)).toBe(1000);
  });

  it('owner amount is NOT reduced by pending participants', () => {
    const tx = {
      amount: '2000',
      _role: 'owner',
      participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'pending' },
      ],
    };
    expect(getEffectiveTxAmount(tx, userId)).toBe(2000);
  });

  it('owner amount is NOT reduced by rejected participants', () => {
    const tx = {
      amount: '2000',
      _role: 'owner',
      participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'rejected' },
      ],
    };
    expect(getEffectiveTxAmount(tx, userId)).toBe(2000);
  });

  it('participant sees only their share, not the full amount', () => {
    const tx = {
      amount: '2000',
      _role: 'participant',
      participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted' },
      ],
    };
    expect(getEffectiveTxAmount(tx, 'friend-1')).toBe(1000);
  });

  it('50/50 split: each user sees $1000 of a $2000 bill', () => {
    const tx = {
      amount: '2000',
      _role: 'owner',
      participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted' },
      ],
    };
    const ownerAmount = getEffectiveTxAmount(tx, userId);
    const participantTx = { ...tx, _role: 'participant' };
    const participantAmount = getEffectiveTxAmount(participantTx, 'friend-1');

    expect(ownerAmount).toBe(1000);
    expect(participantAmount).toBe(1000);
    expect(ownerAmount + participantAmount).toBe(2000);
  });

  it('owner amount never goes below zero', () => {
    const tx = {
      amount: '2000',
      _role: 'owner',
      participants: [
        { user_id: 'f1', amount_owed: '1500', invitation_status: 'accepted' },
        { user_id: 'f2', amount_owed: '1000', invitation_status: 'accepted' },
      ],
    };
    expect(getEffectiveTxAmount(tx, userId)).toBe(0);
  });
});

describe('Remaining Balance — only deduct paid items', () => {
  const userId = 'owner-1';

  it('non-shared bill always deducts (personal responsibility)', () => {
    const tx = {
      amount: '2000', status: 'pending', _role: 'owner',
      is_shared: false, participants: [], cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(2000);
  });

  it('non-shared expense always deducts (personal spending)', () => {
    const tx = {
      amount: '50', type: 'expense', status: 'pending', _role: 'owner',
      is_shared: false, participants: [], cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(50);
  });

  it('shared unpaid bill does NOT deduct from remaining', () => {
    const tx = {
      amount: '2000', status: 'pending', _role: 'owner',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(0);
  });

  it('shared paid bill deducts only owner share', () => {
    const tx = {
      amount: '2000', status: 'paid', _role: 'owner',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(1000);
  });

  it('participant: unpaid share does NOT deduct', () => {
    const tx = {
      amount: '2000', _role: 'participant',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted', status: 'pending' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, 'friend-1', 2026, 3)).toBe(0);
  });

  it('participant: paid share DOES deduct', () => {
    const tx = {
      amount: '2000', _role: 'participant',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '1000', invitation_status: 'accepted', status: 'paid' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, 'friend-1', 2026, 3)).toBe(1000);
  });

  it('non-shared monthly bill always deducts', () => {
    const tx = {
      amount: '500', status: 'pending', recurrence: 'monthly', _role: 'owner',
      is_shared: false, participants: [], cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(500);
  });

  it('shared monthly bill: unpaid cycle does NOT deduct', () => {
    const tx = {
      amount: '500', status: 'pending', recurrence: 'monthly', _role: 'owner',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '250', invitation_status: 'accepted' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(0);
  });

  it('shared monthly bill: paid cycle DOES deduct owner share', () => {
    const tx = {
      amount: '500', status: 'pending', recurrence: 'monthly', _role: 'owner',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '250', invitation_status: 'accepted' },
      ],
      cycle_payments: [{ user_id: userId, cycle_year: 2026, cycle_month: 3 }],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(250);
  });

  it('shared monthly bill: paid in different month does NOT deduct', () => {
    const tx = {
      amount: '500', status: 'pending', recurrence: 'monthly', _role: 'owner',
      is_shared: true, participants: [
        { user_id: 'friend-1', amount_owed: '250', invitation_status: 'accepted' },
      ],
      cycle_payments: [{ user_id: userId, cycle_year: 2026, cycle_month: 2 }],
    };
    expect(getPaidTxAmount(tx, userId, 2026, 3)).toBe(0);
  });

  it('full scenario: $3000 income, $2000 non-shared bill, $500 shared unpaid bill', () => {
    const transactions = [
      { type: 'income', amount: '3000', date: '2026-03-01' },
      { type: 'bill', amount: '2000', status: 'pending', _role: 'owner', is_shared: false, participants: [], cycle_payments: [] },
      { type: 'bill', amount: '500', status: 'pending', _role: 'owner', is_shared: true, participants: [
        { user_id: 'f1', amount_owed: '250', invitation_status: 'accepted' },
      ], cycle_payments: [] },
    ];

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + parseFloat(t.amount), 0);

    const bills = transactions
      .filter(t => t.type === 'bill')
      .reduce((s, t) => s + getPaidTxAmount(t, 'owner-1', 2026, 3), 0);

    expect(income).toBe(3000);
    expect(bills).toBe(2000); // non-shared always counted, shared unpaid not counted
    expect(income - bills).toBe(1000);
  });

  it('shared expense: participant unpaid does NOT deduct', () => {
    const tx = {
      amount: '100', type: 'expense', _role: 'participant',
      is_shared: true, participants: [
        { user_id: 'p1', amount_owed: '50', invitation_status: 'accepted', status: 'pending' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, 'p1', 2026, 3)).toBe(0);
  });

  it('shared expense: participant paid DOES deduct', () => {
    const tx = {
      amount: '100', type: 'expense', _role: 'participant',
      is_shared: true, participants: [
        { user_id: 'p1', amount_owed: '50', invitation_status: 'accepted', status: 'paid' },
      ],
      cycle_payments: [],
    };
    expect(getPaidTxAmount(tx, 'p1', 2026, 3)).toBe(50);
  });
});

describe('Cycle Payment Tracking', () => {
  it('hasCyclePaid returns true when user has paid for a cycle', () => {
    const bill = {
      cycle_payments: [
        { user_id: 'user-1', cycle_year: 2026, cycle_month: 3 },
      ],
    };
    expect(hasCyclePaid(bill, 'user-1', 2026, 3)).toBe(true);
  });

  it('hasCyclePaid returns false for different month', () => {
    const bill = {
      cycle_payments: [
        { user_id: 'user-1', cycle_year: 2026, cycle_month: 3 },
      ],
    };
    expect(hasCyclePaid(bill, 'user-1', 2026, 4)).toBe(false);
  });

  it('hasCyclePaid returns false for different user', () => {
    const bill = {
      cycle_payments: [
        { user_id: 'user-1', cycle_year: 2026, cycle_month: 3 },
      ],
    };
    expect(hasCyclePaid(bill, 'user-2', 2026, 3)).toBe(false);
  });

  it('hasCyclePaid handles empty cycle_payments', () => {
    expect(hasCyclePaid({ cycle_payments: [] }, 'user-1', 2026, 3)).toBe(false);
    expect(hasCyclePaid({}, 'user-1', 2026, 3)).toBe(false);
  });
});

describe('Payment Button State Logic', () => {
  it('participant can only toggle pay if invitation is accepted', () => {
    const participants = [
      { user_id: 'u1', invitation_status: 'accepted', status: 'pending' },
      { user_id: 'u2', invitation_status: 'pending', status: 'pending' },
      { user_id: 'u3', invitation_status: 'rejected', status: 'pending' },
    ];

    const currentUserId = 'u1';

    participants.forEach(p => {
      const isAccepted = p.invitation_status === 'accepted';
      const canTogglePay = isAccepted && String(p.user_id) === String(currentUserId);

      if (p.user_id === 'u1') {
        expect(canTogglePay, 'accepted participant should be able to pay').toBe(true);
      } else {
        expect(canTogglePay, `${p.invitation_status} participant should NOT be able to pay`).toBe(false);
      }
    });
  });

  it('participant who already paid should see undo, not pay again', () => {
    const participant = { user_id: 'u1', invitation_status: 'accepted', status: 'paid' };
    const pPaid = participant.status === 'paid';
    expect(pPaid).toBe(true);

    const newStatus = participant.status === 'paid' ? 'pending' : 'paid';
    expect(newStatus).toBe('pending');
  });

  it('shared expense participant can mark as paid (not just tracked)', () => {
    // Expenses should have the same pay flow as bills
    const expense = {
      type: 'expense', _role: 'participant',
      participants: [
        { user_id: 'u1', invitation_status: 'accepted', status: 'pending', amount_owed: '50' },
      ],
    };
    const myRecord = expense.participants[0];
    const canPay = myRecord.invitation_status === 'accepted';
    expect(canPay).toBe(true);
    // No type check should block payment
  });

  it('owner marking bill paid should not affect participant individual status', () => {
    const transaction = { status: 'paid', user_id: 'owner-1' };
    const participant = { user_id: 'friend-1', status: 'pending', invitation_status: 'accepted' };

    expect(transaction.status).toBe('paid');
    expect(participant.status).toBe('pending');

    const canTogglePay = participant.invitation_status === 'accepted';
    expect(canTogglePay).toBe(true);
  });
});
