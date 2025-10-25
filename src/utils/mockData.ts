import type { Client, Staff, Service, Appointment, Product } from '../types';

export const mockClients: Client[] = [
  {
    id: '1',
    shop_id: '1',
    first_name: 'Marco',
    last_name: 'Rossi',
    phone_e164: '+393351234567',
    email: 'marco.rossi@email.com',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    shop_id: '1',
    first_name: 'Luca',
    last_name: 'Bianchi',
    phone_e164: '+393351234568',
    email: 'luca.bianchi@email.com',
    created_at: '2024-01-20T15:30:00Z',
  },
  {
    id: '3',
    shop_id: '1',
    first_name: 'Andrea',
    last_name: 'Verdi',
    phone_e164: '+393351234569',
    email: 'andrea.verdi@email.com',
    created_at: '2024-02-01T09:15:00Z',
  },
];

export const mockStaff: Staff[] = [
  {
    id: 'staff_1',
    shop_id: '1',
    full_name: 'Giovanni Rossi',
    role: 'Barbiere Senior',
    calendar_id: null,
    active: true,
    chair_id: 'chair_1',
    profile_photo_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    email: 'giovanni.rossi@retrobarbershop.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'staff_2',
    shop_id: '1',
    full_name: 'Marco Bianchi',
    role: 'Barbiere Junior',
    calendar_id: null,
    active: true,
    chair_id: 'chair_2',
    profile_photo_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    email: 'marco.bianchi@retrobarbershop.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'staff_3',
    shop_id: '1',
    full_name: 'Luca Verdi',
    role: 'Apprendista',
    calendar_id: null,
    active: true,
    chair_id: null,
    profile_photo_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    email: 'luca.verdi@retrobarbershop.com',
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const mockServices: Service[] = [
  {
    id: '1',
    shop_id: '1',
    name: 'Taglio Capelli',
    duration_min: 30,
    price_cents: 2500,
    active: true,
  },
  {
    id: '2',
    shop_id: '1',
    name: 'Barba',
    duration_min: 20,
    price_cents: 1500,
    active: true,
  },
  {
    id: '3',
    shop_id: '1',
    name: 'Taglio + Barba',
    duration_min: 45,
    price_cents: 3500,
    active: true,
  },
  {
    id: '4',
    shop_id: '1',
    name: 'Shampoo',
    duration_min: 15,
    price_cents: 1000,
    active: true,
  },
];

export const mockProducts: Product[] = [
  {
    id: 'prod_1',
    shop_id: '1',
    name: 'Shampoo Professionale',
    description: 'Shampoo delicato per capelli trattati, ideale per mantenere il colore e la lucentezza',
    price_cents: 2500,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod_2',
    shop_id: '1',
    name: 'Balsamo Nutriente',
    description: 'Balsamo ricco di vitamine per capelli secchi e danneggiati',
    price_cents: 2200,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod_3',
    shop_id: '1',
    name: 'Cera per Capelli',
    description: 'Cera modellante forte per styling professionale',
    price_cents: 1800,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod_4',
    shop_id: '1',
    name: 'Gel Styling',
    description: 'Gel trasparente per un look naturale e duraturo',
    price_cents: 1500,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod_5',
    shop_id: '1',
    name: 'Olio per Barba',
    description: 'Olio nutriente per barba e baffi, con fragranza legnosa',
    price_cents: 3200,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod_6',
    shop_id: '1',
    name: 'Maschera Capelli',
    description: 'Maschera idratante per capelli colorati e trattati',
    price_cents: 4500,
    image_url: 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

// Helper function to create date for today with specific time
const createTodayDate = (hour: number, minute: number = 0) => {
  const today = new Date();
  today.setHours(hour, minute, 0, 0);
  return today.toISOString();
};

// Helper function to create date for tomorrow with specific time
const createTomorrowDate = (hour: number, minute: number = 0) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, minute, 0, 0);
  return tomorrow.toISOString();
};

export const mockAppointments: Appointment[] = [
  {
    id: '1',
    shop_id: '1',
    client_id: '1',
    staff_id: 'staff_1',
    service_id: '1',
    start_at: createTodayDate(10, 0), // Today at 10:00
    end_at: createTodayDate(10, 30), // Today at 10:30
    status: 'confirmed',
    notes: null,
    gcal_event_id: null,
    products: [
      { productId: 'prod_1', quantity: 1, productName: 'Shampoo Professionale', productPrice: 2500 },
      { productId: 'prod_3', quantity: 1, productName: 'Cera per Capelli', productPrice: 1800 }
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    clients: mockClients[0],
    staff: mockStaff[0],
    services: mockServices[0],
  },
  {
    id: '2',
    shop_id: '1',
    client_id: '2',
    staff_id: 'staff_2',
    service_id: '3',
    start_at: createTodayDate(14, 30), // Today at 14:30
    end_at: createTodayDate(15, 15), // Today at 15:15
    status: 'scheduled',
    notes: null,
    gcal_event_id: null,
    products: [
      { productId: 'prod_5', quantity: 2, productName: 'Olio per Barba', productPrice: 3200 }
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    clients: mockClients[1],
    staff: mockStaff[1],
    services: mockServices[2],
  },
  {
    id: '3',
    shop_id: '1',
    client_id: '3',
    staff_id: 'staff_1',
    service_id: '3',
    start_at: createTomorrowDate(9, 0), // Tomorrow at 9:00
    end_at: createTomorrowDate(9, 45), // Tomorrow at 9:45
    status: 'scheduled',
    notes: null,
    gcal_event_id: null,
    products: [], // Nessun prodotto prenotato
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    clients: mockClients[2],
    staff: mockStaff[0],
    services: mockServices[2],
  },
  {
    id: '4',
    shop_id: '1',
    client_id: '4',
    staff_id: 'staff_2',
    service_id: '1',
    start_at: createTomorrowDate(16, 0), // Tomorrow at 16:00
    end_at: createTomorrowDate(16, 30), // Tomorrow at 16:30
    status: 'confirmed',
    notes: null,
    gcal_event_id: null,
    products: [
      { productId: 'prod_2', quantity: 1, productName: 'Balsamo Nutriente', productPrice: 2200 },
      { productId: 'prod_6', quantity: 1, productName: 'Maschera Capelli', productPrice: 4500 }
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    clients: mockClients[3],
    staff: mockStaff[1],
    services: mockServices[0],
  },
];