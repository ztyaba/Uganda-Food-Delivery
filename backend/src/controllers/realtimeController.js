const { registerClient, sendDirect } = require('../utils/realtime');
const { verifyToken } = require('../utils/token');
const { findById } = require('../models/userModel');

function resolveChannelsForUser(user) {
  const channels = new Set([`role:${user.role}`, `user:${user.id}`]);
  if (user.role === 'vendor') {
    channels.add(`vendor:${user.id}`);
  }
  if (user.role === 'driver') {
    channels.add(`driver:${user.id}`);
  }
  if (user.role === 'customer') {
    channels.add(`customer:${user.id}`);
  }
  return Array.from(channels);
}

function stream(req, res) {
  const token = req.query.token;
  if (!token) {
    res.writeHead(401, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'close'
    });
    sendDirect(res, 'realtime:error', { message: 'Authentication required' });
    res.end();
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = findById(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const channels = resolveChannelsForUser(user);
    const unregister = registerClient(res, channels);
    sendDirect(res, 'realtime:ready', { user: { id: user.id, role: user.role } });

    const heartbeat = setInterval(() => {
      sendDirect(res, 'ping', { ts: Date.now() });
    }, 25000);

    const close = () => {
      clearInterval(heartbeat);
      unregister();
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', close);
    req.on('end', close);
    res.on('close', close);
  } catch (error) {
    res.writeHead(401, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'close'
    });
    sendDirect(res, 'realtime:error', { message: 'Authentication failed' });
    res.end();
  }
}

module.exports = {
  stream
};
