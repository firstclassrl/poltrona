import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import type { Shop } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_THEME_ID, type ThemePaletteId } from '../theme/palettes';
import { ChevronLeft, ChevronRight, Upload, X, CheckCircle2, Shield, Palette, Building2, Mail, Phone } from 'lucide-react';

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
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

type Slide = 1 | 2 | 3 | 4 | 5;

export const ShopSetup: React.FC = () => {
  const { setTheme, themeId } = useTheme();
  const inviteToken = useMemo(() => getTokenFromUrl(), []);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ shop: Shop; link: string } | null>(null);
  const [currentSlide, setCurrentSlide] = useState<Slide>(1);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    postal_code: '',
    city: '',
    province: '',
    phone: '',
    whatsapp: '',
    email: '',
    notification_email: '',
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

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleThemeChange = (paletteId: ThemePaletteId) => {
    setForm((prev) => ({
      ...prev,
      theme_palette: paletteId,
    }));
    setTheme(paletteId, { persist: false });
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Solo file immagine sono permessi.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Il file è troppo grande. Massimo 5MB.');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const goToSlide = (targetSlide: Slide) => {
    if (targetSlide === currentSlide || isTransitioning) return;
    
    if (targetSlide > currentSlide) {
      setSlideDirection('forward');
    } else {
      setSlideDirection('backward');
    }
    
    setIsTransitioning(true);
    
    // Cambia slide immediatamente, animazione solo visiva
    setTimeout(() => {
      setCurrentSlide(targetSlide);
      setIsTransitioning(false);
    }, 50);
  };

  const nextSlide = () => {
    if (currentSlide < 5) {
      goToSlide((currentSlide + 1) as Slide);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 1) {
      goToSlide((currentSlide - 1) as Slide);
    }
  };

  const validateSlide = (slide: Slide): boolean => {
    switch (slide) {
      case 1:
        return true; // Benvenuto, sempre valido
      case 2:
        return !!form.name.trim();
      case 3:
        return !!form.phone.trim() || !!form.notification_email.trim();
      case 4:
        return true; // Palette, sempre valido
      case 5:
        return privacyAccepted;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) {
      setError('Token di invito mancante o non valido.');
      return;
    }
    if (!privacyAccepted) {
      setError('Devi accettare i termini di servizio e la privacy policy.');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);

    try {
      // Genera slug automaticamente dal nome
      const autoSlug = form.name.trim() 
        ? slugify(form.name.trim()) 
        : `shop-${Date.now()}`;

      // Crea il negozio
      const shop = await apiService.createShop({
        slug: autoSlug,
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

      // Carica il logo se presente
      if (logoFile && shop.id) {
        try {
          setIsUploadingLogo(true);
          const { publicUrl } = await apiService.uploadShopLogoPublic(logoFile, shop.id);
          // Aggiorna il negozio con il logo
          await apiService.updateShop({
            ...shop,
            logo_url: publicUrl,
          });
        } catch (logoError) {
          console.warn('Errore caricamento logo:', logoError);
          // Non bloccare la creazione se il logo fallisce
        } finally {
          setIsUploadingLogo(false);
        }
      }

      try {
        await apiService.markShopInviteUsed(inviteToken, shop.id);
      } catch (markError) {
        console.warn('Impossibile marcare il token come usato:', markError);
      }

      const link = `${window.location.origin}?shop=${shop.slug || autoSlug}`;
      setTheme((shop.theme_palette as ThemePaletteId) || form.theme_palette || DEFAULT_THEME_ID);
      setSuccess({ shop, link });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del negozio');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Slide 1: Benvenuto
  const SlideWelcome = () => (
    <div className="text-center space-y-8 py-4">
      <div className="flex justify-center mb-6">
        <img 
          src="/logo Poltrona 2025.png" 
          alt="Logo Poltrona" 
          className="h-28 w-auto object-contain" 
        />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-[#1e40af] tracking-tight">
        BENVENUTI IN POLTRONA
      </h1>
      <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
        Il sistema di gestione appuntamenti più completo per il tuo negozio
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
        <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
          <div className="w-12 h-12 bg-[#10b981] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold text-[#1e40af] mb-2">Gestione Completa</h3>
          <p className="text-sm text-gray-600">Appuntamenti, clienti, staff e prodotti in un'unica piattaforma</p>
        </div>
        <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
          <div className="w-12 h-12 bg-[#10b981] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Phone className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold text-[#1e40af] mb-2">Notifiche Automatiche</h3>
          <p className="text-sm text-gray-600">Email e SMS automatici per te e i tuoi clienti</p>
        </div>
        <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
          <div className="w-12 h-12 bg-[#10b981] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Palette className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold text-[#1e40af] mb-2">Personalizzabile</h3>
          <p className="text-sm text-gray-600">Scegli colori e stile in linea con il tuo brand</p>
        </div>
      </div>
    </div>
  );


  // Slide 3: Contatti
  const SlideContacts = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Contatti</h2>
        <p className="text-gray-600">Inserisci i tuoi contatti per le comunicazioni</p>
      </div>
      
      <div className="space-y-6">
        <Input
          label="Telefono *"
          labelClassName="text-[#1e40af] font-medium"
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+39 123 456 7890"
        />
        <Input
          label="WhatsApp"
          labelClassName="text-[#1e40af] font-medium"
          type="tel"
          value={form.whatsapp}
          onChange={(e) => handleChange('whatsapp', e.target.value)}
          placeholder="+39 123 456 7890"
        />
        <Input
          label="Email negozio"
          labelClassName="text-[#1e40af] font-medium"
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="negozio@example.com"
        />
        <div>
          <Input
            label="Email notifiche *"
            labelClassName="text-[#1e40af] font-medium"
            type="email"
            value={form.notification_email}
            onChange={(e) => handleChange('notification_email', e.target.value)}
            placeholder="notifiche@example.com"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Email dove ricevere le notifiche per nuovi appuntamenti</p>
        </div>
      </div>
    </div>
  );

  // Slide 4: Palette colori
  const SlideTheme = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Personalizza il Tema</h2>
        <p className="text-gray-600">Scegli i colori del tuo negozio</p>
      </div>
      
      <div className="border-2 border-[#1e40af]/30 rounded-lg p-6 bg-white/60 backdrop-blur-sm">
        <ThemeSelector
          value={form.theme_palette as ThemePaletteId}
          onChange={handleThemeChange}
          title="Palette colori"
        />
      </div>
    </div>
  );

  // Slide 5: Conferma e crea
  const SlideConfirm = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Conferma e Crea</h2>
        <p className="text-gray-600">Rivedi le informazioni e accetta i termini</p>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
          <h3 className="font-semibold text-[#1e40af] mb-4">Riepilogo</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Nome:</span>
              <span className="font-medium text-[#1e40af]">{form.name || 'Non specificato'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Città:</span>
              <span className="font-medium text-[#1e40af]">{form.city || 'Non specificato'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Telefono:</span>
              <span className="font-medium text-[#1e40af]">{form.phone || 'Non specificato'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email notifiche:</span>
              <span className="font-medium text-[#1e40af]">{form.notification_email || 'Non specificato'}</span>
            </div>
          </div>
        </div>

        <div className="border-2 border-[#1e40af]/30 rounded-lg p-6 bg-white/60 backdrop-blur-sm">
          <div className="flex items-start space-x-4">
            <input
              type="checkbox"
              id="privacy"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 text-[#1e40af] border-gray-300 rounded focus:ring-[#1e40af]"
            />
            <label htmlFor="privacy" className="flex-1 text-sm text-gray-700 cursor-pointer">
              Accetto i <a href="#" className="text-[#1e40af] underline font-medium">Termini di Servizio</a> e la{' '}
              <a href="#" className="text-[#1e40af] underline font-medium">Privacy Policy</a> di Poltrona.
              <span className="text-red-500 ml-1">*</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizza direttamente senza memoizzazione per evitare problemi di focus
  const renderSlideContent = () => {
    switch (currentSlide) {
      case 1:
        return <SlideWelcome />;
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Informazioni Negozio</h2>
              <p className="text-gray-600">Inserisci i dati principali del tuo negozio</p>
            </div>
            
            <div className="space-y-6">
              <Input
                label="Nome negozio *"
                labelClassName="text-[#1e40af] font-medium"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="Es: Barberia Roma"
              />
              
              <div>
                <label className="block text-sm font-medium text-[#1e40af] mb-2">Descrizione</label>
                <textarea
                  className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] bg-white text-gray-900 transition-all"
                  rows={4}
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descrivi il tuo negozio..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Indirizzo"
                  labelClassName="text-[#1e40af] font-medium"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Via, numero civico"
                />
                <Input
                  label="CAP"
                  labelClassName="text-[#1e40af] font-medium"
                  value={form.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="00100"
                />
                <Input
                  label="Città"
                  labelClassName="text-[#1e40af] font-medium"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Roma"
                />
                <Input
                  label="Provincia"
                  labelClassName="text-[#1e40af] font-medium"
                  value={form.province}
                  onChange={(e) => handleChange('province', e.target.value)}
                  placeholder="RM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1e40af] mb-3">Logo del negozio</label>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-32 w-auto object-contain border-2 border-[#1e40af] rounded-lg p-4 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#1e40af] rounded-lg cursor-pointer bg-white/60 hover:bg-white/80 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 text-[#10b981] mb-3" />
                      <p className="mb-2 text-sm text-gray-700">
                        <span className="font-semibold text-[#1e40af]">Clicca per caricare</span> o trascina qui
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF fino a 5MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoSelect}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        );
      case 3:
        return <SlideContacts />;
      case 4:
        return <SlideTheme />;
      case 5:
        return <SlideConfirm />;
      default:
        return null;
    }
  };

  // Rimuovo il Wrapper e renderizzo direttamente per evitare re-render
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4">
        <div className="max-w-2xl w-full">
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 text-lg">Verifica del link in corso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4">
        <div className="max-w-2xl w-full">
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Link non valido</h1>
            <p className="text-gray-600">Il link di invito non è valido o è scaduto.</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4">
        <div className="max-w-2xl w-full">
          <div 
            className="p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20"
            style={{
              background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
              boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.15)',
            }}
          >
            <div className="text-center py-8 space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-[#1e40af]">Negozio creato con successo!</h1>
              <p className="text-lg text-gray-700">
                <strong className="text-[#1e40af]">{success.shop.name}</strong> è stato creato correttamente.
              </p>
              <div className="border-2 border-[#1e40af]/30 rounded-lg p-6 bg-white/60 backdrop-blur-sm text-left">
                <p className="text-sm font-medium text-[#1e40af] mb-2">
                  Link registrazione clienti:
                </p>
                <p className="text-base font-mono text-gray-900 break-all bg-white p-3 rounded border border-[#1e40af]/30">
                  {success.link}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Condividi il link o genera un QR code per i tuoi clienti.
              </p>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500 mt-6">
            <p>
              Powered by{' '}
              <a
                href="https://www.abruzzo.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1e40af] hover:text-[#1e3a8a] font-medium underline"
              >
                www.abruzzo.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white py-6 px-4">
      <div className="max-w-4xl w-full mx-auto flex flex-col h-[calc(100vh-3rem)] max-h-[900px]">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-[#1e40af] h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentSlide / 5) * 100}%` }}
          />
        </div>

        {/* Slide container - flex-1 per occupare lo spazio disponibile */}
        <div className="relative overflow-hidden rounded-lg flex-1 min-h-0 mb-6">
          <div className="h-full overflow-y-auto">
            <div 
              className="p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20"
              style={{
                background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
                boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.15)',
              }}
            >
              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                </div>
              )}
              {renderSlideContent()}
            </div>
          </div>
        </div>

        {/* Navigation buttons - sempre visibili in fondo */}
        <div className="flex justify-between items-center gap-4 mt-auto">
          <button
            type="button"
            onClick={prevSlide}
            disabled={currentSlide === 1}
            className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:ring-offset-2"
            style={{ backgroundColor: currentSlide === 1 ? undefined : '#1e3a8a' }}
          >
            <ChevronLeft className="w-4 h-4" />
            Indietro
          </button>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((slide) => (
              <button
                key={slide}
                type="button"
                onClick={() => goToSlide(slide as Slide)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === slide
                    ? 'bg-[#1e3a8a] w-8'
                    : 'bg-gray-300 hover:bg-gray-400 w-2'
                }`}
                aria-label={`Vai alla slide ${slide}`}
              />
            ))}
          </div>

          {currentSlide < 5 ? (
            <button
              type="button"
              onClick={nextSlide}
              disabled={!validateSlide(currentSlide)}
              className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:ring-offset-2"
              style={{ backgroundColor: !validateSlide(currentSlide) ? undefined : '#1e3a8a' }}
            >
              Avanti
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!privacyAccepted || isSubmitting || isUploadingLogo}
              className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:ring-offset-2"
              style={{ backgroundColor: (!privacyAccepted || isSubmitting || isUploadingLogo) ? undefined : '#1e3a8a' }}
            >
              {isSubmitting || isUploadingLogo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creazione in corso...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Crea il tuo negozio
                </>
              )}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-4">
          <p>
            Powered by{' '}
            <a
              href="https://www.abruzzo.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1e40af] hover:text-[#1e3a8a] font-medium underline"
            >
              www.abruzzo.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
