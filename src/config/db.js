const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { autoIndex: env.nodeEnv !== 'production' });
  console.log('[database] connected to MongoDB');
}

module.exports = connectDB;
