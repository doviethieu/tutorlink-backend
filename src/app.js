const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      name: 'TutorLink API',
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok' },
    error: null,
  });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
