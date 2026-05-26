import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Globe, Wallet, ChevronRight, Check } from 'lucide-react';
import { useCompleteOnboardingMutation } from '../services/api';
import { toast } from 'sonner';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'ARS', label: 'Argentine Peso' },
  { code: 'CLP', label: 'Chilean Peso' },
  { code: 'COP', label: 'Colombian Peso' },
  { code: 'PEN', label: 'Peruvian Sol' },
];

const OnboardingModal = ({ open, userId, onClose }) => {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language?.startsWith('es') ? 'es' : 'en');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [completeOnboarding, { isLoading }] = useCompleteOnboardingMutation();

  const handleLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const handleFinish = async () => {
    const initial = initialBalance === '' ? 0 : Number(initialBalance);
    if (!Number.isFinite(initial)) {
      toast.error(t('onboarding.invalidBalance', 'Please enter a valid number'));
      return;
    }
    try {
      await completeOnboarding({
        userId,
        language,
        currency,
        initial_balance: initial,
      }).unwrap();
      toast.success(t('onboarding.complete', 'Welcome! Your account is ready.'));
      onClose();
    } catch (err) {
      // 409 → already onboarded; just close.
      if (err?.data?.already_completed) {
        onClose();
        return;
      }
      toast.error(err?.data?.message || t('onboarding.failed', 'Could not save setup'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* must complete — no dismiss */ }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>

        {/* Step 0 — language */}
        {step === 0 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <Globe className="h-6 w-6 text-indigo-600" />
              </div>
              <DialogTitle className="text-xl">
                {t('onboarding.langTitle', 'Choose your language')}
              </DialogTitle>
              <DialogDescription>
                {t('onboarding.langDesc', 'You can change this anytime from settings.')}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 my-4">
              {[{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }].map(L => (
                <button
                  key={L.code}
                  onClick={() => handleLanguage(L.code)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    language === L.code ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{L.code.toUpperCase()}</span>
                  <span className="text-sm font-medium text-gray-700">{L.label}</span>
                </button>
              ))}
            </div>

            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setStep(1)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
                {t('onboarding.continue', 'Continue')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 1 — currency + initial balance */}
        {step === 1 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <Wallet className="h-6 w-6 text-emerald-600" />
              </div>
              <DialogTitle className="text-xl">
                {t('onboarding.balanceTitle', 'Set up your balance')}
              </DialogTitle>
              <DialogDescription>
                {t('onboarding.balanceDesc', "Pick your currency and tell us what's in your account today. This becomes your starting balance.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('onboarding.currency', 'Currency')}
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('onboarding.initialBalance', 'Current balance')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('onboarding.initialHint', 'Leave 0 if starting fresh. You can adjust this later in settings.')}
                </p>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="text-gray-500">
                {t('onboarding.back', 'Back')}
              </Button>
              <Button
                onClick={handleFinish}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
              >
                <Check className="h-4 w-4 mr-1" />
                {isLoading
                  ? t('onboarding.saving', 'Saving…')
                  : t('onboarding.finish', "I'm ready")}
              </Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
