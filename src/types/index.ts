// src/types/index.ts

export interface UserDTO {
  id: number;
  full_name: string;
  email: string;
  role: string;
  profile_image?: string;
  created_at?: Date;
}

export interface AuthResponseDTO {
  access_token?: string;
  refresh_token?: string;
  user: UserDTO;
  message?: string;
  error?: string;
}

export interface CategoryDTO {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface ProductDTO {
  id: number;
  category_id: number;
  name: string;
  weight: number;
  unit_type: 'piece' | 'gram' | 'kg' | 'liter' | 'pack';
  description: string;
  price: string | number; 
  image_url?: string;
  is_available: boolean;
  adults_only: boolean;
  point_value: number;
}

export interface StoreDTO {
  id: number;
  name: string;
  address: string;
  phone_number: string;
  location: any; 
  opening_hours: string;
  live_occupancy: number;
  max_occupancy: number;
}

export interface OrderDTO {
  id: number;
  user_id: number | null;
  store_id: number | null;
  total_price: string | number;
  payment_method: string;
  status: string;
  in_store_purchase: boolean;
  created_at: Date;
}

export interface OrderItemDTO {
  id: number;
  order_id: number;
  product_id: number | null;
  quantity: number;
  price_at_purchase: string | number;
}

export interface ReceiptDTO {
  id: number;
  order_id: number;
  user_id: number | null;
  raw_content: string;
  created_at: Date;
}

export interface RewardDTO {
  id: number;
  catalog_id: number;
  user_id: number;
  unique_code: string;
  acquired_at: Date;
  expires_at: Date | null;
  is_redeemed: boolean;
}

export interface RewardCatalogDTO {
  id: number;
  title: string;
  reward_type: number;
  point_cost: number;
  adults_only: boolean;
  description: string;
}

export interface ShoppingListDTO {
  id: number;
  user_id: number;
  name: string;
  created_at: Date;
}

export interface ShoppingListItemDTO {
  id: number;
  list_id: number;
  product_id: number;
  is_checked: boolean;
}

export interface UserPreferencesDTO {
  id: number;
  user_id: number;
  language: 'sk' | 'en' | 'cz';
  theme_mode: boolean;
  high_contrast_mode: boolean;
  font_size: number;
  reading_out_loud: boolean;
  simple_navigation: boolean;
  region: string | null;
  data_privacy_consent: boolean;
  terms_of_service: boolean;
}

export interface UserNotificationsDTO {
  id: number;
  user_id: number;
  order_status: boolean;
  delivery_app: boolean;
  unused_points: boolean;
  suspicious_activity: boolean;
  unfinished_order: boolean;
  favorite_product_sale: boolean;
  news_letter_email: boolean;
  news_letter_app: boolean;
  sale_app: boolean;
  sale_sms: boolean;
  sale_email: boolean;
  verification_code_sms: boolean;
  verification_code_email: boolean;
  delivery_sms: boolean;
  exclusive_code: boolean;
  news_email: boolean;
  feedback: boolean;
  invoice: boolean;
}

export interface PaymentMethodDTO {
  id: number;
  user_id: number;
  type: string;
  card_last4: string | null;
  card_brand: string | null;
  is_preferred: boolean;
}

export interface SubscriptionDTO {
  id: number;
  plan_id: number;
  user_id: number;
  start_date: Date;
  expiry_date: Date;
  status: string;
  is_active: boolean;
  name?: string;
  features?: string[];
  price?: string | number;
}

export interface SubscriptionDetailDTO {
  id: number;
  name: string;
  billing_period: 'monthly' | 'yearly';
  features: string;
  price: string | number;
}

export interface LoyaltyCardDTO {
  id: number;
  user_id: number;
  qr_code_data: string;
  current_points: number;
  full_name?: string;
  email?: string;
}

export interface FavoriteDTO {
  id: number;
  user_id: number;
  product_id: number;
  name?: string;
  price?: string | number;
  image_url?: string;
  category_id?: number;
}

export interface ErrorResponseDTO {
  error: string;
}
