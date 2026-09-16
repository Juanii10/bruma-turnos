import 'dotenv/config';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { startScheduler } from './services/scheduler.js';

runMigrations();

const app = createApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✂️  BRUMA backend escuchando en http://localhost:${PORT}`);
  startScheduler();
});
