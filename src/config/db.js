const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  console.log('[database] connecting to MongoDB...');
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
    serverSelectionTimeoutMS: 15000,
  });
  console.log('[database] connected to MongoDB');
}

module.exports = connectDB;
