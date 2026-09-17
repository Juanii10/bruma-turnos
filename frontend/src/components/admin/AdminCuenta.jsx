import { useState } from 'react';
import { changeAdminPassword } from '../../lib/api.js';

export default function AdminCuenta() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('La nueva contraseña tiene que tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña');
      return;
    }

    setBusy(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-6 space-y-5">
        <div>
          <h2 className="font-display text-xl text-ink mb-1">Cambiar contraseña</h2>
          <p className="text-xs text-ink-soft">
            Si estás usando la contraseña de prueba que vino con el proyecto, cambiala acá antes de
            empezar a usarlo con clientes reales.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-copper-light/40 border border-copper/30 px-3 py-2 text-sm text-copper-dark">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-100 border border-green-300 px-3 py-2 text-sm text-green-800">
            Contraseña actualizada correctamente.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Contraseña actual</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-copper px-5 py-2 text-sm font-semibold text-cream hover:bg-copper-dark disabled:opacity-40"
          >
            {busy ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
