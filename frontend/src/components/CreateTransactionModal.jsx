import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Receipt, CalendarDays, ArrowDownCircle,
  UtensilsCrossed, Car, Popcorn, ShoppingBag, HeartPulse,
  Plane, RefreshCw, Zap, MoreHorizontal,
  Briefcase, Laptop, RotateCcw, Gift,
  CalendarCheck2, CalendarClock, Settings2,
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
  { value: 'custom',  label: 'Custom',  icon: Settings2      },
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

  const [createTransaction, { isLoading }] = useCreateTransactionMutation();
  const { data: friendsData } = useGetFriendsQuery(userId);
  const friends = friendsData?.friends || [];

  // ── helpers ──────────────────────────────────────────────────────────────

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

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
  };

  const toggleFriend = (friend) => {
    setFormData(prev => {
      const exists = prev.participants.find(p => p.userId === friend.id);
      if (exists) {
        return { ...prev, participants: prev.participants.filter(p => p.userId !== friend.id) };
      }
      return {
        ...prev,
        participants: [...prev.participants, { userId: friend.id, username: friend.username, amount: '' }],
      };
    });
  };

  const setParticipantAmount = (friendId, amount) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.map(p => p.userId === friendId ? { ...p, amount } : p),
    }));
  };

  // ── submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          amount_owed: parseFloat(p.amount) || 0,
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
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-1">
              <Label>
                Split with Friends{txType === 'expense' ? ' (optional)' : ''}
              </Label>

              {friends.length === 0 ? (
                <p className="text-xs text-gray-400 mt-1">No friends added yet. Add friends to split transactions.</p>
              ) : (
                <>
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="mt-1 mb-2"
                  />
                  <div className="max-h-36 overflow-y-auto border rounded-lg divide-y">
                    {filteredFriends.map(friend => {
                      const selected = formData.participants.find(p => p.userId === friend.id);
                      return (
                        <div key={friend.id} className="flex items-center gap-2 px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleFriend(friend)}
                            className={[
                              'flex-1 text-left text-sm px-2 py-1 rounded transition-colors',
                              selected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50 text-gray-700',
                            ].join(' ')}
                          >
                            {friend.username}
                          </button>
                          {selected && (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Amount"
                              value={selected.amount}
                              onChange={(e) => setParticipantAmount(friend.id, e.target.value)}
                              className="w-24 h-7 text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {formData.participants.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.participants.length} friend{formData.participants.length > 1 ? 's' : ''} selected
                    </p>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : MODAL_TITLE[txType]}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransactionModal;
