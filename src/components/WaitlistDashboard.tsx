import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, XCircle, Calendar, Bell, TrendingUp, AlertCircle } from 'lucide-react';
import { Card } from './ui/Card';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import type { WaitlistEntry } from '../types';

interface WaitlistStats {
  totalActive: number;
  totalNotified: number;
  totalAccepted: number;
  totalExpired: number;
  conversionRate: number;
  byDate: {
    date: string;
    active: number;
    notified: number;
    accepted: number;
    expired: number;
  }[];
}

interface WaitlistDashboardProps {
  shopId?: string | null;
}

export const WaitlistDashboard: React.FC<WaitlistDashboardProps> = ({ shopId: propShopId }) => {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const shopId = propShopId || currentShop?.id;
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWaitlistData();
    // Refresh ogni 30 secondi
    const interval = setInterval(loadWaitlistData, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  const loadWaitlistData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Carica tutte le entry waitlist per lo shop
      const { API_ENDPOINTS, API_CONFIG } = await import('../config/api');
      const authToken = localStorage.getItem('auth_token') || API_CONFIG.SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${API_ENDPOINTS.WAITLIST}?shop_id=eq.${shopId || ''}&select=*,clients(id,first_name,last_name,email,phone_e164),staff(id,full_name),appointments:appointment_id(id,start_at,end_at,services(id,name,duration_min),staff(id,full_name))&order=created_at.desc`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error loading waitlist:', response.status, errorText);
        throw new Error('Failed to load waitlist data');
      }

      const data = await response.json();
      setWaitlistEntries(data);
      calculateStats(data);
    } catch (err) {
      console.error('Error loading waitlist data:', err);
      setError('Errore nel caricamento dei dati della waitlist');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (entries: WaitlistEntry[]) => {
    const statsData: WaitlistStats = {
      totalActive: 0,
      totalNotified: 0,
      totalAccepted: 0,
      totalExpired: 0,
      conversionRate: 0,
      byDate: [],
    };

    const dateMap = new Map<string, { active: number; notified: number; accepted: number; expired: number }>();

    entries.forEach((entry) => {
      // Conta per status
      switch (entry.status) {
        case 'active':
          statsData.totalActive++;
          break;
        case 'notified':
          statsData.totalNotified++;
          break;
        case 'accepted':
          statsData.totalAccepted++;
          break;
        case 'expired':
          statsData.totalExpired++;
          break;
      }

      // Conta per data (data dell'appuntamento associato)
      const aptStart = (entry as any).appointments?.start_at as string | undefined;
      if (aptStart) {
        const dateStr = new Date(aptStart).toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { active: 0, notified: 0, accepted: 0, expired: 0 });
        }
        const dateStats = dateMap.get(dateStr)!;
        switch (entry.status) {
          case 'active':
            dateStats.active++;
            break;
          case 'notified':
            dateStats.notified++;
            break;
          case 'accepted':
            dateStats.accepted++;
            break;
          case 'expired':
            dateStats.expired++;
            break;
        }
      }
    });

    // Calcola conversion rate
    const totalNotified = statsData.totalNotified + statsData.totalAccepted;
    statsData.conversionRate = totalNotified > 0 
      ? (statsData.totalAccepted / totalNotified) * 100 
      : 0;

    // Converti dateMap in array
    statsData.byDate = Array.from(dateMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setStats(statsData);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Oggi';
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return 'Domani';
    }
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'notified':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'notified':
        return 'Notificato';
      case 'accepted':
        return 'Accettato';
      case 'expired':
        return 'Scaduto';
      default:
        return status;
    }
  };

  const filteredEntries = selectedDate
    ? waitlistEntries.filter((entry) => {
        const aptStart = (entry as any).appointments?.start_at as string | undefined;
        return aptStart ? new Date(aptStart).toISOString().split('T')[0] === selectedDate : false;
      })
    : waitlistEntries;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full">
      <div className="flex flex-col space-y-6">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Waitlist</h1>
          <p className="text-gray-600 mt-1">Gestisci le liste d'attesa dei clienti</p>
        </div>
        <button
          onClick={loadWaitlistData}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          Aggiorna
        </button>
      </div>

      {/* Statistiche Generali */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Attivi</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalActive}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Bell className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Notificati</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalNotified}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Accettati</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAccepted}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tasso Conversione</p>
                <p className="text-2xl font-bold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Statistiche per Data */}
      {stats && stats.byDate.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiche per Data</h2>
          <div className="space-y-3">
            {stats.byDate.map((dateStat) => (
              <div
                key={dateStat.date}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedDate === dateStat.date
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDate(selectedDate === dateStat.date ? null : dateStat.date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{formatDate(dateStat.date)}</p>
                      <p className="text-sm text-gray-500">{dateStat.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Attivi</p>
                      <p className="text-lg font-semibold text-blue-600">{dateStat.active}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Notificati</p>
                      <p className="text-lg font-semibold text-yellow-600">{dateStat.notified}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Accettati</p>
                      <p className="text-lg font-semibold text-green-600">{dateStat.accepted}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista Entry Waitlist */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedDate ? `Lista d'attesa per ${formatDate(selectedDate)}` : 'Tutte le Liste d\'attesa'}
          </h2>
          <span className="text-sm text-gray-500">{filteredEntries.length} entry</span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nessuna entry in waitlist</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const client = (entry as any).clients;
              const apt = (entry as any).appointments;
              const service = apt?.services;
              const staff = apt?.staff || (entry as any).staff;
              const aptStart = apt?.start_at ? new Date(apt.start_at) : null;

              return (
                <div
                  key={entry.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                          {getStatusLabel(entry.status)}
                        </span>
                        {entry.notified_at && entry.status === 'notified' && (
                          <span className="text-xs text-gray-500">
                            Notificato {new Date(entry.notified_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">
                          {client ? `${client.first_name} ${client.last_name || ''}`.trim() : 'Cliente'}
                        </p>
                        {client?.email && (
                          <p className="text-sm text-gray-600">{client.email}</p>
                        )}
                        {client?.phone_e164 && (
                          <p className="text-sm text-gray-600">{client.phone_e164}</p>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {aptStart ? aptStart.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                          </span>
                        </div>
                        {aptStart && (
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{aptStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          </div>
                        )}
                        {service && (
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <span className="font-medium">Servizio:</span>
                            <span>{service.name}</span>
                          </div>
                        )}
                        {staff && (
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <span className="font-medium">Barbiere:</span>
                            <span>{staff.full_name}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <span className="font-medium">Durata:</span>
                          <span>{entry.appointment_duration_min} min</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-sm text-gray-500">
                      <p>Iscritto il</p>
                      <p>{new Date(entry.created_at).toLocaleDateString('it-IT')}</p>
                      {entry.expires_at && (
                        <>
                          <p className="mt-2">Scade il</p>
                          <p>{new Date(entry.expires_at).toLocaleDateString('it-IT')}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
      </div>
      </div>
    </div>
  );
};

