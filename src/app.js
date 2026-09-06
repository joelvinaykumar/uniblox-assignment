const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Express backend API',
    docs: '/api/health',
  });
});

app.use('/api/health', healthRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
});

app.use((err, req, res, _next) => {
  console.error(err);

  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Something went wrong',
  });
});

module.exports = app;
