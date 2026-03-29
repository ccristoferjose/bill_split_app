import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Wallet, Users, Receipt, CalendarDays, TrendingUp, Globe, ChevronRight, Crown,
} from 'lucide-react';

const WelcomeModal = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

  const handleLanguage = (lang) => {
    i18n.changeLanguage(lang);
  };

  const handleFinish = () => {
    onClose();
  };

  const handleUpgrade = () => {
    onClose();
    navigate('/subscription');
  };

  // Step 0: Language selection
  // Step 1: Features overview
  // Step 2: Free vs upgrade CTA

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>

        {step === 0 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <Globe className="h-6 w-6 text-indigo-600" />
              </div>
              <DialogTitle className="text-xl">{t('welcome.langTitle')}</DialogTitle>
              <DialogDescription>{t('welcome.langDesc')}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 my-4">
              <button
                onClick={() => handleLanguage('en')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  currentLang === 'en'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">EN</span>
                <span className="text-sm font-medium text-gray-700">English</span>
              </button>
              <button
                onClick={() => handleLanguage('es')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  currentLang === 'es'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">ES</span>
                <span className="text-sm font-medium text-gray-700">Español</span>
              </button>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setStep(1)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
                {t('welcome.continue')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader className="text-center items-center">
              <DialogTitle className="text-xl">{t('welcome.featuresTitle')}</DialogTitle>
              <DialogDescription>{t('welcome.featuresDesc')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-4">
              {[
                { icon: Wallet, color: 'text-green-600 bg-green-100', label: t('welcome.featureTransactions') },
                { icon: CalendarDays, color: 'text-blue-600 bg-blue-100', label: t('welcome.featureCalendar') },
                { icon: Receipt, color: 'text-amber-600 bg-amber-100', label: t('welcome.featureBills') },
                { icon: TrendingUp, color: 'text-purple-600 bg-purple-100', label: t('welcome.featureBudget') },
                { icon: Users, color: 'text-teal-600 bg-teal-100', label: t('welcome.featureSplit') },
              ].map(({ icon: Icon, color, label }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
              ))}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="text-gray-500">
                {t('welcome.back')}
              </Button>
              <Button onClick={() => setStep(2)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6">
                {t('welcome.continue')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader className="text-center items-center">
              <DialogTitle className="text-xl">{t('welcome.planTitle')}</DialogTitle>
              <DialogDescription>{t('welcome.planDesc')}</DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-3">
              {/* Free plan summary */}
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800">{t('welcome.freePlan')}</span>
                  <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase">{t('welcome.currentPlan')}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                    {t('welcome.freeFeature1')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                    {t('welcome.freeFeature2')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                    {t('welcome.freeFeature3')}
                  </li>
                </ul>
              </div>

              {/* Plus/Pro upsell */}
              <div className="p-4 rounded-lg border border-teal-200 bg-teal-50">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-800">{t('welcome.upgradeTitle')}</span>
                </div>
                <p className="text-xs text-teal-700">{t('welcome.upgradeDesc')}</p>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-gray-500">
                {t('welcome.back')}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleFinish}>
                  {t('welcome.startFree')}
                </Button>
                <Button size="sm" onClick={handleUpgrade} className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Crown className="h-3.5 w-3.5 mr-1" />
                  {t('welcome.viewPlans')}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
