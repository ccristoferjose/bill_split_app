import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Receipt, CalendarDays, ArrowDownCircle,
  UtensilsCrossed, Car, Popcorn, ShoppingBag, HeartPulse,
  Plane, RefreshCw, Zap, MoreHorizontal,
  Briefcase, Laptop, RotateCcw, Gift,
  CalendarCheck2, CalendarClock, Settings2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTransactionMutation, useGetFriendsQuery } from '../services/api';

// ─── constants ────────────────────────────────────────────────────────────────

const TYPES = [
  {
    id: 'expense',
    label: 'Expense',
    icon: Receipt,
    color: 'text-red-500',
    description: 'Track a one-time purchase or spending event.',
    titlePlaceholder: 'e.g., Starbucks Coffee',
  },
  {
    id: 'bill',
    label: 'Bill',
    icon: CalendarDays,
    color: 'text-blue-500',
    description: 'Track a recurring payment like rent or subscriptions.',
    titlePlaceholder: 'e.g., Netflix, Rent',
  },
  {
    id: 'income',
    label: 'Income',
    icon: ArrowDownCircle,
    color: 'text-green-500',
    description: 'Track money received such as salary or freelance work.',
    titlePlaceholder: 'e.g., Monthly Salary',
  },
];

const MODAL_TITLE = { expense: 'Add Expense', bill: 'Add Recurring Bill', income: 'Add Income' };

const EXPENSE_CATEGORIES = [
  { value: 'food',          label: 'Food',          icon: UtensilsCrossed },
  { value: 'transport',     label: 'Transport',     icon: Car             },
  { value: 'entertainment', label: 'Fun',            icon: Popcorn         },
  { value: 'shopping',      label: 'Shopping',      icon: ShoppingBag     },
  { value: 'health',        label: 'Health',        icon: HeartPulse      },
  { value: 'travel',        label: 'Travel',        icon: Plane           },
  { value: 'subscriptions', label: 'Subs',          icon: RefreshCw       },
  { value: 'utilities',     label: 'Utilities',     icon: Zap             },
  { value: 'other',         label: 'Other',         icon: MoreHorizontal  },
];

const INCOME_CATEGORIES = [
  { value: 'salary',    label: 'Salary',    icon: Briefcase      },
  { value: 'freelance', label: 'Freelance', icon: Laptop         },
  { value: 'refund',    label: 'Refund',    icon: RotateCcw      },
  { value: 'bonus',     label: 'Bonus',     icon: Gift           },
  { value: 'other',     label: 'Other',     icon: MoreHorizontal },
];

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly', icon: CalendarDays   },
  { value: 'weekly',  label: 'Weekly',  icon: CalendarCheck2 },
  { value: 'yearly',  label: 'Yearly',  icon: CalendarClock  },
];

// Dropdown-compatible lists (kept for the hidden fallback selects)
const EXPENSE_CATEGORIES_FLAT = EXPENSE_CATEGORIES.map(c => c.label);
const INCOME_CATEGORIES_FLAT  = INCOME_CATEGORIES.map(c => c.label);

const today = new Date().toISOString().split('T')[0];

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
  const [txType, setTxType] = useState('expense');
  const [formData, setFormData] = useState({
    title:        '',
    amount:       '',
    date:         today,
    due_date:     '',
    category:     '',
    recurrence:   '',
    notes:        '',
    participants: [],
  });
  const [friendSearch, setFriendSearch] = useState('');
  const [amountInputValues, setAmountInputValues] = useState({});
  const [percentInputValues, setPercentInputValues] = useState({});

  const [createTransaction, { isLoading }] = useCreateTransactionMutation();
  const { data: friendsData } = useGetFriendsQuery(userId);
  const friends = friendsData?.friends || [];

  // ── helpers ──────────────────────────────────────────────────────────────

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
      participants: [],
    }));
    setFriendSearch('');
    setAmountInputValues({});
    setPercentInputValues({});
  };

  // Redistribute percentages evenly across all participants (excluding creator)
  const redistributeEvenly = (participants) => {
    if (participants.length === 0) return [];
    const totalPeople = participants.length + 1; // +1 for creator
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

  // ── split helpers ─────────────────────────────────────────────────────────

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
    if (isNaN(num) || num <= 0) return 'Amount must be greater than $0';
    if (num > totalAmount) return `Exceeds total $${totalAmount.toFixed(2)}`;
    return null;
  };

  const isSplitValid = () => {
    if (formData.participants.length === 0) return true;
    if (getTotalPercentage() > 100) return false;
    if (formData.participants.some(p => parseFloat(getCalculatedAmount(p.percentage || 0)) <= 0)) return false;
    return true;
  };

  // ── submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.participants.length > 0) {
      if (getTotalPercentage() > 100) {
        toast.error(`Split total exceeds 100% (${getTotalPercentage()}%). Adjust the split.`);
        return;
      }
      const zeroUsers = formData.participants.filter(
        p => parseFloat(getCalculatedAmount(p.percentage || 0)) <= 0
      );
      if (zeroUsers.length > 0) {
        toast.error(`${zeroUsers.map(p => p.username).join(', ')} would owe $0. Adjust the split.`);
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
        notes:        formData.notes     || null,
        is_shared:    formData.participants.length > 0,
        participants: formData.participants.map(p => ({
          user_id:     p.userId,
          amount_owed: parseFloat(getCalculatedAmount(p.percentage || 0)),
        })),
      }).unwrap();
      toast.success(`${MODAL_TITLE[txType]} added successfully!`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save transaction');
    }
  };

  // ── derived ──────────────────────────────────────────────────────────────

  const activeType       = TYPES.find(t => t.id === txType);
  const showSplit        = txType !== 'income';
  const showCategory     = txType !== 'bill';
  const categoryChips    = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const categoryFlat     = txType === 'income' ? INCOME_CATEGORIES_FLAT : EXPENSE_CATEGORIES_FLAT;

  const filteredFriends  = friends.filter(f =>
    f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  // ── render ───────────────────────────────────────────────────────────────

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
            <Label htmlFor="title">Title *</Label>
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
            <Label htmlFor="amount">Amount *</Label>
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
              <Label htmlFor="date">Date *</Label>
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
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                required
              />
            </div>
          )}

          {/* Recurrence — Bill only (pill chips + dropdown fallback) */}
          {txType === 'bill' && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-2">
              <Label>Recurrence *</Label>
              <ChipGroup
                options={RECURRENCE_OPTIONS}
                value={formData.recurrence}
                onChange={(v) => set('recurrence', v)}
                activeColor="bg-blue-600 text-white border-blue-600"
              />
              
            </div>
          )}

          {/* Category — icon chips + dropdown fallback */}
          {showCategory && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1 space-y-2">
              <Label>
                Category{txType === 'expense' ? ' *' : ' (optional)'}
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
                Split with Friends{txType === 'expense' ? ' (optional)' : ''}
              </Label>

              {friends.length === 0 ? (
                <p className="text-xs text-gray-400">No friends added yet. Add friends to split transactions.</p>
              ) : (
                <>
                  {/* Friend picker */}
                  <Input
                    placeholder="Search friends..."
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
                          {selected && <span className="ml-2 text-xs text-blue-500">✓ selected</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Split configuration */}
                  {formData.participants.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-4 bg-gray-50">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Split Configuration</p>

                      {totalAmount <= 0 && (
                        <p className="text-xs text-amber-600">Enter an amount above to see dollar values.</p>
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
                                <span className={maxPct < 100 ? 'text-blue-500 font-medium' : ''}>{maxPct}% max</span>
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
                            <span>Split progress</span>
                            <span className={getTotalPercentage() > 100 ? 'text-red-600 font-medium' : ''}>
                              {getTotalPercentage()}% assigned
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
                            Over by {(getTotalPercentage() - 100).toFixed(1)}%. Reduce one or more shares.
                          </p>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">Your share:</span>
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
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Add any additional notes..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !isSplitValid()}>
              {isLoading ? 'Saving...' : MODAL_TITLE[txType]}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransactionModal;
