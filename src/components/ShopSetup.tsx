import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import type { Shop, ShopHoursConfig, Staff, Service } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_THEME_ID, type ThemePaletteId } from '../theme/palettes';
import { ChevronLeft, ChevronRight, Upload, X, CheckCircle2, Shield, Palette, Building2, Mail, Phone, Download, UserPlus, Eye, EyeOff, Clock, Scissors, Sparkles } from 'lucide-react';
import { ShopQRCode } from './ShopQRCode';
import { API_CONFIG } from '../config/api';
import { buildShopUrl, slugify } from '../utils/slug';
import { createDefaultShopHoursConfig } from '../utils/shopHours';
import { TimePicker } from './ui/TimePicker';
import type { TimeSlot } from '../types';

const getTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const result = token && token.trim().length > 0 ? token.trim() : null;
  
  // Log per debug
  if (result) {
    console.log('🔍 getTokenFromUrl: Token trovato nell\'URL:', {
      tokenLength: result.length,
      tokenPreview: result.substring(0, 8) + '...',
      fullUrl: window.location.href
    });
  } else {
    console.warn('⚠️ getTokenFromUrl: Nessun token trovato nell\'URL:', {
      search: window.location.search,
      fullUrl: window.location.href
    });
  }
  
  return result;
};

type Slide = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminAccessToken, setAdminAccessToken] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [inviteAdminUserId, setInviteAdminUserId] = useState<string | null>(null);
  
  // Nuovi state per le slide aggiuntive
  const [shopHours, setShopHours] = useState<ShopHoursConfig>(createDefaultShopHoursConfig());
  const [barberData, setBarberData] = useState<Partial<Staff>>({
    full_name: '',
    email: '',
    role: 'Barber',
    active: true,
  });
  const [serviceData, setServiceData] = useState<Partial<Service>>({
    name: '',
    duration_min: 30,
    price_cents: 0,
    active: true,
  });

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
      console.log('🔍 ShopSetup: Inizio validazione token...');
      
      if (!inviteToken) {
        console.error('❌ ShopSetup: Token mancante nell\'URL');
        setError('Token di invito mancante o non valido. Verifica che il link contenga ?token=...');
        setIsValidating(false);
        return;
      }
      
      console.log('🔍 ShopSetup: Token trovato, validazione in corso...', {
        tokenLength: inviteToken.length,
        tokenPreview: inviteToken.substring(0, 8) + '...'
      });
      
      try {
        const valid = await apiService.validateShopInvite(inviteToken);
        
        if (!valid) {
          console.error('❌ ShopSetup: Validazione token fallita');
          setError('Link di invito non valido o scaduto. Verifica che il token sia corretto e non sia già stato usato.');
          setTokenValid(false);
        } else {
          console.log('✅ ShopSetup: Token valido!', {
            inviteId: valid.id,
            hasAdminUserId: !!valid.admin_user_id
          });
          
          setTokenValid(true);
          setError(null);
          
          // Salva l'admin_user_id associato al token (se presente)
          // Se non presente, permetteremo a qualsiasi admin di usare il token
          if (valid.admin_user_id) {
            setInviteAdminUserId(valid.admin_user_id);
            console.log('✅ ShopSetup: Token associato a admin specifico:', valid.admin_user_id);
          } else {
            console.log('ℹ️ ShopSetup: Token valido ma senza admin_user_id - qualsiasi admin può usarlo');
            setInviteAdminUserId(null);
            // Non impostare errore - il token può essere usato da qualsiasi admin
          }
        }
      } catch (validationError) {
        console.error('❌ ShopSetup: Errore durante validazione:', validationError);
        setError(`Errore durante la validazione del token: ${validationError instanceof Error ? validationError.message : 'Errore sconosciuto'}`);
        setTokenValid(false);
      } finally {
        setIsValidating(false);
      }
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

  const downloadQRCode = async (link: string, shopName: string) => {
    try {
      const encoded = encodeURIComponent(link);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=500x500`;
      
      // Fetch the QR code image
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-Code-${shopName.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore durante il download del QR code:', error);
      setError('Errore durante il download del QR code. Riprova.');
    }
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
    if (currentSlide < 9) {
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
        // Login Admin (slide 2)
        return isLoggedIn || (!!adminEmail.trim() && !!adminPassword.trim());
      case 3:
        // Shop Info (era slide 2)
        return !!(
          form.name.trim() &&
          form.description.trim() &&
          form.address.trim() &&
          form.postal_code.trim() &&
          form.city.trim() &&
          form.province.trim()
        );
      case 4:
        // Contacts (era slide 3)
        return !!form.phone.trim() && !!form.notification_email.trim();
      case 5:
        return true; // Palette, sempre valido
      case 6:
        // Orari negozio - almeno un giorno deve essere aperto con orari validi
        const hasOpenDay = Object.values(shopHours).some(day => {
          if (!day.isOpen) return false;
          return day.timeSlots.length > 0 && day.timeSlots.every(slot => {
            const [startH, startM] = slot.start.split(':').map(Number);
            const [endH, endM] = slot.end.split(':').map(Number);
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;
            return startTime < endTime && startTime >= 0 && endTime <= 24 * 60;
          });
        });
        return hasOpenDay;
      case 7:
        // Barbiere - almeno nome, email e ruolo
        return !!(barberData.full_name?.trim() && barberData.email?.trim() && barberData.role?.trim());
      case 8:
        // Servizio - almeno nome, durata e prezzo
        return !!(
          serviceData.name?.trim() &&
          serviceData.duration_min && serviceData.duration_min >= 5 &&
          serviceData.price_cents !== undefined && serviceData.price_cents >= 0
        );
      case 9:
        return privacyAccepted;
      default:
        return false;
    }
  };

  const handleLogin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError('Inserisci email e password');
      return;
    }

    setError(null);
    
    // Verifica configurazione Supabase
    if (!API_CONFIG.SUPABASE_EDGE_URL || !API_CONFIG.SUPABASE_ANON_KEY) {
      const missing = [];
      if (!API_CONFIG.SUPABASE_EDGE_URL) missing.push('VITE_SUPABASE_EDGE_URL');
      if (!API_CONFIG.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
      setError(`Configurazione Supabase mancante: ${missing.join(', ')}`);
      return;
    }

    try {
      const tokenUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=password`;
      
      console.log('🔍 handleLogin: Tentativo login...', {
        email: adminEmail.trim().toLowerCase(),
        url: tokenUrl.substring(0, 80) + '...',
        hasAnonKey: !!API_CONFIG.SUPABASE_ANON_KEY,
        edgeUrl: API_CONFIG.SUPABASE_EDGE_URL
      });
      
      // Crea un AbortController per timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondi timeout
      
      let tokenRes: Response;
      try {
        tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ 
            email: adminEmail.trim().toLowerCase(), 
            password: adminPassword 
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('❌ handleLogin: Errore fetch:', fetchError);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout: La richiesta ha impiegato troppo tempo. Verifica la connessione internet.');
        }
        
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('Load failed')) {
          throw new Error('Impossibile connettersi al server. Verifica:\n1. La connessione internet\n2. Che l\'URL di Supabase sia corretto\n3. Che non ci siano problemi di CORS o firewall');
        }
        
        throw new Error(`Errore di connessione: ${fetchError.message || 'Impossibile connettersi al server'}`);
      }

      console.log('🔍 handleLogin: Response status:', tokenRes.status, tokenRes.statusText);
      
      if (!tokenRes.ok) {
        let errorMessage = 'Credenziali non valide';
        try {
          const errorText = await tokenRes.text();
          console.error('❌ handleLogin: Errore HTTP:', tokenRes.status, errorText);
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.msg || errorData.error_description || errorData.message || errorMessage;
            } catch {
              errorMessage = errorText.substring(0, 200);
            }
          }
        } catch (parseError) {
          console.error('❌ handleLogin: Errore parsing risposta:', parseError);
          errorMessage = `Errore server (${tokenRes.status}): ${tokenRes.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseText = await tokenRes.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Risposta login vuota');
      }

      const tokenJson = JSON.parse(responseText);
      const accessToken = tokenJson.access_token;
      
      // Recupera user_id dal token JWT
      let userId: string | null = null;
      if (tokenJson.user?.id) {
        userId = tokenJson.user.id;
      } else if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          userId = payload.sub;
        } catch {
          console.warn('⚠️ Impossibile decodificare JWT per user_id');
        }
      }

      if (!accessToken || !userId) {
        throw new Error('Impossibile ottenere token o user_id dal login');
      }

      // Se il token è associato a un admin specifico, verifica che corrisponda
      if (inviteAdminUserId && userId !== inviteAdminUserId) {
        throw new Error('Le credenziali inserite non corrispondono all\'admin associato a questo token di invito. Usa le credenziali dell\'admin corretto.');
      }

      // Verifica che l'utente abbia ruolo admin (necessario in entrambi i casi)
      try {
        const profileUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=role,shop_id`;
        const profileRes = await fetch(profileUrl, {
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (profileRes.ok) {
          const profiles = await profileRes.json();
          const profile = profiles?.[0];
          
          if (!profile || profile.role !== 'admin') {
            throw new Error('L\'utente non ha i permessi di amministratore. Contatta il supporto.');
          }
          
          // Verifica che l'admin non sia già associato a un altro negozio
          if (profile.shop_id) {
            throw new Error('Questo admin è già associato a un negozio. Non puoi creare un nuovo negozio con questo account.');
          }
        }
      } catch (profileError) {
        if (profileError instanceof Error && profileError.message.includes('non ha i permessi')) {
          throw profileError;
        }
        if (profileError instanceof Error && profileError.message.includes('già associato')) {
          throw profileError;
        }
        console.warn('⚠️ Impossibile verificare il profilo admin:', profileError);
        // Continua comunque, ma avvisa
      }

      // Salva token e user_id
      setAdminAccessToken(accessToken);
      setAdminUserId(userId);
      setIsLoggedIn(true);
      
      // Salva anche in localStorage per persistenza
      localStorage.setItem('auth_token', accessToken);
      if (tokenJson.refresh_token) {
        localStorage.setItem('refresh_token', tokenJson.refresh_token);
      }
      
      console.log('✅ Login riuscito, user_id:', userId);
      
      // Vai alla slide successiva
      nextSlide();
    } catch (loginError) {
      console.error('❌ Errore login:', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Errore durante il login');
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
      // Verifica che l'utente sia loggato
      if (!adminAccessToken || !adminUserId) {
        throw new Error('Devi effettuare il login prima di creare il negozio. Torna alla slide di login.');
      }

      // STEP 1: Genera slug leggibile e garantisci unicità globale
      const baseSlug = form.name.trim()
        ? slugify(form.name.trim())
        : slugify(`shop-${Date.now()}`);
      const autoSlug = await apiService.ensureUniqueShopSlug(baseSlug);

      // STEP 2: Crea il negozio usando il token admin
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

      // STEP 3: Aggiorna il profilo admin con shop_id (il ruolo admin è già impostato nel database)
      if (shop.id) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Attendi che il trigger completi
        
        const profileUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/profiles?user_id=eq.${adminUserId}`;
        const profileRes = await fetch(profileUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${adminAccessToken}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            shop_id: shop.id,
            role: 'admin',
            full_name: form.name || 'Admin'
          })
        });

        if (!profileRes.ok) {
          const errorText = await profileRes.text();
          console.error('Errore aggiornamento profilo admin:', errorText);
          throw new Error(`Impossibile aggiornare il profilo admin: ${errorText}`);
        }

        // Persisti anche lato client per evitare residui del vecchio shop
        localStorage.setItem('current_shop_id', shop.id);
        if (shop.slug || autoSlug) {
          localStorage.setItem('current_shop_slug', shop.slug || autoSlug);
        }
      }

      // Carica il logo se presente (usa il token dell'admin appena creato)
      // IMPORTANTE: Il logo può essere caricato solo se abbiamo un token valido
      if (logoFile && shop.id && adminAccessToken) {
        try {
          setIsUploadingLogo(true);
          
          const bucket = 'shop-logos';
          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
          };
          const ext = mimeToExt[logoFile.type] || 'jpg';
          const objectPath = `shops/${shop.id}/logo.${ext}`;

          // Best-effort cleanup di estensioni precedenti
          const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
          await Promise.allSettled(
            candidateExts.map((e) =>
              fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/shops/${shop.id}/logo.${e}`, {
                method: 'DELETE',
                headers: {
                  apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
                  Authorization: `Bearer ${adminAccessToken}`,
                },
              }).catch(() => undefined)
            )
          );

          const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'apikey': API_CONFIG.SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${adminAccessToken}`,
              'Content-Type': logoFile.type,
              'x-upsert': 'true',
            },
            body: logoFile,
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Upload logo fallito: ${uploadRes.status} ${errText}`);
          }

          const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
          
          // Aggiorna il negozio con il logo usando il token admin
          const updateShopUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/shops?id=eq.${shop.id}`;
          const updateShopRes = await fetch(updateShopUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': API_CONFIG.SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${adminAccessToken}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              logo_url: publicUrl,
              logo_path: objectPath,
            })
          });

          if (!updateShopRes.ok) {
            console.warn('Errore aggiornamento logo nel negozio:', await updateShopRes.text());
          }
        } catch (logoError) {
          console.error('Errore caricamento logo:', logoError);
          // Non bloccare la creazione se il logo fallisce, ma avvisa l'utente
          setError(`Negozio creato con successo, ma errore nel caricamento del logo: ${logoError instanceof Error ? logoError.message : 'Errore sconosciuto'}. Puoi caricare il logo successivamente dalle impostazioni.`);
        } finally {
          setIsUploadingLogo(false);
        }
      } else if (logoFile && shop.id && !adminAccessToken) {
        console.warn('Logo non caricato: token admin non disponibile');
        setError('Negozio creato con successo, ma impossibile caricare il logo (account admin non creato correttamente). Puoi caricare il logo successivamente dalle impostazioni.');
      }

      try {
        await apiService.markShopInviteUsed(inviteToken, shop.id);
      } catch (markError) {
        console.warn('Impossibile marcare il token come usato:', markError);
      }

      const link = buildShopUrl(shop.slug || autoSlug);
      
      // Applica il tema scelto e persivilo
      // Priorità: tema salvato nel negozio > tema scelto nel form > default
      const themeToApply = (shop.theme_palette as ThemePaletteId) || form.theme_palette || DEFAULT_THEME_ID;
      
      console.log('🎨 ShopSetup: Applicando tema dopo creazione negozio:', {
        shopTheme: shop.theme_palette,
        formTheme: form.theme_palette,
        defaultTheme: DEFAULT_THEME_ID,
        themeToApply: themeToApply,
        shopId: shop.id
      });
      
      // Se il tema non è stato salvato nel negozio, aggiornalo nel database
      if (!shop.theme_palette && form.theme_palette && shop.id) {
        try {
          console.log('🎨 ShopSetup: Tema non salvato nel negozio, aggiorno nel database...');
          const updateShopUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/shops?id=eq.${shop.id}`;
          const updateShopRes = await fetch(updateShopUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': API_CONFIG.SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${adminAccessToken}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              theme_palette: form.theme_palette
            })
          });
          
          if (updateShopRes.ok) {
            const updated = await updateShopRes.json();
            if (updated && updated[0]) {
              console.log('✅ ShopSetup: Tema aggiornato nel database:', updated[0].theme_palette);
              // Aggiorna shop locale con il tema salvato
              shop.theme_palette = updated[0].theme_palette;
            }
          } else {
            console.warn('⚠️ ShopSetup: Impossibile aggiornare tema nel database:', await updateShopRes.text());
          }
        } catch (updateError) {
          console.error('❌ ShopSetup: Errore aggiornamento tema:', updateError);
        }
      }
      
      // Applica il tema con persistenza (salva in localStorage per questo shop)
      setTheme(themeToApply, { persist: true });
      
      // STEP 4: Salva gli orari del negozio
      if (shop.id && adminAccessToken) {
        try {
          console.log('🕐 ShopSetup: Salvataggio orari negozio...');
          // Assicurati che shop_id sia salvato nel localStorage per l'API
          localStorage.setItem('current_shop_id', shop.id);
          await apiService.saveDailyShopHours(shopHours);
          console.log('✅ ShopSetup: Orari salvati con successo');
        } catch (hoursError) {
          console.error('❌ ShopSetup: Errore salvataggio orari:', hoursError);
          // Non bloccare la creazione se gli orari falliscono
          setError(`Negozio creato con successo, ma errore nel salvataggio degli orari: ${hoursError instanceof Error ? hoursError.message : 'Errore sconosciuto'}. Puoi configurare gli orari successivamente dalle impostazioni.`);
        }
      }
      
      // STEP 5: Crea il barbiere
      if (shop.id && adminAccessToken && barberData.full_name && barberData.email && barberData.role) {
        try {
          console.log('👨 ShopSetup: Creazione barbiere...');
          await apiService.createStaff({
            shop_id: shop.id,
            full_name: barberData.full_name,
            email: barberData.email,
            role: barberData.role,
            active: barberData.active ?? true,
          } as Omit<Staff, 'id' | 'created_at'>);
          console.log('✅ ShopSetup: Barbiere creato con successo');
        } catch (barberError) {
          console.error('❌ ShopSetup: Errore creazione barbiere:', barberError);
          // Non bloccare la creazione se il barbiere fallisce
          const currentError = error || '';
          setError(`${currentError ? currentError + ' ' : ''}Errore nella creazione del barbiere: ${barberError instanceof Error ? barberError.message : 'Errore sconosciuto'}. Puoi aggiungere barbieri successivamente dalle impostazioni.`);
        }
      }
      
      // STEP 6: Crea il servizio
      if (shop.id && adminAccessToken && serviceData.name && serviceData.duration_min && serviceData.price_cents !== undefined) {
        try {
          console.log('✨ ShopSetup: Creazione servizio...');
          await apiService.createService({
            shop_id: shop.id,
            name: serviceData.name,
            duration_min: serviceData.duration_min,
            price_cents: serviceData.price_cents,
            active: serviceData.active ?? true,
          });
          console.log('✅ ShopSetup: Servizio creato con successo');
        } catch (serviceError) {
          console.error('❌ ShopSetup: Errore creazione servizio:', serviceError);
          // Non bloccare la creazione se il servizio fallisce
          const currentError = error || '';
          setError(`${currentError ? currentError + ' ' : ''}Errore nella creazione del servizio: ${serviceError instanceof Error ? serviceError.message : 'Errore sconosciuto'}. Puoi aggiungere servizi successivamente dalle impostazioni.`);
        }
      }
      
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

  // Renderizza direttamente il contenuto basato sulla slide corrente
  // Non usare funzioni che vengono ricreate ad ogni render per evitare perdita di focus
  let slideContent: React.ReactNode = null;
  
  if (currentSlide === 1) {
    slideContent = <SlideWelcome />;
  } else if (currentSlide === 2) {
    // Slide 2: Login Admin
    slideContent = (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e40af] rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Accesso Admin</h2>
          <p className="text-gray-600">Accedi con le credenziali admin fornite</p>
        </div>
        
        {isLoggedIn ? (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Accesso effettuato</p>
                <p className="text-sm text-green-700">Puoi procedere con la configurazione del negozio</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Input
              label="Email admin *"
              labelClassName="text-[#1e40af] font-medium"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@negozio.com"
              required
              disabled={isLoggedIn}
            />
            <div className="relative">
              <Input
                label="Password *"
                labelClassName="text-[#1e40af] font-medium"
                type={showAdminPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Inserisci la password"
                required
                disabled={isLoggedIn}
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                disabled={isLoggedIn}
              >
                {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogin}
              disabled={!adminEmail.trim() || !adminPassword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold rounded-lg transition-all duration-200"
            >
              <Shield className="w-5 h-5" />
              Accedi
            </button>
          </div>
        )}
      </div>
    );
  } else if (currentSlide === 3) {
    // Slide 3: Shop Info (era slide 2)
    slideContent = (
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
          <label className="block text-sm font-medium text-[#1e40af] mb-2">Descrizione *</label>
          <textarea
            className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] bg-white text-gray-900 transition-all"
            rows={4}
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Descrivi il tuo negozio..."
            required
          />
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Indirizzo *"
            labelClassName="text-[#1e40af] font-medium"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Via, numero civico"
            required
          />
          <Input
            label="CAP *"
            labelClassName="text-[#1e40af] font-medium"
            value={form.postal_code}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            placeholder="00100"
            required
          />
          <Input
            label="Città *"
            labelClassName="text-[#1e40af] font-medium"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="Roma"
            required
          />
          <Input
            label="Provincia *"
            labelClassName="text-[#1e40af] font-medium"
            value={form.province}
            onChange={(e) => handleChange('province', e.target.value)}
            placeholder="RM"
            required
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
  } else if (currentSlide === 4) {
    // Slide 4: Contacts (era slide 3)
    slideContent = (
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
  } else if (currentSlide === 5) {
    slideContent = (
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
  } else if (currentSlide === 6) {
    // Slide 6: Orari negozio
    const DAYS_OF_WEEK = [
      { key: 0, name: 'Domenica', shortName: 'Dom' },
      { key: 1, name: 'Lunedì', shortName: 'Lun' },
      { key: 2, name: 'Martedì', shortName: 'Mar' },
      { key: 3, name: 'Mercoledì', shortName: 'Mer' },
      { key: 4, name: 'Giovedì', shortName: 'Gio' },
      { key: 5, name: 'Venerdì', shortName: 'Ven' },
      { key: 6, name: 'Sabato', shortName: 'Sab' },
    ];

    const handleToggleDay = (dayOfWeek: number) => {
      setShopHours(prev => ({
        ...prev,
        [dayOfWeek]: {
          ...prev[dayOfWeek],
          isOpen: !prev[dayOfWeek].isOpen,
        },
      }));
    };

    const handleAddTimeSlot = (dayOfWeek: number) => {
      const newSlot: TimeSlot = { start: '09:00', end: '18:00' };
      setShopHours(prev => ({
        ...prev,
        [dayOfWeek]: {
          ...prev[dayOfWeek],
          timeSlots: [...prev[dayOfWeek].timeSlots, newSlot],
        },
      }));
    };

    const handleRemoveTimeSlot = (dayOfWeek: number, slotIndex: number) => {
      setShopHours(prev => ({
        ...prev,
        [dayOfWeek]: {
          ...prev[dayOfWeek],
          timeSlots: prev[dayOfWeek].timeSlots.filter((_, i) => i !== slotIndex),
        },
      }));
    };

    const handleTimeSlotChange = (dayOfWeek: number, slotIndex: number, field: 'start' | 'end', value: string) => {
      setShopHours(prev => ({
        ...prev,
        [dayOfWeek]: {
          ...prev[dayOfWeek],
          timeSlots: prev[dayOfWeek].timeSlots.map((slot, i) =>
            i === slotIndex ? { ...slot, [field]: value } : slot
          ),
        },
      }));
    };

    slideContent = (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e40af] rounded-full mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Orari di Apertura</h2>
          <p className="text-gray-600">Configura gli orari di apertura del tuo negozio</p>
        </div>
        
        <div className="border-2 border-[#1e40af]/30 rounded-lg p-6 bg-white/60 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-5 h-5 text-[#1e40af]" />
              <h3 className="text-lg font-bold text-gray-900">Orari di Apertura</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {DAYS_OF_WEEK.map((day) => {
                const dayHours = shopHours[day.key];
                const isOpen = dayHours.isOpen;
                
                return (
                  <div key={day.key} className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">{day.name}</h4>
                      <button
                        type="button"
                        onClick={() => handleToggleDay(day.key)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs rounded hover:bg-gray-100"
                      >
                        {isOpen ? (
                          <>
                            <span className="text-green-600 font-medium">Aperto</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">Chiuso</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isOpen ? (
                      <div className="space-y-2">
                        {dayHours.timeSlots.length === 0 ? (
                          <div className="text-center py-3 text-gray-400">
                            <Clock className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                            <p className="text-xs">Nessun orario</p>
                            <button
                              type="button"
                              onClick={() => handleAddTimeSlot(day.key)}
                              className="mt-2 text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              Aggiungi
                            </button>
                          </div>
                        ) : (
                          <>
                            {dayHours.timeSlots.map((slot, slotIndex) => (
                              <div
                                key={slotIndex}
                                className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50"
                              >
                                <div className="flex items-center space-x-2">
                                  <TimePicker
                                    value={slot.start}
                                    onChange={(value) => handleTimeSlotChange(day.key, slotIndex, 'start', value)}
                                    className="w-24 min-w-[6rem]"
                                    placeholder="09:00"
                                  />
                                  <span className="text-gray-400 text-sm">-</span>
                                  <TimePicker
                                    value={slot.end}
                                    onChange={(value) => handleTimeSlotChange(day.key, slotIndex, 'end', value)}
                                    className="w-24 min-w-[6rem]"
                                    placeholder="18:00"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTimeSlot(day.key, slotIndex)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddTimeSlot(day.key)}
                              className="w-full text-xs px-2 py-1 mt-1 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              + Aggiungi fascia
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400">
                        <p className="text-xs">Chiuso</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-xs">
                💡 Configura gli orari di apertura per ogni giorno della settimana. Clicca su "Aperto" per abilitare un giorno e aggiungi le fasce orarie.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (currentSlide === 7) {
    // Slide 7: Creazione barbiere
    slideContent = (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e40af] rounded-full mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Aggiungi un Barbiere</h2>
          <p className="text-gray-600">Crea almeno un barbiere per il tuo negozio</p>
        </div>
        
        <div className="space-y-6">
          <Input
            label="Nome Completo *"
            labelClassName="text-[#1e40af] font-medium"
            value={barberData.full_name || ''}
            onChange={(e) => setBarberData(prev => ({ ...prev, full_name: e.target.value }))}
            placeholder="Es: Mario Rossi"
            required
          />
          <Input
            label="Email *"
            labelClassName="text-[#1e40af] font-medium"
            type="email"
            value={barberData.email || ''}
            onChange={(e) => setBarberData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="mario.rossi@example.com"
            required
          />
          <div>
            <label className="block text-sm font-medium text-[#1e40af] mb-2">Ruolo *</label>
            <select
              value={barberData.role || ''}
              onChange={(e) => setBarberData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] bg-white text-gray-900"
              required
            >
              <option value="">Seleziona ruolo</option>
              <option value="Barber">Barber</option>
              <option value="Stylist">Stylist</option>
              <option value="Master Barber">Master Barber</option>
              <option value="Junior Barber">Junior Barber</option>
            </select>
          </div>
        </div>
      </div>
    );
  } else if (currentSlide === 8) {
    // Slide 8: Creazione servizio
    slideContent = (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e40af] rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#1e40af] mb-2">Aggiungi un Servizio</h2>
          <p className="text-gray-600">Crea almeno un servizio offerto dal tuo negozio</p>
        </div>
        
        <div className="space-y-6">
          <Input
            label="Nome Servizio *"
            labelClassName="text-[#1e40af] font-medium"
            value={serviceData.name || ''}
            onChange={(e) => setServiceData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Es: Taglio Capelli"
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Durata (minuti) *"
              labelClassName="text-[#1e40af] font-medium"
              type="number"
              value={String(serviceData.duration_min || 30)}
              onChange={(e) => setServiceData(prev => ({ ...prev, duration_min: parseInt(e.target.value || '30', 10) }))}
              min="5"
              max="480"
              required
            />
            <Input
              label="Prezzo (€) *"
              labelClassName="text-[#1e40af] font-medium"
              type="number"
              step="0.01"
              value={serviceData.price_cents !== undefined ? (serviceData.price_cents / 100).toFixed(2) : ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value || '0');
                setServiceData(prev => ({ ...prev, price_cents: Math.round(value * 100) }));
              }}
              min="0"
              placeholder="0.00"
              required
            />
          </div>
        </div>
      </div>
    );
  } else if (currentSlide === 9) {
    // Slide 9: Conferma e crea (era slide 6)
    slideContent = (
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
              <div className="flex justify-between border-t pt-3 mt-3">
                <span className="text-gray-600">Barbiere:</span>
                <span className="font-medium text-[#1e40af]">{barberData.full_name || 'Non specificato'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Servizio:</span>
                <span className="font-medium text-[#1e40af]">{serviceData.name || 'Non specificato'}</span>
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
  }

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
                <p className="text-base font-mono text-gray-900 break-all bg-white p-3 rounded border border-[#1e40af]/30 mb-4">
                  {success.link}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = success.link;
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-6 py-3 font-semibold rounded-lg transition-all duration-200"
                >
                  Vai al Login!
                </button>
              </div>
              
              <div className="border-2 border-[#1e40af]/30 rounded-lg p-6 bg-white/60 backdrop-blur-sm">
                <div className="flex flex-col items-center space-y-4">
                  <ShopQRCode link={success.link} size={200} />
                  <button
                    type="button"
                    onClick={() => downloadQRCode(success.link, success.shop.name)}
                    className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-6 py-3 font-semibold rounded-lg transition-all duration-200"
                  >
                    <Download className="w-4 h-4" />
                    Scarica QR Code
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600">
                Condividi il link o il QR code con i tuoi clienti per permettere loro di registrarsi.
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
            style={{ width: `${(currentSlide / 9) * 100}%` }}
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
              {slideContent}
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slide) => (
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

          {currentSlide < 9 ? (
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
