import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import users from '../data/users.js';
import products from '../data/products.js';
import orders from '../data/orders.js';
import { calcPrices } from './calcPrices.js';

const seedUserIds = users.map((u) => u._id);
const seedProductIds = products.map((p) => p._id);
const seedOrderIds = orders.map((o) => o._id);

const resetDb = async () => {
  try {
    // Delete non-seed data (created during demo sessions)
    await Order.deleteMany({ _id: { $nin: seedOrderIds } });
    await Product.deleteMany({ _id: { $nin: seedProductIds } });
    await User.deleteMany({ _id: { $nin: seedUserIds } });

    // Upsert seed users — reset to default values, keep _id stable
    for (const user of users) {
      await User.replaceOne({ _id: user._id }, user, { upsert: true });
    }

    // Upsert seed products
    const adminUser = users[0]._id;
    for (const product of products) {
      await Product.replaceOne(
        { _id: product._id },
        { ...product, user: adminUser },
        { upsert: true }
      );
    }

    // Upsert seed orders
    for (const order of orders) {
      const orderItems = order.items.map((item) => {
        const product = products[item.productIndex];
        return {
          name: product.name,
          qty: item.qty,
          image: product.image,
          price: product.price,
          product: product._id,
        };
      });

      const { itemsPrice, taxPrice, shippingPrice, totalPrice } =
        calcPrices(orderItems);

      await Order.replaceOne(
        { _id: order._id },
        {
          _id: order._id,
          user: users[order.userIndex]._id,
          orderItems,
          shippingAddress: order.shippingAddress,
          paymentMethod: order.paymentMethod,
          itemsPrice,
          taxPrice,
          shippingPrice,
          totalPrice,
          isPaid: order.isPaid,
          paidAt: order.paidAt,
          isDelivered: order.isDelivered,
          deliveredAt: order.deliveredAt,
        },
        { upsert: true }
      );
    }

    console.log(`[${new Date().toISOString()}] Database reset complete`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Database reset failed:`, error);
  }
};

export default resetDb;
