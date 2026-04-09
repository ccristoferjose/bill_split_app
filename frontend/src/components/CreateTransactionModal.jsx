import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Receipt, CalendarDays, ArrowDownCircle,
  UtensilsCrossed, Car, Popcorn, ShoppingBag, HeartPulse,
  Plane, RefreshCw, Zap, MoreHorizontal,
  Briefcase, Laptop, RotateCcw, Gift,
  CalendarCheck2, CalendarClock, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTransactionMutation, useGetFriendsQuery } from '../services/api';
import { useTranslation } from 'react-i18next';

// ─── ChipGroup ────────────────────────────────────────────────────────────────

const ChipGroup = ({ options, value, onChange, activeColor = 'bg-gray-900 text-white border-gray-900' }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(({ value: v, label, icon: Icon }) => {
      const selected = value === v;
      return (
        <button
          key={v}
          type="button"
          onClick={() => onChange(selected ? '' : v)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 select-none',
            selected
              ? activeColor
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50',
          ].join(' ')}
        >
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          {label}
        </button>
      );
    })}
  </div>
);

// ─── component ────────────────────────────────────────────────────────────────

const CreateTransactionModal = ({ isOpen, onClose, userId }) => {
  const { t } = useTranslation();

  const TYPES = [
    {
      id: 'expense',
      label: t('createTransaction.expense'),
      icon: Receipt,
      color: 'text-red-500',
      description: t('createTransaction.expenseDesc'),
      titlePlaceholder: t('createTransaction.expensePlaceholder'),
    },
    {
      id: 'bill',
      label: t('createTransaction.bill'),
      icon: CalendarDays,
      color: 'text-blue-500',
      description: t('createTransaction.billDesc'),
      titlePlaceholder: t('createTransaction.billPlaceholder'),
    },
    {
      id: 'income',
      label: t('createTransaction.income'),
      icon: ArrowDownCircle,
      color: 'text-green-500',
      description: t('createTransaction.incomeDesc'),
      titlePlaceholder: t('createTransaction.incomePlaceholder'),
    },
  ];

  const MODAL_TITLE = {
    expense: t('createTransaction.addExpense'),
    bill: t('createTransaction.addBill'),
    income: t('createTransaction.addIncome'),
  };

  const EXPENSE_CATEGORIES = [
    { value: 'food',          label: t('createTransaction.food'),      icon: UtensilsCrossed },
    { value: 'transport',     label: t('createTransaction.transport'), icon: Car             },
    { value: 'entertainment', label: t('createTransaction.fun'),       icon: Popcorn         },
    { value: 'shopping',      label: t('createTransaction.shopping'),  icon: ShoppingBag     },
    { value: 'health',        label: t('createTransaction.health'),    icon: HeartPulse      },
    { value: 'travel',        label: t('createTransaction.travel'),    icon: Plane           },
    { value: 'subscriptions', label: t('createTransaction.subs'),      icon: RefreshCw       },
    { value: 'utilities',     label: t('createTransaction.utilities'), icon: Zap             },
    { value: 'other',         label: t('createTransaction.other'),     icon: MoreHorizontal  },
  ];

  const INCOME_CATEGORIES = [
    { value: 'salary',    label: t('createTransaction.salary'),    icon: Briefcase      },
    { value: 'freelance', label: t('createTransaction.freelance'), icon: Laptop         },
    { value: 'refund',    label: t('createTransaction.refund'),    icon: RotateCcw      },
    { value: 'bonus',     label: t('createTransaction.bonus'),     icon: Gift           },
    { value: 'other',     label: t('createTransaction.other'),     icon: MoreHorizontal },
  ];

  const RECURRENCE_OPTIONS = [
    { value: 'monthly', label: t('createTransaction.monthly'), icon: CalendarDays   },
    { value: 'weekly',  label: t('createTransaction.weekly'),  icon: CalendarCheck2 },
    { value: 'yearly',  label: t('createTransaction.yearly'),  icon: CalendarClock  },
  ];

  const today = new Date().toISOString().split('T')[0];

  const [txType, setTxType] = useState('expense');
  const [formData, setFormData] = useState({
    title:        '',
    amount:       '',
    date:         today,
    due_date:     '',
    category:     '',
    recurrence:   '',
    recurrence_end_date: '',
    notes:        '',
    participants: [],
  });
  const [friendSearch, setFriendSearch] = useState('');
  const [amountInputValues, setAmountInputValues] = useState({});
  const [percentInputValues, setPercentInputValues] = useState({});

  const [createTransaction, { isLoading }] = useCreateTransactionMutation();
  const { data: friendsData } = useGetFriendsQuery(userId);
  const friends = friendsData?.friends || [];

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const totalAmount = parseFloat(formData.amount) || 0;

  const handleTypeChange = (type) => {
    setTxType(type);
    setFormData(prev => ({
      ...prev,
      date:         today,
      due_date:     '',
      category:     '',
      recurrence:   '',
      recurrence_end_date: '',
      participants: [],
    }));
    setFriendSearch('');
    setAmountInputValues({});
    setPercentInputValues({});
  };

  const redistributeEvenly = (participants) => {
    if (participants.length === 0) return [];
    const totalPeople = participants.length + 1;
    const pct = parseFloat((100 / totalPeople).toFixed(1));
    return participants.map(p => ({ ...p, percentage: pct }));
  };

  const toggleFriend = (friend) => {
    setFormData(prev => {
      const exists = prev.participants.find(p => p.userId === friend.id);
      let updated;
      if (exists) {
        updated = prev.participants.filter(p => p.userId !== friend.id);
      } else {
        updated = [...prev.participants, { userId: friend.id, username: friend.username, percentage: 0 }];
      }
      return { ...prev, participants: redistributeEvenly(updated) };
    });
    setAmountInputValues({});
    setPercentInputValues({});
  };

  const getMaxPercentageForUser = (userId) => {
    const othersTotal = formData.participants
      .filter(p => p.userId !== userId)
      .reduce((sum, p) => sum + (p.percentage || 0), 0);
    return parseFloat(Math.max(0, 100 - othersTotal).toFixed(1));
  };

  const updatePercentage = (userId, value) => {
    const max = getMaxPercentageForUser(userId);
    const num = Math.max(0, Math.min(max, parseFloat(value) || 0));
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.userId === userId ? { ...p, percentage: num } : p),
    }));
  };

  const updateAmount = (userId, value) => {
    if (totalAmount <= 0) return;
    const num = Math.max(0, Math.min(totalAmount, parseFloat(value) || 0));
    const max = getMaxPercentageForUser(userId);
    const percentage = parseFloat(Math.min(max, (num / totalAmount) * 100).toFixed(1));
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.userId === userId ? { ...p, percentage } : p),
    }));
  };

  const handleAmountChange = (userId, value) => {
    setAmountInputValues(prev => ({ ...prev, [userId]: value }));
    if (value !== '' && !isNaN(parseFloat(value))) updateAmount(userId, value);
  };

  const handleAmountBlur = (userId) => {
    setAmountInputValues(prev => { const n = { ...prev }; delete n[userId]; return n; });
  };

  const handlePercentChange = (userId, value) => {
    setPercentInputValues(prev => ({ ...prev, [userId]: value }));
    if (value !== '' && !isNaN(parseFloat(value))) updatePercentage(userId, value);
  };

  const handlePercentBlur = (userId) => {
    setPercentInputValues(prev => { const n = { ...prev }; delete n[userId]; return n; });
  };

  const getTotalPercentage = () =>
    parseFloat(formData.participants.reduce((sum, p) => sum + (p.percentage || 0), 0).toFixed(1));

  const getCreatorPercentage = () =>
    parseFloat(Math.max(0, 100 - getTotalPercentage()).toFixed(1));

  const getCalculatedAmount = (percentage) =>
    ((percentage / 100) * totalAmount).toFixed(2);

  const getParticipantAmountError = (userId, amount) => {
    const raw = amountInputValues[userId];
    const num = raw !== undefined ? parseFloat(raw) : parseFloat(amount);
    if (isNaN(num) || num <= 0) return t('createTransaction.amountMustBeGreater');
    if (num > totalAmount) return t('createTransaction.exceedsTotal', { total: totalAmount.toFixed(2) });
    return null;
  };

  const isSplitValid = () => {
    if (formData.participants.length === 0) return true;
    if (getTotalPercentage() > 100) return false;
    if (formData.participants.some(p => parseFloat(getCalculatedAmount(p.percentage || 0)) <= 0)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.participants.length > 0) {
      if (getTotalPercentage() > 100) {
        toast.error(t('createTransaction.splitExceedsError', { total: getTotalPercentage() }));
        return;
      }
      const zeroUsers = formData.participants.filter(
        p => parseFloat(getCalculatedAmount(p.percentage || 0)) <= 0
      );
      if (zeroUsers.length > 0) {
        toast.error(t('createTransaction.zeroAmountError', { users: zeroUsers.map(p => p.username).join(', ') }));
        return;
      }
    }

    try {
      await createTransaction({
        user_id:      userId,
        type:         txType,
        title:        formData.title,
        amount:       parseFloat(formData.amount),
        date:         txType !== 'bill' ? (formData.date || today) : null,
        due_date:     txType === 'bill' ? (formData.due_date || null) : null,
        category:     formData.category  || null,
        recurrence:   txType === 'bill'  ? (formData.recurrence || null) : null,
        recurrence_end_date: txType === 'bill' && formData.recurrence
          ? (formData.recurrence_end_date || null) : null,
        notes:        formData.notes     || null,
        is_shared:    formData.participants.length > 0,
        participants: formData.participants.map(p => ({
          user_id:     p.userId,
          amount_owed: parseFloat(getCalculatedAmount(p.percentage || 0)),
        })),
      }).unwrap();
      toast.success(t('createTransaction.addedSuccess', { type: MODAL_TITLE[txType] }));
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || t('createTransaction.failedSave'));
    }
  };

  const activeType       = TYPES.find(t => t.id === txType);
  const showSplit        = txType !== 'income';
  const showCategory     = txType !== 'bill';
  const categoryChips    = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const filteredFriends  = friends.filter(f =>
    f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{MODAL_TITLE[txType]}</DialogTitle>
        </DialogHeader>

        {/* ── Segmented type selector ── */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {TYPES.map(({ id, label, icon: Icon, color }) => {
            const active = txType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTypeChange(id)}
                className={[
                  'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all duration-150',
                  active
                    ? 'bg-gray-900 text-white shadow-inner'
                    : 'bg-white text-gray-500 hover:bg-gray-50',
                ].join(' ')}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-white' : color}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Type description ── */}
        <p className="text-xs text-gray-500 text-center -mt-1 mb-1">
          {activeType?.description}
        </p>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Title */}
          <div>
            <Label htmlFor="title">{t('createTransaction.title')} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={activeType?.titlePlaceholder}
              required
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">{t('createTransaction.amount')} *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Date — Expense & Income */}
          {txType !== 'bill' && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="date">{t('createTransaction.date')} *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
          )}

          {/* Due Date — Bill only */}
          {txType === 'bill' && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="due_date">{t('createTransaction.dueDate')} *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                required
              />
            </div>
          )}

          {/* Recurrence — Bill only */}
          {txType === 'bill' && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-2">
              <Label>{t('createTransaction.recurrence')}</Label>
              <ChipGroup
                options={RECURRENCE_OPTIONS}
                value={formData.recurrence}
                onChange={(v) => {
                  set('recurrence', v);
                  if (!v) set('recurrence_end_date', '');
                }}
                activeColor="bg-blue-600 text-white border-blue-600"
              />
            </div>
          )}

          {txType === 'bill' && formData.recurrence && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-2">
              <Label>{t('createTransaction.endDate')}</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="endDateMode"
                    checked={!formData.recurrence_end_date}
                    onChange={() => set('recurrence_end_date', '')}
                    className="accent-blue-600"
                  />
                  {t('createTransaction.indefinite')}
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="endDateMode"
                    checked={!!formData.recurrence_end_date}
                    onChange={() => set('recurrence_end_date', formData.due_date || today)}
                    className="accent-blue-600"
                  />
                  {t('createTransaction.hasEndDate')}
                </label>
              </div>
              {formData.recurrence_end_date && (
                <Input
                  type="date"
                  value={formData.recurrence_end_date}
                  min={formData.due_date || undefined}
                  onChange={(e) => set('recurrence_end_date', e.target.value)}
                />
              )}
            </div>
          )}

          {/* Category */}
          {showCategory && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-2">
              <Label>
                {txType === 'expense' ? `${t('createTransaction.category')} *` : t('createTransaction.categoryOptional')}
              </Label>
              <ChipGroup
                options={categoryChips}
                value={formData.category}
                onChange={(v) => set('category', v)}
                activeColor={txType === 'income' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'}
              />
            </div>
          )}

          {/* Split with Friends */}
          {showSplit && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-3">
              <Label>
                {txType === 'expense' ? t('createTransaction.splitOptional') : t('createTransaction.splitWithFriends')}
              </Label>

              {friends.length === 0 ? (
                <p className="text-xs text-gray-400">{t('createTransaction.noFriends')}</p>
              ) : (
                <>
                  {/* Friend picker */}
                  <Input
                    placeholder={t('createTransaction.searchFriends')}
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                  />
                  <div className="max-h-32 overflow-y-auto border rounded-lg divide-y">
                    {filteredFriends.map(friend => {
                      const selected = formData.participants.find(p => p.userId === friend.id);
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => toggleFriend(friend)}
                          className={[
                            'w-full text-left text-sm px-3 py-2 transition-colors',
                            selected
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'hover:bg-gray-50 text-gray-700',
                          ].join(' ')}
                        >
                          {friend.username}
                          {selected && <span className="ml-2 text-xs text-blue-500">✓ {t('createTransaction.selected')}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Split configuration */}
                  {formData.participants.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-4 bg-gray-50">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{t('createTransaction.splitConfig')}</p>

                      {totalAmount <= 0 && (
                        <p className="text-xs text-amber-600">{t('createTransaction.enterAmount')}</p>
                      )}

                      {formData.participants.map(p => {
                        const amount = getCalculatedAmount(p.percentage || 0);
                        const maxPct = getMaxPercentageForUser(p.userId);
                        const displayAmount = amountInputValues[p.userId] !== undefined ? amountInputValues[p.userId] : amount;
                        const displayPct = percentInputValues[p.userId] !== undefined ? percentInputValues[p.userId] : (p.percentage || 0);
                        const amountError = totalAmount > 0 ? getParticipantAmountError(p.userId, amount) : null;

                        return (
                          <div key={p.userId} className={`p-2.5 border rounded space-y-2 bg-white ${amountError ? 'border-red-300' : 'border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{p.username}</span>
                              <button type="button" onClick={() => toggleFriend({ id: p.userId, username: p.username })}
                                className="text-gray-400 hover:text-gray-600">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Slider */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-xs text-gray-400">
                                <span>0%</span>
                                <span className="font-medium text-gray-600">{p.percentage || 0}%</span>
                                <span className={maxPct < 100 ? 'text-blue-500 font-medium' : ''}>{maxPct}% {t('createTransaction.max')}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max={maxPct}
                                step="0.1"
                                value={p.percentage || 0}
                                onChange={(e) => updatePercentage(p.userId, e.target.value)}
                                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            {/* Amount + % inputs */}
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center flex-1 border rounded overflow-hidden focus-within:ring-1 ${amountError ? 'border-red-400 focus-within:ring-red-400' : 'focus-within:ring-blue-500'}`}>
                                <span className="px-2 text-gray-400 text-xs bg-gray-50 border-r">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={totalAmount || undefined}
                                  step="0.01"
                                  value={displayAmount}
                                  onChange={(e) => handleAmountChange(p.userId, e.target.value)}
                                  onBlur={() => handleAmountBlur(p.userId)}
                                  disabled={totalAmount <= 0}
                                  className="flex-1 px-2 py-1 text-xs outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                                />
                              </div>
                              <div className="flex items-center border rounded overflow-hidden w-20 focus-within:ring-1 focus-within:ring-blue-500">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxPct}
                                  step="0.1"
                                  value={displayPct}
                                  onChange={(e) => handlePercentChange(p.userId, e.target.value)}
                                  onBlur={() => handlePercentBlur(p.userId)}
                                  className="flex-1 px-2 py-1 text-xs outline-none bg-white w-0"
                                />
                                <span className="px-1.5 text-gray-400 text-xs bg-gray-50 border-l">%</span>
                              </div>
                            </div>

                            {amountError && (
                              <p className="text-xs text-red-600">{amountError}</p>
                            )}
                          </div>
                        );
                      })}

                      {/* Summary */}
                      <div className="space-y-1.5 pt-1 border-t">
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{t('createTransaction.splitProgress')}</span>
                            <span className={getTotalPercentage() > 100 ? 'text-red-600 font-medium' : ''}>
                              {getTotalPercentage()}% {t('createTransaction.assigned')}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getTotalPercentage() > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, getTotalPercentage())}%` }}
                            />
                          </div>
                        </div>
                        {getTotalPercentage() > 100 && (
                          <p className="text-xs text-red-600 font-medium">
                            {t('createTransaction.overBy', { amount: (getTotalPercentage() - 100).toFixed(1) })}
                          </p>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">{t('createTransaction.yourShare')}:</span>
                          <Badge variant="outline" className="text-xs py-0">
                            {getCreatorPercentage()}%{totalAmount > 0 ? ` ($${getCalculatedAmount(getCreatorPercentage())})` : ''}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">{t('createTransaction.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('createTransaction.notesPlaceholder')}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isLoading || !isSplitValid()}>
              {isLoading ? t('common.saving') : MODAL_TITLE[txType]}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransactionModal;
