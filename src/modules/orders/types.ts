export interface OrderSupplement {
  name: { fr: string; ar: string };
  price: number;
}

export interface OrderItem {
  productName: { fr: string; ar: string } | string;
  quantity: number;
  unitPrice: number;
  supplements?: OrderSupplement[];
  notes?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  subtotal?: number;
  total: number;
  type: 'delivery' | 'pickup';
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  items?: OrderItem[];
  notes?: string;
  deliveryCompany?: { name: string; commission: number; phone?: string };
  deliveryFee?: number;
  createdAt: string;
  confirmedAt?: string;
  preparationDuration?: number;
}

export interface OrderStatus {
  value: string;
  label: string;
  color: string;
}

export const ORDER_STATUSES: OrderStatus[] = [
  { value: 'pending',   label: 'En attente',     color: 'warning'   },
  { value: 'confirmed', label: 'Confirmée',       color: 'primary'   },
  { value: 'preparing', label: 'En préparation',  color: 'secondary' },
  { value: 'ready',     label: 'Prête',           color: 'tertiary'  },
  { value: 'delivered', label: 'Livrée',          color: 'success'   },
  { value: 'cancelled', label: 'Annulée',         color: 'danger'    },
];

export const getStatusLabel = (status: string): string =>
  ORDER_STATUSES.find(s => s.value === status)?.label ?? status;

export const getStatusColor = (status: string): string =>
  ORDER_STATUSES.find(s => s.value === status)?.color ?? 'medium';

/** Returns the French product name from a bilingual object or plain string */
export function getProductName(name: OrderItem['productName']): string {
  if (typeof name === 'object' && name !== null) return name.fr || name.ar || '—';
  return String(name ?? '—');
}
