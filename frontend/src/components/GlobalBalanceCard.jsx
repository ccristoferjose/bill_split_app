import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, History, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useGetBalanceQuery, useGetBalanceHistoryQuery } from '../services/api';
import { format, parseISO } from 'date-fns';

const TYPE_META = {
  initial_balance:        { color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Starting balance' },
  expense:                { color: 'text-rose-600',   bg: 'bg-rose-50',   label: 'Expense' },
  income:                 { color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Income' },
  bill_payment:           { color: 'text-rose-600',   bg: 'bg-rose-50',   label: 'Bill paid' },
  reimbursement_paid:     { color: 'text-rose-600',   bg: 'bg-rose-50',   label: 'Reimbursed friend' },
  reimbursement_received: { color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Reimbursement received' },
  manual_adjustment:      { color: 'text-gray-600',   bg: 'bg-gray-50',   label: 'Adjustment' },
};

const fmtMoney = (n, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n || 0));
  } catch {
    return `${currency} ${Number(n || 0).toFixed(2)}`;
  }
};

const GlobalBalanceCard = ({ userId }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGetBalanceQuery(userId, { skip: !userId });
  const { data: historyData } = useGetBalanceHistoryQuery(
    { userId, limit: 25 },
    { skip: !userId || !open }
  );

  const balance = Number(data?.balance || 0);
  const currency = data?.currency || 'USD';
  const isNegative = balance < 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
              <Wallet className="h-3.5 w-3.5" />
              {t('balance.title', 'Current balance')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-500"
              onClick={() => setOpen(o => !o)}
            >
              <History className="h-3.5 w-3.5 mr-1" />
              {t('balance.history', 'History')}
              {open ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
            </Button>
          </div>
          <div className={`mt-1 text-3xl sm:text-4xl font-semibold ${isNegative ? 'text-rose-600' : 'text-gray-900'}`}>
            {isLoading ? '…' : fmtMoney(balance, currency)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {t('balance.subtitle', 'Persistent running balance — bills affect this only once marked paid.')}
          </div>
        </div>

        {open && (
          <div className="border-t bg-white">
            {(!historyData?.entries || historyData.entries.length === 0) ? (
              <p className="p-4 text-sm text-gray-500 text-center">
                {t('balance.empty', 'No ledger entries yet.')}
              </p>
            ) : (
              <ul className="divide-y max-h-72 overflow-y-auto">
                {historyData.entries.map(e => {
                  const meta = TYPE_META[e.entry_type] || { color: 'text-gray-700', bg: 'bg-gray-50', label: e.entry_type };
                  const amt = Number(e.amount);
                  const isCredit = amt >= 0;
                  return (
                    <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                          {isCredit
                            ? <TrendingUp className={`h-3.5 w-3.5 ${meta.color}`} />
                            : <TrendingDown className={`h-3.5 w-3.5 ${meta.color}`} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-gray-800 truncate">
                            {e.description || meta.label}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {meta.label} · {format(parseISO(e.occurred_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm font-semibold tabular-nums shrink-0 ml-2 ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '−'}{fmtMoney(Math.abs(amt), currency).replace(/^-/, '')}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GlobalBalanceCard;
