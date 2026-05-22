const { Server } = require('socket.io');
const env = require('./env');

function configureSocket(server, app) {
  const io = new Server(server, {
    cors: {
      origin: env.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  app.set('socketio', io);

  io.on('connection', (socket) => {
    socket.on('join_room', (roomId) => {
      if (roomId) socket.join(roomId.toString());
    });

    socket.on('leave_room', (roomId) => {
      if (roomId) socket.leave(roomId.toString());
    });

    socket.on('send_message', (message) => {
      const roomId = message?.roomId || message?.room;
      if (roomId) socket.to(roomId.toString()).emit('receive_message', message);
    });
  });

  return io;
}

module.exports = configureSocket;
