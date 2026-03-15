import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import users from '../data/users.js';
import products from '../data/products.js';

const resetDb = async () => {
  try {
    await Order.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    const createdUsers = await User.insertMany(users);
    const adminUser = createdUsers[0]._id;

    const sampleProducts = products.map((product) => ({
      ...product,
      user: adminUser,
    }));

    await Product.insertMany(sampleProducts);

    console.log(`[${new Date().toISOString()}] Database reset complete`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Database reset failed:`, error);
  }
};

export default resetDb;
