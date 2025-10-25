import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Filter } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export const Analytics = () => {
  const [timeRange, setTimeRange] = useState('week');

  // Mock data for charts
  const weeklyData = [
    { day: 'Lun', appointments: 12, revenue: 420 },
    { day: 'Mar', appointments: 15, revenue: 525 },
    { day: 'Mer', appointments: 8, revenue: 280 },
    { day: 'Gio', appointments: 18, revenue: 630 },
    { day: 'Ven', appointments: 22, revenue: 770 },
    { day: 'Sab', appointments: 25, revenue: 875 },
    { day: 'Dom', appointments: 6, revenue: 210 },
  ];

  const topServices = [
    { name: 'Taglio + Barba', count: 45, percentage: 35 },
    { name: 'Taglio Capelli', count: 38, percentage: 30 },
    { name: 'Barba', count: 25, percentage: 20 },
    { name: 'Shampoo', count: 19, percentage: 15 },
  ];

  const maxAppointments = weeklyData.length > 0 ? Math.max(...weeklyData.map(d => d.appointments)) : 1;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Analisi</h1>
        <div className="flex items-center space-x-4">
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            options={[
              { value: 'week', label: 'Questa settimana' },
              { value: 'month', label: 'Questo mese' },
              { value: 'quarter', label: 'Trimestre' },
            ]}
          />
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtri
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Appuntamenti Totali</p>
              <p className="text-3xl font-bold text-gray-900">106</p>
              <p className="text-green-600 text-sm">+12% vs scorsa settimana</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Incasso Totale</p>
              <p className="text-3xl font-bold text-gray-900">€3,710</p>
              <p className="text-green-600 text-sm">+8% vs scorsa settimana</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-700" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Tasso No-Show</p>
              <p className="text-3xl font-bold text-gray-900">4.2%</p>
              <p className="text-red-600 text-sm">+0.5% vs scorsa settimana</p>
            </div>
            <Users className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Clienti Unici</p>
              <p className="text-3xl font-bold text-gray-900">89</p>
              <p className="text-green-600 text-sm">+15% vs scorsa settimana</p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Appointments Chart */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Appuntamenti Settimanali</h2>
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          
          <div className="space-y-4">
            {weeklyData.map((day) => (
              <div key={day.day} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 w-16">
                  <span className="text-gray-600 font-medium text-sm">{day.day}</span>
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-600 to-green-800 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(day.appointments / maxAppointments) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-4 w-24 text-right">
                  <span className="text-gray-900 font-semibold">{day.appointments}</span>
                  <span className="text-gray-600 text-sm">€{day.revenue}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Services */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Servizi Più Richiesti</h2>
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          
          <div className="space-y-4">
            {topServices.map((service, index) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium">{service.name}</div>
                    <div className="text-gray-600 text-sm">{service.count} appuntamenti</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-900 font-semibold">{service.percentage}%</div>
                  <div className="bg-gray-200 rounded-full h-2 w-16 overflow-hidden mt-1">
                    <div
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-full rounded-full"
                      style={{ width: `${service.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Analisi Dettagliate</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-2">96.8%</div>
            <div className="text-gray-600 text-sm">Tasso di Completamento</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">32min</div>
            <div className="text-gray-600 text-sm">Durata Media Servizio</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-2">€35</div>
            <div className="text-gray-600 text-sm">Spesa Media per Cliente</div>
          </div>
        </div>
      </Card>
    </div>
  );
};