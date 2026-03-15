import mongoose from 'mongoose';

// Seed orders — references are wired up at import time in resetDb.js
// Each order uses indices into the users/products arrays

const orders = [
  // Order 1: John Doe — Airpods + Logitech Mouse (paid, not delivered)
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16588'),
    userIndex: 1, // John Doe
    items: [
      { productIndex: 0, qty: 1 }, // Airpods $89.99
      { productIndex: 4, qty: 2 }, // Logitech Mouse $49.99 x2
    ],
    shippingAddress: {
      address: '123 Main St',
      city: 'Boston',
      postalCode: '02101',
      country: 'US',
    },
    paymentMethod: 'PayPal',
    isPaid: true,
    paidAt: new Date('2026-02-10'),
    isDelivered: false,
  },

  // Order 2: John Doe — iPhone (paid + delivered)
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16589'),
    userIndex: 1, // John Doe
    items: [
      { productIndex: 1, qty: 1 }, // iPhone $599.99
    ],
    shippingAddress: {
      address: '123 Main St',
      city: 'Boston',
      postalCode: '02101',
      country: 'US',
    },
    paymentMethod: 'PayPal',
    isPaid: true,
    paidAt: new Date('2026-01-15'),
    isDelivered: true,
    deliveredAt: new Date('2026-01-20'),
  },

  // Order 3: Jane Doe — PS5 (not paid, not delivered)
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a1658a'),
    userIndex: 2, // Jane Doe
    items: [
      { productIndex: 3, qty: 1 }, // PS5 $399.99
    ],
    shippingAddress: {
      address: '456 Oak Ave',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    },
    paymentMethod: 'PayPal',
    isPaid: false,
    isDelivered: false,
  },

  // Order 4: Jane Doe — Camera + Echo Dot (paid, not delivered)
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a1658b'),
    userIndex: 2, // Jane Doe
    items: [
      { productIndex: 2, qty: 1 }, // Camera $929.99
      { productIndex: 5, qty: 1 }, // Echo Dot $29.99
    ],
    shippingAddress: {
      address: '456 Oak Ave',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    },
    paymentMethod: 'PayPal',
    isPaid: true,
    paidAt: new Date('2026-03-01'),
    isDelivered: false,
  },
];

export default orders;
