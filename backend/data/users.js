import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const users = [
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a1657f'),
    name: 'Admin User',
    email: 'admin@email.com',
    password: bcrypt.hashSync('123456', 10),
    isAdmin: true,
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16580'),
    name: 'John Doe',
    email: 'john@email.com',
    password: bcrypt.hashSync('123456', 10),
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16581'),
    name: 'Jane Doe',
    email: 'jane@email.com',
    password: bcrypt.hashSync('123456', 10),
  },
];

export default users;
