import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, Minus, ArrowLeft, Loader2, CreditCard, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  useGetUserProfileQuery,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
} from '../services/api';

const SubscriptionPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { data: profile, isLoading: isProfileLoading } = useGetUserProfileQuery(user?.id, { skip: !user });
  const [createCheckout, { isLoading: isCheckingOut }] = useCreateCheckoutSessionMutation();
  const [createPortal, { isLoading: isPortalLoading }] = useCreatePortalSessionMutation();
  const [yearlyBilling, setYearlyBilling] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);

  const currentTier = profile?.subscription_tier || 'free';

  const handleUpgrade = async (plan) => {
    setLoadingPlan(plan);
    try {
      const { url } = await createCheckout({ plan }).unwrap();
      window.location.href = url;
    } catch (err) {
      toast.error('Failed to start checkout');
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await createPortal().unwrap();
      window.location.href = url;
    } catch (err) {
      toast.error('Failed to open subscription management');
    }
  };

  const plans = [
    {
      id: 'free',
      name: t('landing.pricingFree'),
      desc: t('landing.pricingFreeDesc'),
      monthlyPrice: 0,
      yearlyPrice: 0,
      color: 'gray',
      features: [
        { text: `10 ${t('landing.pricingTransactions')}`, included: true },
        { text: `3 ${t('landing.pricingSharedBills')}`, included: true },
        { text: `3 ${t('landing.pricingFriends')}`, included: true },
        { text: `1 ${t('landing.pricingRecurring')}`, included: true },
        { text: t('landing.pricingBudgetCurrent'), included: true },
        { text: t('landing.pricingEmailNotifications'), included: false },
        { text: t('landing.pricingSmartReminders'), included: false },
        { text: t('landing.pricingSplitTemplates'), included: false },
        { text: t('landing.pricingHousehold'), included: false },
        { text: t('landing.pricingExport'), included: false },
        { text: t('landing.pricingForecasting'), included: false },
      ],
    },
    {
      id: 'plus',
      name: t('landing.pricingPlus'),
      desc: t('landing.pricingPlusDesc'),
      monthlyPrice: 2.99,
      yearlyPrice: 29.99,
      color: 'teal',
      popular: true,
      checkoutKey: yearlyBilling ? 'plus_yearly' : 'plus_monthly',
      features: [
        { text: t('landing.pricingUnlimitedTransactions'), included: true },
        { text: `10 ${t('landing.pricingSharedBills')}`, included: true },
        { text: `10 ${t('landing.pricingFriends')}`, included: true },
        { text: `10 ${t('landing.pricingRecurringPlural')}`, included: true },
        { text: t('landing.pricingBudget6'), included: true },
        { text: t('landing.pricingEmailNotifications'), included: true },
        { text: t('landing.pricingBasicReminders'), included: true },
        { text: `3 ${t('landing.pricingSplitTemplates')}`, included: true },
        { text: t('landing.pricingHousehold'), included: false },
        { text: t('landing.pricingExport'), included: false },
        { text: t('landing.pricingForecasting'), included: false },
      ],
    },
    {
      id: 'pro',
      name: t('landing.pricingPro'),
      desc: t('landing.pricingProDesc'),
      monthlyPrice: 7.99,
      yearlyPrice: 79.99,
      color: 'purple',
      checkoutKey: yearlyBilling ? 'pro_yearly' : 'pro_monthly',
      features: [
        { text: t('landing.pricingUnlimitedTransactions'), included: true },
        { text: t('landing.pricingUnlimitedBills'), included: true },
        { text: t('landing.pricingUnlimitedFriends'), included: true },
        { text: t('landing.pricingUnlimitedRecurring'), included: true },
        { text: t('landing.pricingBudgetFull'), included: true },
        { text: t('landing.pricingEmailNotifications'), included: true },
        { text: t('landing.pricingSmartReminders'), included: true },
        { text: t('landing.pricingUnlimitedTemplates'), included: true },
        { text: t('landing.pricingHousehold'), included: true },
        { text: t('landing.pricingExport'), included: true },
        { text: t('landing.pricingMoveInOut'), included: true },
        { text: t('landing.pricingForecasting'), included: true },
      ],
    },
  ];

  const tierOrder = { free: 0, plus: 1, pro: 2 };

  const colorMap = {
    gray: {
      border: 'border-gray-200',
      activeBorder: 'border-gray-400 ring-2 ring-gray-200',
      badge: 'bg-gray-100 text-gray-700',
      button: 'bg-gray-200 text-gray-600',
      check: 'text-gray-400',
      price: 'text-gray-800',
    },
    teal: {
      border: 'border-gray-200',
      activeBorder: 'border-teal-400 ring-2 ring-teal-100',
      badge: 'bg-teal-100 text-teal-700',
      button: 'bg-teal-600 hover:bg-teal-700 text-white',
      check: 'text-teal-500',
      price: 'text-teal-700',
    },
    purple: {
      border: 'border-gray-200',
      activeBorder: 'border-purple-400 ring-2 ring-purple-100',
      badge: 'bg-purple-100 text-purple-700',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      check: 'text-purple-500',
      price: 'text-purple-700',
    },
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard?tab=profile')}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('landing.backHome')}
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {t('profile.choosePlan')}
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            {t('landing.pricingSubtitle')}
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm font-medium transition-colors ${!yearlyBilling ? 'text-gray-900' : 'text-gray-400'}`}>
              {t('landing.pricingMonthly')}
            </span>
            <button
              onClick={() => setYearlyBilling(!yearlyBilling)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${yearlyBilling ? 'bg-teal-500' : 'bg-gray-300'}`}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow"
                style={{ left: yearlyBilling ? '1.625rem' : '0.125rem' }}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${yearlyBilling ? 'text-gray-900' : 'text-gray-400'}`}>
              {t('landing.pricingYearly')}
            </span>
            {yearlyBilling && (
              <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                {t('landing.pricingSave')}
              </Badge>
            )}
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const isUpgrade = tierOrder[plan.id] > tierOrder[currentTier];
            const isDowngrade = tierOrder[plan.id] < tierOrder[currentTier];
            const colors = colorMap[plan.color];
            const price = yearlyBilling ? plan.yearlyPrice : plan.monthlyPrice;
            const isLoading = loadingPlan === plan.checkoutKey;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col transition-all duration-300 ${
                  isCurrent ? colors.activeBorder : colors.border
                } ${plan.popular && !isCurrent ? 'shadow-lg' : ''}`}
              >
                {/* Current plan badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className={`${colors.badge} text-xs font-semibold px-3`}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t('landing.pricingCurrentPlan')}
                    </Badge>
                  </div>
                )}

                {/* Popular badge */}
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-teal-600 text-white text-xs font-semibold px-3">
                      {t('landing.pricingMostPopular')}
                    </Badge>
                  </div>
                )}

                <CardContent className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className={`text-3xl font-extrabold ${colors.price}`}>
                      ${price.toFixed(2)}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {yearlyBilling ? t('landing.pricingYr') : t('landing.pricingMo')}
                    </span>
                    {yearlyBilling && plan.monthlyPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        ${(plan.yearlyPrice / 12).toFixed(2)}{t('landing.pricingMo')} · {t('landing.pricingBilledYearly')}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  {isCurrent ? (
                    <Button
                      variant="outline"
                      className="w-full mb-6"
                      disabled={isPortalLoading || currentTier === 'free'}
                      onClick={currentTier !== 'free' ? handleManage : undefined}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {currentTier === 'free' ? t('landing.pricingCurrentPlan') : t('profile.managePlan')}
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className={`w-full mb-6 ${colors.button}`}
                      disabled={isLoading || isCheckingOut}
                      onClick={() => handleUpgrade(plan.checkoutKey)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>{t('profile.upgrade')} to {plan.name}</>
                      )}
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      className="w-full mb-6 text-gray-500"
                      disabled={isPortalLoading}
                      onClick={handleManage}
                    >
                      {t('profile.downgrade')}
                    </Button>
                  ) : null}

                  {/* Features list */}
                  <ul className="space-y-2.5 text-sm flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className={`flex items-start gap-2 ${f.included ? 'text-gray-700' : 'text-gray-400'}`}>
                        {f.included ? (
                          <Check className={`h-4 w-4 mt-0.5 shrink-0 ${colors.check}`} />
                        ) : (
                          <Minus className="h-4 w-4 mt-0.5 shrink-0 text-gray-300" />
                        )}
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default SubscriptionPage;
