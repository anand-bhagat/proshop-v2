import mongoose from 'mongoose';

// Stable user IDs for review references
const adminId = new mongoose.Types.ObjectId('69b64053d65b699270a1657f');
const johnId = new mongoose.Types.ObjectId('69b64053d65b699270a16580');
const janeId = new mongoose.Types.ObjectId('69b64053d65b699270a16581');

const products = [
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16582'),
    name: 'Airpods Wireless Bluetooth Headphones',
    image: '/images/airpods.jpg',
    description:
      'Bluetooth technology lets you connect it with compatible devices wirelessly High-quality AAC audio offers immersive listening experience Built-in microphone allows you to take calls while working',
    brand: 'Apple',
    category: 'Electronics',
    price: 89.99,
    countInStock: 10,
    rating: 4.5,
    numReviews: 2,
    reviews: [
      { name: 'John Doe', rating: 5, comment: 'Great sound quality and easy to pair with my phone.', user: johnId },
      { name: 'Jane Doe', rating: 4, comment: 'Good value for the price. Battery life could be better.', user: janeId },
    ],
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16583'),
    name: 'iPhone 13 Pro 256GB Memory',
    image: '/images/phone.jpg',
    description:
      'Introducing the iPhone 13 Pro. A transformative triple-camera system that adds tons of capability without complexity. An unprecedented leap in battery life',
    brand: 'Apple',
    category: 'Electronics',
    price: 599.99,
    countInStock: 7,
    rating: 4,
    numReviews: 3,
    reviews: [
      { name: 'John Doe', rating: 5, comment: 'Best phone I have ever owned. Camera is incredible.', user: johnId },
      { name: 'Jane Doe', rating: 3, comment: 'Solid phone but overpriced compared to competitors.', user: janeId },
      { name: 'Admin User', rating: 4, comment: 'Fast performance and great display.', user: adminId },
    ],
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16584'),
    name: 'Cannon EOS 80D DSLR Camera',
    image: '/images/camera.jpg',
    description:
      'Characterized by versatile imaging specs, the Canon EOS 80D further clarifies itself using a pair of robust focusing systems and an intuitive design',
    brand: 'Cannon',
    category: 'Electronics',
    price: 929.99,
    countInStock: 5,
    rating: 0,
    numReviews: 0,
    reviews: [],
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16585'),
    name: 'Sony Playstation 5',
    image: '/images/playstation.jpg',
    description:
      'The ultimate home entertainment center starts with PlayStation. Whether you are into gaming, HD movies, television, music',
    brand: 'Sony',
    category: 'Electronics',
    price: 399.99,
    countInStock: 11,
    rating: 5,
    numReviews: 3,
    reviews: [
      { name: 'John Doe', rating: 5, comment: 'Amazing console. Load times are basically zero.', user: johnId },
      { name: 'Jane Doe', rating: 5, comment: 'The graphics are unbelievable. Worth every penny.', user: janeId },
      { name: 'Admin User', rating: 5, comment: 'Best gaming console on the market right now.', user: adminId },
    ],
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16586'),
    name: 'Logitech G-Series Gaming Mouse',
    image: '/images/mouse.jpg',
    description:
      'Get a better handle on your games with this Logitech LIGHTSYNC gaming mouse. The six programmable buttons allow customization for a smooth playing experience',
    brand: 'Logitech',
    category: 'Electronics',
    price: 49.99,
    countInStock: 7,
    rating: 0,
    numReviews: 0,
    reviews: [],
  },
  {
    _id: new mongoose.Types.ObjectId('69b64053d65b699270a16587'),
    name: 'Amazon Echo Dot 3rd Generation',
    image: '/images/alexa.jpg',
    description:
      'Meet Echo Dot - Our most popular smart speaker with a fabric design. It is our most compact smart speaker that fits perfectly into small space',
    brand: 'Amazon',
    category: 'Electronics',
    price: 29.99,
    countInStock: 0,
    rating: 4,
    numReviews: 3,
    reviews: [
      { name: 'John Doe', rating: 4, comment: 'Great little speaker for the price. Alexa works well.', user: johnId },
      { name: 'Jane Doe', rating: 5, comment: 'Perfect for my kitchen. Love the smart home controls.', user: janeId },
      { name: 'Admin User', rating: 3, comment: 'Sound quality is okay for its size. Mic picks up well.', user: adminId },
    ],
  },
];

export default products;
