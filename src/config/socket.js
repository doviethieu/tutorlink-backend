const { Server } = require('socket.io');
const env = require('./env');

function configureSocket(server, app) {
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  app.set('io', io);
  app.set('socketio', io);

  io.on('connection', (socket) => {
    socket.on('join', (roomId) => {
      if (roomId) socket.join(String(roomId));
    });

    socket.on('join_room', (roomId) => {
      if (roomId) socket.join(String(roomId));
    });

    socket.on('leave_room', (roomId) => {
      if (roomId) socket.leave(String(roomId));
    });

    socket.on('message:send', (payload) => {
      if (payload?.roomId) {
        io.to(String(payload.roomId)).emit('message:new', payload);
      }
    });

    socket.on('send_message', (message) => {
      const roomId = message?.roomId || message?.room;
      if (roomId) socket.to(String(roomId)).emit('receive_message', message);
    });

    socket.on('call:signal', (payload) => {
      if (payload?.roomId) {
        socket.to(String(payload.roomId)).emit('call:signal', payload);
      }
    });
  });

  return io;
}

module.exports = configureSocket;
