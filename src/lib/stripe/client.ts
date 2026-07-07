import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
  appInfo: {
    name: 'BizCompliance',
    version: '0.1.0',
  },
});
