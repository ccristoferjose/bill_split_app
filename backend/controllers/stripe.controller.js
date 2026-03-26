'use strict';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { findOne, executeQuery } = require('../config/database');

const PRICE_MAP = {
  plus_monthly: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID,
  plus_yearly: process.env.STRIPE_PLUS_YEARLY_PRICE_ID,
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
};

const PRICE_TO_TIER = {};
PRICE_TO_TIER[process.env.STRIPE_PLUS_MONTHLY_PRICE_ID] = 'plus';
PRICE_TO_TIER[process.env.STRIPE_PLUS_YEARLY_PRICE_ID] = 'plus';
PRICE_TO_TIER[process.env.STRIPE_PRO_MONTHLY_PRICE_ID] = 'pro';
PRICE_TO_TIER[process.env.STRIPE_PRO_YEARLY_PRICE_ID] = 'pro';

/**
 * POST /stripe/create-checkout-session
 * Creates a Stripe Checkout session for the user to subscribe.
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body; // e.g. "plus_monthly", "pro_yearly"
    const userId = req.user.userId;

    const priceId = PRICE_MAP[plan];
    if (!priceId || priceId === 'PENDING') {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    const user = await findOne('SELECT id, email, stripe_customer_id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Reuse existing Stripe customer or create a new one
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await executeQuery('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?tab=profile&checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?tab=profile&checkout=cancelled`,
      metadata: { userId },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Checkout session error:', error);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
};

/**
 * POST /stripe/manage
 * Creates a Stripe Customer Portal session for managing subscriptions.
 */
const createPortalSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await findOne('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);

    if (!user?.stripe_customer_id) {
      return res.status(400).json({ message: 'No active subscription' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard?tab=profile`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Portal session error:', error);
    res.status(500).json({ message: 'Failed to create portal session' });
  }
};

/**
 * POST /stripe/webhook
 * Stripe sends events here when subscriptions change.
 * Must use raw body (not JSON parsed).
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      const tier = PRICE_TO_TIER[priceId] || 'free';
      const userId = session.metadata?.userId;

      if (userId) {
        await executeQuery('UPDATE users SET subscription_tier = ?, stripe_customer_id = ? WHERE id = ?',
          [tier, session.customer, userId]);
        console.log(`[Stripe] User ${userId} upgraded to ${tier}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const tier = PRICE_TO_TIER[priceId] || 'free';
      const customerId = subscription.customer;

      await executeQuery('UPDATE users SET subscription_tier = ? WHERE stripe_customer_id = ?',
        [tier, customerId]);
      console.log(`[Stripe] Customer ${customerId} plan changed to ${tier}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      await executeQuery("UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = ?",
        [customerId]);
      console.log(`[Stripe] Customer ${customerId} subscription cancelled → free`);
      break;
    }

    default:
      break;
  }

  res.json({ received: true });
};

module.exports = { createCheckoutSession, createPortalSession, handleWebhook };
