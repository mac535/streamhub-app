const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const { env } = require('./config/env');
const { seedDatabase } = require('./config/database');

async function startServer() {
  try {
    // Seed in-memory database with demo users
    await seedDatabase();
    console.log('✅ In-memory database ready');

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: '*', // Adjust in production
        methods: ['GET', 'POST']
      }
    });

    app.set('io', io);

    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    server.listen(env.PORT, () => {
      console.log('');
      console.log('══════════════════════════════════════════════');
      console.log('  🚀 STREAM Ecosystem API Server');
      console.log('══════════════════════════════════════════════');
      console.log(`  Environment : ${env.NODE_ENV}`);
      console.log(`  Port        : ${env.PORT}`);
      console.log(`  Health      : http://localhost:${env.PORT}/api/health`);
      console.log(`  Database    : In-Memory (JSON-persisted)`);
      console.log(`  SMTP        : ${env.SMTP_USER ? `✅ ${env.SMTP_USER}` : '❌ Not configured'}`);
      console.log('══════════════════════════════════════════════');
      console.log('');
      console.log('  Logins:');
      console.log('  ─────────────────────────────────────');
      console.log(`  Admin           → ${env.ADMIN_EMAIL || 'support@stream.net.in'} / [env password]`);
      console.log('  STREAM Expert   → [email from Excel] / Expert@123 (must change)');
      console.log('  STREAM Hub      → lab@stream.edu / Demo@123');
      console.log('  iLab Corner     → ilab@stream.edu / Demo@123');
      console.log('  Creative Corner → [UDISE+CC code] / Stream@CC2026');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received. Shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down...');
  process.exit(0);
});

startServer();
