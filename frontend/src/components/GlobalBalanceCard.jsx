import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useGetGlobalBalanceQuery } from '../services/api';
import { useTranslation } from 'react-i18next';

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', MXN: '$', CAD: '$', AUD: '$',
  JPY: '¥', BRL: 'R$', ARS: '$', COP: '$', CLP: '$', PEN: 'S/', UYU: '$',
};

const formatMoney = (amount, currency) => {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const n = Number(amount || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${symbol}${abs}`;
};

const CurrencyRow = ({ currency, balance, lastMonthClosing, isPrimary }) => {
  const { t } = useTranslation();
  const delta = balance - lastMonthClosing;
  const isPositive = balance >= 0;
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className={isPrimary ? 'space-y-1' : 'flex items-baseline justify-between'}>
      <div className="flex items-baseline gap-2">
        <span className={isPrimary ? 'text-xs uppercase tracking-wide text-gray-500' : 'text-xs text-gray-500'}>
          {currency}
        </span>
        {isPrimary && (
          <span className="text-xs text-gray-400">{t('globalBalance.title')}</span>
        )}
      </div>
      <div className={isPrimary ? 'flex items-baseline gap-3 flex-wrap' : 'flex items-baseline gap-2'}>
        <span
          className={[
            isPrimary ? 'text-3xl font-semibold' : 'text-sm font-semibold',
            isPositive ? 'text-green-700' : 'text-red-600',
          ].join(' ')}
        >
          {formatMoney(balance, currency)}
        </span>
        <span
          className={[
            'flex items-center gap-0.5 text-xs',
            delta >= 0 ? 'text-green-600' : 'text-red-500',
          ].join(' ')}
          title={t('globalBalance.lastMonthClosing', { amount: formatMoney(lastMonthClosing, currency) })}
        >
          <DeltaIcon className="h-3 w-3" />
          {formatMoney(delta, currency)}
        </span>
      </div>
    </div>
  );
};

const GlobalBalanceCard = ({ userId }) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetGlobalBalanceQuery({ userId }, { skip: !userId });

  if (isLoading || error || !data) {
    return null;
  }

  const { balances, preferredCurrency } = data;
  const entries = Object.entries(balances || {});
  if (entries.length === 0) return null;

  const primary = balances[preferredCurrency];
  const others = entries.filter(([c]) => c !== preferredCurrency);

  return (
    <Card className="mb-4 sm:mb-6 border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
      <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Wallet className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            {primary && (
              <CurrencyRow
                currency={preferredCurrency}
                balance={primary.balance}
                lastMonthClosing={primary.lastMonthClosing}
                isPrimary
              />
            )}
            {others.length > 0 && (
              <div className="pt-2 border-t border-blue-100 space-y-1.5">
                {others.map(([currency, b]) => (
                  <CurrencyRow
                    key={currency}
                    currency={currency}
                    balance={b.balance}
                    lastMonthClosing={b.lastMonthClosing}
                    isPrimary={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalBalanceCard;
