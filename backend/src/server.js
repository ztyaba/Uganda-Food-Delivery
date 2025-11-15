const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const apiRouter = require('./routes');
const { ensureDatabase } = require('./utils/bootstrap');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 4000;

ensureDatabase(path.join(__dirname, 'db', 'database.json'));

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { err });
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Unexpected server error'
  });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`API listening on port ${PORT}`);
});

module.exports = { app, server };
