import React, { useState, useMemo } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameDay, isToday,
  addMonths, subMonths, getDay, parseISO
} from 'date-fns';
import {
  useGetUserCreatedBillsQuery,
  useGetUserParticipatingBillsQuery,
  useGetMonthlyPaymentsQuery,
  useGetUserTransactionsQuery,
} from '../services/api';
import {
  ChevronLeft, ChevronRight, Calendar,
  Receipt, CalendarDays, ArrowDownCircle,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BillCard from './BillCard';
import TransactionBillDetailModal from './TransactionBillDetailModal';

// ─── constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TX_CONFIG = {
  expense: {
    icon:         Receipt,
    dotClass:     'bg-red-400',
    bgClass:      'bg-red-50',
    iconColor:    'text-red-500',
    amountColor:  'text-red-500',
    amountPrefix: '-',
    label:        'Expense',
  },
  bill: {
    icon:         CalendarDays,
    dotClass:     'bg-orange-400',
    bgClass:      'bg-orange-50',
    iconColor:    'text-orange-500',
    amountColor:  'text-blue-500',
    amountPrefix: '-',
    label:        'Recurring Bill',
  },
  income: {
    icon:         ArrowDownCircle,
    dotClass:     'bg-green-500',
    bgClass:      'bg-green-50',
    iconColor:    'text-green-600',
    amountColor:  'text-green-600',
    amountPrefix: '+',
    label:        'Income',
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseLocalDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const effectiveBillingDay = (anchorDay, date) =>
  Math.min(anchorDay, endOfMonth(date).getDate());

const isBillActiveOnDate = (bill, date) => {
  if (!bill.bill_date) return false;
  const billDate = parseISO(bill.bill_date);
  if (bill.bill_type === 'monthly') {
    if (date < billDate) return false;
    const anchorDay = billDate.getDate();
    if (date.getDate() !== effectiveBillingDay(anchorDay, date)) return false;
    if (bill.status === 'cancelled' && startOfMonth(date) > startOfMonth(new Date())) return false;
    return true;
  }
  return isSameDay(billDate, date);
};

const isTransactionOnDate = (tx, date) => {
  if (tx.type === 'bill' && tx.recurrence === 'monthly') {
    const startDate = parseLocalDate(tx.due_date);
    if (!startDate) return false;
    // Bill must have started on or before this month
    if (startOfMonth(date) < startOfMonth(startDate)) return false;
    // Show on the anchor day, clamped to last day of each month
    return date.getDate() === Math.min(startDate.getDate(), endOfMonth(date).getDate());
  }
  const txDate = parseLocalDate(tx.type === 'bill' ? tx.due_date : tx.date);
  return txDate ? isSameDay(txDate, date) : false;
};

/**
 * Returns the amount this user is actually responsible for on a transaction,
 * accounting for accepted participant splits.
 */
const getEffectiveTxAmount = (tx, userId) => {
  const full = parseFloat(tx.amount || 0);
  if (tx._role === 'participant') {
    const myRecord = (tx.participants || []).find(p => Number(p.user_id) === Number(userId));
    return myRecord ? parseFloat(myRecord.amount_owed) : full;
  }
  // Owner: subtract accepted participants' shares
  const acceptedTotal = (tx.participants || [])
    .filter(p => p.invitation_status === 'accepted')
    .reduce((s, p) => s + parseFloat(p.amount_owed), 0);
  return Math.max(0, full - acceptedTotal);
};

// ─── MonthlySummary ───────────────────────────────────────────────────────────

const MonthlySummary = ({ income, expenses, bills, month }) => {
  const remaining  = income - expenses - bills;
  const totalSpend = expenses + bills;
  const isOverspent = remaining < 0;

  const base    = Math.max(income, totalSpend, 1);
  const billPct = (bills    / base) * 100;
  const expPct  = Math.min((expenses / base) * 100, 100 - billPct);
  const remPct  = isOverspent ? 0 : Math.max(100 - billPct - expPct, 0);
  const hasData = income > 0 || totalSpend > 0;

  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800">
            {format(month, 'MMMM yyyy')} Summary
          </h2>
          {isOverspent && (
            <Badge className="bg-red-50 text-red-600 border-red-200 text-xs font-medium shrink-0">
              Over by ${fmt(Math.abs(remaining))}
            </Badge>
          )}
        </div>

        {/* Stats grid: 2 cols on mobile, 4 on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Income</p>
            <p className="text-lg sm:text-xl font-bold text-green-600">${fmt(income)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
            <p className="text-lg sm:text-xl font-bold text-red-500">${fmt(expenses)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Bills</p>
            <p className="text-lg sm:text-xl font-bold text-blue-500">${fmt(bills)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
            <p className={`text-lg sm:text-xl font-bold flex items-center gap-1 ${isOverspent ? 'text-red-600' : 'text-gray-800'}`}>
              {isOverspent
                ? <TrendingDown className="h-4 w-4 shrink-0" />
                : <TrendingUp   className="h-4 w-4 shrink-0 text-green-500" />}
              {isOverspent ? '-' : ''}${fmt(remaining)}
            </p>
          </div>
        </div>

        {/* Stacked bar */}
        {hasData ? (
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs text-gray-400 w-12 sm:w-14 shrink-0 text-right tabular-nums">
                ${fmt(income)}
              </span>
              <div className="flex-1 h-4 sm:h-5 rounded-full overflow-hidden flex bg-gray-100">
                {billPct > 0 && (
                  <div
                    className="bg-blue-400 h-full transition-all duration-500"
                    style={{ width: `${billPct}%` }}
                    title={`Bills: $${fmt(bills)}`}
                  />
                )}
                {expPct > 0 && (
                  <div
                    className="bg-red-400 h-full transition-all duration-500"
                    style={{ width: `${expPct}%` }}
                    title={`Expenses: $${fmt(expenses)}`}
                  />
                )}
                {remPct > 0 && (
                  <div
                    className="bg-gray-200 h-full transition-all duration-500"
                    style={{ width: `${remPct}%` }}
                    title={`Remaining: $${fmt(remaining)}`}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />Bills
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Expenses
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-gray-200 border inline-block" />Remaining
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-1">
            No transactions recorded for {format(month, 'MMMM yyyy')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── TransactionRow ───────────────────────────────────────────────────────────

const TransactionRow = ({ transaction, onClick }) => {
  const cfg  = TX_CONFIG[transaction.type] || TX_CONFIG.expense;
  const Icon = cfg.icon;
  const dateStr = transaction.type === 'bill' ? transaction.due_date : transaction.date;
  const txDate  = parseLocalDate(dateStr);

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-100 active:bg-gray-200' : 'hover:bg-gray-50'}`}
      onClick={onClick}
    >
      {/* Icon + text */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${cfg.bgClass} flex items-center justify-center shrink-0`}>
          <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${cfg.iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate leading-tight">{transaction.title}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {cfg.label}
            {transaction.category && <> · <span className="capitalize">{transaction.category}</span></>}
            {txDate && <> · {format(txDate, 'MMM d')}</>}
            {transaction.is_shared && <> · <span className="text-blue-400">Shared</span></>}
          </p>
        </div>
      </div>

      {/* Amount */}
      <span className={`text-sm font-semibold shrink-0 ml-2 tabular-nums ${cfg.amountColor}`}>
        {cfg.amountPrefix}${parseFloat(transaction.amount).toFixed(2)}
      </span>
    </div>
  );
};

// ─── TransactionTimeline ──────────────────────────────────────────────────────

const TransactionTimeline = ({ transactions, currentMonth, onSelectTransaction }) => {
  const groups = useMemo(() => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const monthStart = startOfMonth(currentMonth);

    // Compute the display date key for a tx in the context of currentMonth
    const getDateKey = (tx) => {
      if (tx.type === 'bill' && tx.recurrence === 'monthly') {
        const startDate = parseLocalDate(tx.due_date);
        if (!startDate) return null;
        const effectiveDay = Math.min(startDate.getDate(), endOfMonth(currentMonth).getDate());
        return format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), effectiveDay), 'yyyy-MM-dd');
      }
      return (tx.type === 'bill' ? tx.due_date : tx.date || '').split('T')[0];
    };

    const monthTxs = transactions.filter(tx => {
      if (tx.type === 'bill' && tx.recurrence === 'monthly') {
        const startDate = parseLocalDate(tx.due_date);
        return startDate ? startOfMonth(startDate) <= monthStart : false;
      }
      const raw = tx.type === 'bill' ? tx.due_date : tx.date;
      if (!raw) return false;
      const [y, m] = raw.split('T')[0].split('-').map(Number);
      return y === year && m === month;
    });

    const byDay = {};
    monthTxs.forEach(tx => {
      const key = getDateKey(tx);
      if (!key) return;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(tx);
    });

    return Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions, currentMonth]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Calendar className="h-7 w-7 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No transactions in {format(currentMonth, 'MMMM yyyy')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {groups.map(([dateStr, txs]) => {
        const groupDate   = parseLocalDate(dateStr);
        const isCurrentDay = groupDate ? isToday(groupDate) : false;
        const dateLabel    = groupDate
          ? isCurrentDay
            ? `Today · ${format(groupDate, 'MMM d')}`
            : format(groupDate, 'MMM d, yyyy')
          : dateStr;

        return (
          <div key={dateStr}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 pb-1.5 border-b border-gray-100">
              {dateLabel}
            </p>
            <div>
              {txs.map(tx => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onClick={tx.type === 'bill' && onSelectTransaction ? () => onSelectTransaction(tx) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── BillCalendar ─────────────────────────────────────────────────────────────

const BillCalendar = ({ userId, onSelectBill }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate]  = useState(new Date());
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const { data: createdBills,        refetch: refetchCreated        } = useGetUserCreatedBillsQuery(userId);
  const { data: participatingBills,  refetch: refetchParticipating  } = useGetUserParticipatingBillsQuery(userId);
  const { data: monthlyPaymentsData, refetch: refetchPayments        } = useGetMonthlyPaymentsQuery(userId);
  const { data: transactionsData,    refetch: refetchTransactions    } = useGetUserTransactionsQuery(userId);

  // ── derived data ──────────────────────────────────────────────────────────

  const allBills = useMemo(() => {
    const created       = (createdBills?.bills      || []).map(b => ({ ...b, _isCreator: true  }));
    const participating = (participatingBills?.bills || [])
      .filter(b => !created.some(c => c.id === b.id))
      .map(b => ({ ...b, _isCreator: false }));
    return [...created, ...participating];
  }, [createdBills, participatingBills]);

  const allTransactions = useMemo(
    () => transactionsData?.transactions || [],
    [transactionsData]
  );

  const paidCycles = useMemo(() => {
    const set = new Set();
    for (const p of (monthlyPaymentsData?.payments || [])) {
      set.add(`${p.bill_id}-${p.cycle_year}-${p.cycle_month}`);
    }
    return set;
  }, [monthlyPaymentsData]);

  // ── monthly financial stats ───────────────────────────────────────────────

  const monthlyStats = useMemo(() => {
    const year       = currentMonth.getFullYear();
    const month      = currentMonth.getMonth() + 1;
    const monthStart = startOfMonth(currentMonth);

    const inMonth = (tx, field) => {
      const raw = tx[field];
      if (!raw) return false;
      const [y, m] = raw.split('T')[0].split('-').map(Number);
      return y === year && m === month;
    };

    // Monthly-recurring bills are active every month from their start month onward
    const isMonthlyActive = (tx) => {
      if (tx.type !== 'bill' || tx.recurrence !== 'monthly') return false;
      const startDate = parseLocalDate(tx.due_date);
      return startDate ? startOfMonth(startDate) <= monthStart : false;
    };

    const billFilter = (t) =>
      t.type === 'bill' && (isMonthlyActive(t) || (!t.recurrence && inMonth(t, 'due_date')));

    return {
      income:   allTransactions
        .filter(t => t.type === 'income' && inMonth(t, 'date'))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0),
      expenses: allTransactions
        .filter(t => t.type === 'expense' && inMonth(t, 'date'))
        .reduce((s, t) => s + getEffectiveTxAmount(t, userId), 0),
      bills: allTransactions
        .filter(billFilter)
        .reduce((s, t) => s + getEffectiveTxAmount(t, userId), 0),
    };
  }, [currentMonth, allTransactions, userId]);

  // ── calendar grid ─────────────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const days  = eachDayOfInterval({ start, end: endOfMonth(currentMonth) });
    return [...Array(getDay(start)).fill(null), ...days];
  }, [currentMonth]);

  const dayActivity = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end:   endOfMonth(currentMonth),
    });
    const map = {};
    days.forEach(day => {
      const bills = allBills.filter(b => isBillActiveOnDate(b, day));
      const txs   = allTransactions.filter(t => isTransactionOnDate(t, day));
      if (bills.length > 0 || txs.length > 0) {
        map[day.getDate()] = {
          hasBill:    bills.length > 0,
          hasExpense: txs.some(t => t.type === 'expense'),
          hasBillTx:  txs.some(t => t.type === 'bill'),
          hasIncome:  txs.some(t => t.type === 'income'),
        };
      }
    });
    return map;
  }, [currentMonth, allBills, allTransactions]);

  // ── selected-date items (both service bills AND transactions) ────────────

  const selectedBills = useMemo(
    () => allBills.filter(b => isBillActiveOnDate(b, selectedDate)),
    [selectedDate, allBills]
  );

  const selectedTransactions = useMemo(
    () => allTransactions.filter(t => isTransactionOnDate(t, selectedDate)),
    [selectedDate, allTransactions]
  );

  const handleRefresh = () => {
    refetchCreated();
    refetchParticipating();
    refetchPayments();
    refetchTransactions();
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* 1 ── Monthly financial summary (full width) */}
      <MonthlySummary
        income={monthlyStats.income}
        expenses={monthlyStats.expenses}
        bills={monthlyStats.bills}
        month={currentMonth}
      />

      {/* 2 ── Responsive grid: Calendar (2/3) | Timeline (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">

        {/* ── Left column: calendar + selected-day bills ── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">

          <Card>
            <CardContent className="p-3 sm:p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm sm:text-base font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Prevent overflow on very narrow screens */}
              <div className="overflow-x-auto">
                <div className="min-w-[280px]">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`pad-${i}`} />;
                      const activity     = dayActivity[day.getDate()];
                      const isSelected   = isSameDay(day, selectedDate);
                      const isCurrentDay = isToday(day);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={[
                            'relative h-9 sm:h-10 w-full rounded-lg text-xs sm:text-sm font-medium transition-colors',
                            isSelected    ? 'bg-blue-600 text-white'
                              : isCurrentDay ? 'bg-blue-100 text-blue-700'
                                : 'hover:bg-gray-100 text-gray-700',
                          ].join(' ')}
                        >
                          {day.getDate()}
                          {activity && (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {activity.hasBill && (
                                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                              )}
                              {activity.hasBillTx && (
                                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-400'}`} />
                              )}
                              {activity.hasExpense && (
                                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`} />
                              )}
                              {activity.hasIncome && (
                                <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dot legend */}
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500   inline-block" /> Bill</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Recurring</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400    inline-block" /> Expense</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500  inline-block" /> Income</span>
              </div>
            </CardContent>
          </Card>

          {/* Selected-day activity: service bills + transactions */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d, yyyy')}
              {' '}— {selectedBills.length + selectedTransactions.length} item{selectedBills.length + selectedTransactions.length !== 1 ? 's' : ''}
            </h3>

            {selectedBills.length === 0 && selectedTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity on this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Service bills (existing BillCard system with payment buttons) */}
                {selectedBills.map(bill => (
                  <BillCard
                    key={`bill-${bill.id}`}
                    bill={bill}
                    userId={userId}
                    onSelectBill={onSelectBill}
                    onRefresh={handleRefresh}
                    calendarDate={selectedDate}
                    paidCycles={paidCycles}
                  />
                ))}

                {/* Transactions for this date */}
                {selectedTransactions.length > 0 && (
                  <Card>
                    <CardContent className="p-2 sm:p-3 divide-y divide-gray-50">
                      {selectedTransactions.map(tx => (
                        <TransactionRow
                          key={`tx-${tx.id}`}
                          transaction={tx}
                          onClick={tx.type === 'bill' ? () => setSelectedTransaction(tx) : undefined}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: monthly transaction timeline ── */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardContent className="p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
                {format(currentMonth, 'MMMM yyyy')} Transactions
              </h3>
              {/* Scrollable on desktop so it doesn't grow the page */}
              <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
                <TransactionTimeline
                  transactions={allTransactions}
                  currentMonth={currentMonth}
                  onSelectTransaction={setSelectedTransaction}
                />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {selectedTransaction && (
        <TransactionBillDetailModal
          transaction={selectedTransaction}
          userId={userId}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
};

export default BillCalendar;
