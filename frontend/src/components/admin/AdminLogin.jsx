import { useState } from 'react';
import { adminLogin, setAdminToken } from '../../lib/api.js';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await adminLogin(email, password);
      setAdminToken(token);
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto rounded-2xl border border-ink/10 bg-white/70 p-8">
      <h1 className="font-display text-2xl mb-1">Panel de administración</h1>
      <p className="text-sm text-ink-soft mb-6">BRUMA — acceso para el equipo</p>

      {error && (
        <div className="mb-4 rounded-lg bg-copper-light/40 border border-copper/30 px-3 py-2 text-sm text-copper-dark">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-soft mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
            placeholder="admin@bruma.test"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-soft mb-1">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream disabled:opacity-40 hover:bg-ink/90"
        >
          {busy ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
