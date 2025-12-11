import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import type { Shop } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_THEME_ID, type ThemePaletteId } from '../theme/palettes';

const getTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  return token && token.trim().length > 0 ? token.trim() : null;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ShopSetup: React.FC = () => {
  const { setTheme, themeId } = useTheme();
  const inviteToken = useMemo(() => getTokenFromUrl(), []);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ shop: Shop; link: string } | null>(null);

  const [form, setForm] = useState({
    slug: 'retro-barbershop',
    name: '',
    address: '',
    postal_code: '',
    city: '',
    province: '',
    phone: '',
    whatsapp: '',
    email: '',
    notification_email: '',
    description: '',
    theme_palette: (themeId as ThemePaletteId) || DEFAULT_THEME_ID,
  });

  useEffect(() => {
    const validate = async () => {
      if (!inviteToken) {
        setError('Token di invito mancante o non valido.');
        setIsValidating(false);
        return;
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import type { Shop } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_THEME_ID, type ThemePaletteId } from '../theme/palettes';

const getTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  return token && token.trim().length > 0 ? token.trim() : null;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ShopSetup: React.FC = () => {
  const { setTheme, themeId } = useTheme();
  const inviteToken = useMemo(() => getTokenFromUrl(), []);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ shop: Shop; link: string } | null>(null);

  const [form, setForm] = useState({
    slug: 'retro-barbershop',
    name: '',
    address: '',
    postal_code: '',
    city: '',
    province: '',
    phone: '',
    whatsapp: '',
    email: '',
    notification_email: '',
    description: '',
    theme_palette: (themeId as ThemePaletteId) || DEFAULT_THEME_ID,
  });

  useEffect(() => {
    const validate = async () => {
      if (!inviteToken) {
        setError('Token di invito mancante o non valido.');
        setIsValidating(false);
        return;
      }
      const valid = await apiService.validateShopInvite(inviteToken);
      if (!valid) {
        setError('Link di invito non valido o scaduto.');
        setTokenValid(false);
      } else {
        setTokenValid(true);
      }
      setIsValidating(false);
    };
    void validate();
  }, [inviteToken]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'slug' ? slugify(value) : value,
    }));
  };

  const handleThemeChange = (paletteId: ThemePaletteId) => {
    setForm((prev) => ({
      ...prev,
      theme_palette: paletteId,
    }));
    setTheme(paletteId, { persist: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) {
      setError('Token di invito mancante o non valido.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const shop = await apiService.createShop({
        slug: form.slug || slugify(form.name || 'shop'),
        name: form.name || 'Nuovo negozio',
        address: form.address || undefined,
        postal_code: form.postal_code || undefined,
        city: form.city || undefined,
        province: form.province || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        notification_email: form.notification_email || undefined,
        description: form.description || undefined,
        theme_palette: form.theme_palette || DEFAULT_THEME_ID,
      });

      try {
        await apiService.markShopInviteUsed(inviteToken, shop.id);
      } catch (markError) {
        console.warn('Impossibile marcare il token come usato:', markError);
      }

      const link = `${window.location.origin}?shop=${shop.slug || form.slug}`;
      setTheme((shop.theme_palette as ThemePaletteId) || form.theme_palette || DEFAULT_THEME_ID);
      setSuccess({ shop, link });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del negozio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center bg-white text-black">
      <Card className="p-8 max-w-4xl w-full space-y-6 bg-white text-black border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo Poltrona 2025.png" alt="Logo Poltrona" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-black">BENVENUTO/A in POLTRONA</p>
            <h1 className="text-2xl font-bold text-black">Setup negozio</h1>
          </div>
        </div>
        {children}
      </Card>
    </div>
  );

  if (isValidating) {
    return (
      <Wrapper>
        <p className="text-black">Verifica del link in corso...</p>
      </Wrapper>
    );
  }

  if (!tokenValid) {
    return (
      <Wrapper>
        <Card className="p-6 w-full bg-white text-black border border-gray-200">
          <h1 className="text-xl font-bold mb-2 text-black">Link non valido</h1>
          <p className="text-sm text-black">Il link di invito non è valido o è scaduto.</p>
        </Card>
      </Wrapper>
    );
  }

  if (success) {
    return (
      <Wrapper>
        <Card className="p-6 w-full space-y-3 bg-white text-black border border-gray-200">
          <h1 className="text-xl font-bold text-black">Negozio creato!</h1>
          <p className="text-black">{success.shop.name} è stato creato con successo.</p>
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-black">
            <p className="text-sm">
              Link registrazione clienti:<br />
              <strong>{success.link}</strong>
            </p>
          </div>
          <p className="text-sm text-black">
            Condividi il link o genera un QR code per i tuoi clienti. Il QR già stampato senza slug continuerà a puntare al negozio di default.
          </p>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            required
          />
          <Input
            label="Nome negozio"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
          <Input
            label="Indirizzo"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
          />
          <Input
            label="CAP"
            value={form.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
          />
          <Input
            label="Città"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
          />
          <Input
            label="Provincia"
            value={form.province}
            onChange={(e) => handleChange('province', e.target.value)}
          />
          <Input
            label="Telefono"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => handleChange('whatsapp', e.target.value)}
          />
          <Input
            label="Email negozio"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          <Input
            label="Email notifiche"
            type="email"
            value={form.notification_email}
            onChange={(e) => handleChange('notification_email', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-1">Descrizione</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white text-black"
            rows={3}
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <ThemeSelector
            value={form.theme_palette as ThemePaletteId}
            onChange={handleThemeChange}
            title="Palette negozio"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creazione in corso...' : 'Crea negozio'}
        </Button>
      </form>
    </Wrapper>
  );
      }
      const valid = await apiService.validateShopInvite(inviteToken);
      if (!valid) {
        setError('Link di invito non valido o scaduto.');
        setTokenValid(false);
      } else {
        setTokenValid(true);
      }
      setIsValidating(false);
    };
    void validate();
  }, [inviteToken]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'slug' ? slugify(value) : value,
    }));
  };

  const handleThemeChange = (paletteId: ThemePaletteId) => {
    setForm((prev) => ({
      ...prev,
      theme_palette: paletteId,
    }));
    setTheme(paletteId, { persist: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) {
      setError('Token di invito mancante o non valido.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const shop = await apiService.createShop({
        slug: form.slug || slugify(form.name || 'shop'),
        name: form.name || 'Nuovo negozio',
        address: form.address || undefined,
        postal_code: form.postal_code || undefined,
        city: form.city || undefined,
        province: form.province || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        notification_email: form.notification_email || undefined,
        description: form.description || undefined,
        theme_palette: form.theme_palette || DEFAULT_THEME_ID,
      });

      try {
        await apiService.markShopInviteUsed(inviteToken, shop.id);
      } catch (markError) {
        console.warn('Impossibile marcare il token come usato:', markError);
      }

      const link = `${window.location.origin}?shop=${shop.slug || form.slug}`;
      setTheme((shop.theme_palette as ThemePaletteId) || form.theme_palette || DEFAULT_THEME_ID);
      setSuccess({ shop, link });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del negozio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-on-surface">Verifica del link in corso...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4 text-on-surface">Link non valido</h1>
          <p className="text-muted">Il link di invito non è valido o è scaduto.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-lg w-full space-y-4">
          <h1 className="text-2xl font-bold text-on-surface">Negozio creato!</h1>
          <p className="text-on-surface">
            {success.shop.name} è stato creato con successo.
          </p>
          <div className="surface-card-alt border border-[color-mix(in_srgb,var(--theme-border)_30%,transparent)] rounded-lg p-3">
            <p className="text-sm text-on-surface break-all">
              Link registrazione clienti:<br />
              <strong>{success.link}</strong>
            </p>
          </div>
          <p className="text-sm text-muted">
            Condividi il link o genera un QR code per i tuoi clienti. Il QR già stampato senza slug continuerà a puntare al negozio di default.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 max-w-2xl w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Setup negozio</h1>
          <p className="text-muted">Completa i dati per creare il tuo negozio.</p>
        </div>

        {error && (
          <div className="bg-[color-mix(in_srgb,var(--theme-danger)_10%,var(--theme-surface))] border border-[color-mix(in_srgb,var(--theme-danger)_40%,transparent)] text-on-surface p-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              required
            />
            <Input
              label="Nome negozio"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
            <Input
              label="Indirizzo"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
            <Input
              label="CAP"
              value={form.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
            />
            <Input
              label="Città"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
            <Input
              label="Provincia"
              value={form.province}
              onChange={(e) => handleChange('province', e.target.value)}
            />
            <Input
              label="Telefono"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => handleChange('whatsapp', e.target.value)}
            />
            <Input
              label="Email negozio"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <Input
              label="Email notifiche"
              type="email"
              value={form.notification_email}
              onChange={(e) => handleChange('notification_email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <ThemeSelector
              value={form.theme_palette as ThemePaletteId}
              onChange={handleThemeChange}
              title="Palette negozio"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creazione in corso...' : 'Crea negozio'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
