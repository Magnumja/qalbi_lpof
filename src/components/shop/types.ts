export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'customer' | 'admin';
  email_notifications?: boolean;
}
export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string;
  price_cents: number;
  kind: 'ready' | 'made_to_order';
  stock: number;
  lead_days: number;
  active: boolean;
}
export interface Address {
  name: string;
  line1: string;
  city: string;
  postal_code: string;
  country: string;
}
export interface Order {
  id: string;
  number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string | null;
  unread_count?: number;
  kind: 'shop' | 'custom';
  status: string;
  payment_status: string;
  total_cents: number | null;
  shipping_cents: number;
  brief: string;
  due_at: string | null;
  tracking: string;
  payment_intent?: string | null;
  address: Address;
  created_at: string;
}
export interface Message {
  id: string;
  body: string;
  sender_name: string;
  sender_role: string;
  media_url?: string | null;
  created_at: string;
}
export interface OrderDetail {
  order: Order;
  items: { id: string; title: string; quantity: number; price_cents: number }[];
  messages: Message[];
  events: { description: string; created_at: string }[];
}
export interface ShopData {
  products: Product[];
  currency: string;
  shipping_cents: number;
  countries: string[];
  payment_enabled: boolean;
  notifications_enabled: boolean;
}
