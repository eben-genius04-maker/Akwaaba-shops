// Generated from the database schema. Regenerate after changing migrations.
// See README: "Regenerating database types".
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          store_id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          slug?: string
          description?: string | null
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          id: string
          user_id: string
          label: string
          recipient_name: string
          phone: string
          digital_address: string | null
          landmark: string | null
          area: string | null
          city: string | null
          lat: number | null
          lng: number | null
          location_accuracy_m: number | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label?: string
          recipient_name: string
          phone: string
          digital_address?: string | null
          landmark?: string | null
          area?: string | null
          city?: string | null
          lat?: number | null
          lng?: number | null
          location_accuracy_m?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          recipient_name?: string
          phone?: string
          digital_address?: string | null
          landmark?: string | null
          area?: string | null
          city?: string | null
          lat?: number | null
          lng?: number | null
          location_accuracy_m?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          fee: number
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          fee: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          fee?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          store_id: string
          product_id: string | null
          product_name: string
          image_url: string | null
          unit_price: number
          quantity: number
          subtotal: number
          delivery_size: Database["public"]["Enums"]["delivery_size"]
        }
        Insert: {
          id?: string
          order_id: string
          store_id: string
          product_id?: string | null
          product_name: string
          image_url?: string | null
          unit_price: number
          quantity: number
          subtotal: number
          delivery_size?: Database["public"]["Enums"]["delivery_size"]
        }
        Update: {
          id?: string
          order_id?: string
          store_id?: string
          product_id?: string | null
          product_name?: string
          image_url?: string | null
          unit_price?: number
          quantity?: number
          subtotal?: number
          delivery_size?: Database["public"]["Enums"]["delivery_size"]
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_same_store"
            columns: ["store_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["store_id", "id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          id: number
          order_id: string
          store_id: string
          status: Database["public"]["Enums"]["order_status"]
          note: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: never
          order_id: string
          store_id: string
          status: Database["public"]["Enums"]["order_status"]
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          order_id?: string
          store_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          id: string
          store_id: string
          order_number: number
          tracking_token: string
          customer_user_id: string | null
          customer_name: string
          customer_phone: string
          customer_email: string | null
          digital_address: string | null
          landmark: string | null
          area: string | null
          city: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id: string | null
          delivery_zone_name: string | null
          delivery_distance_km: number | null
          subtotal: number
          delivery_fee: number
          total: number
          currency: string
          delivery_fee_adjusted: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          notes: string | null
          staff_notes: string | null
          cancel_reason: string | null
          stock_restored: boolean
          expires_at: string | null
          paid_at: string | null
          confirmed_at: string | null
          dispatched_at: string | null
          delivered_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          order_number: number
          tracking_token?: string
          customer_user_id?: string | null
          customer_name: string
          customer_phone: string
          customer_email?: string | null
          digital_address?: string | null
          landmark?: string | null
          area?: string | null
          city?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          delivery_distance_km?: number | null
          subtotal: number
          delivery_fee: number
          total: number
          currency?: string
          delivery_fee_adjusted?: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          staff_notes?: string | null
          cancel_reason?: string | null
          stock_restored?: boolean
          expires_at?: string | null
          paid_at?: string | null
          confirmed_at?: string | null
          dispatched_at?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          order_number?: number
          tracking_token?: string
          customer_user_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_email?: string | null
          digital_address?: string | null
          landmark?: string | null
          area?: string | null
          city?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          delivery_distance_km?: number | null
          subtotal?: number
          delivery_fee?: number
          total?: number
          currency?: string
          delivery_fee_adjusted?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          notes?: string | null
          staff_notes?: string | null
          cancel_reason?: string | null
          stock_restored?: boolean
          expires_at?: string | null
          paid_at?: string | null
          confirmed_at?: string | null
          dispatched_at?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          order_id: string
          store_id: string
          provider: string
          reference: string
          amount: number
          platform_fee: number
          currency: string
          status: string
          channel: string | null
          failure_reason: string | null
          provider_data: Json | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          store_id: string
          provider?: string
          reference: string
          amount: number
          platform_fee?: number
          currency?: string
          status?: string
          channel?: string | null
          failure_reason?: string | null
          provider_data?: Json | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          store_id?: string
          provider?: string
          reference?: string
          amount?: number
          platform_fee?: number
          currency?: string
          status?: string
          channel?: string | null
          failure_reason?: string | null
          provider_data?: Json | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          id: number
          store_id: string | null
          actor_id: string | null
          action: string
          old_value: string | null
          new_value: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: never
          store_id?: string | null
          actor_id?: string | null
          action: string
          old_value?: string | null
          new_value?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          store_id?: string | null
          actor_id?: string | null
          action?: string
          old_value?: string | null
          new_value?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          store_id: string
          product_id: string
          image_url: string
          storage_path: string | null
          alt_text: string | null
          sort_order: number
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          product_id: string
          image_url: string
          storage_path?: string | null
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          product_id?: string
          image_url?: string
          storage_path?: string | null
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_same_store"
            columns: ["store_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["store_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          store_id: string
          category_id: string | null
          name: string
          slug: string
          description: string | null
          price: number
          stock_quantity: number
          is_available: boolean
          is_featured: boolean
          is_active: boolean
          delivery_size: Database["public"]["Enums"]["delivery_size"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          category_id?: string | null
          name: string
          slug: string
          description?: string | null
          price: number
          stock_quantity?: number
          is_available?: boolean
          is_featured?: boolean
          is_active?: boolean
          delivery_size?: Database["public"]["Enums"]["delivery_size"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          category_id?: string | null
          name?: string
          slug?: string
          description?: string | null
          price?: number
          stock_quantity?: number
          is_available?: boolean
          is_featured?: boolean
          is_active?: boolean
          delivery_size?: Database["public"]["Enums"]["delivery_size"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_same_store"
            columns: ["store_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["store_id", "id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          is_platform_admin: boolean
          created_at: string
          updated_at: string
          email: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
          email?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
          email?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          key: string
          window_start: string
          hits: number
        }
        Insert: {
          key: string
          window_start?: string
          hits?: number
        }
        Update: {
          key?: string
          window_start?: string
          hits?: number
        }
        Relationships: []
      }
      store_counters: {
        Row: {
          store_id: string
          last_order_number: number
        }
        Insert: {
          store_id: string
          last_order_number?: number
        }
        Update: {
          store_id?: string
          last_order_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_counters_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_delivery_settings: {
        Row: {
          store_id: string
          delivery_enabled: boolean
          method: Database["public"]["Enums"]["delivery_method"]
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          base_fee: number
          per_km_fee: number
          max_distance_km: number | null
          road_factor: number
          medium_surcharge: number
          large_surcharge: number
          free_delivery_min: number | null
          delivery_note: string | null
          updated_at: string
        }
        Insert: {
          store_id: string
          delivery_enabled?: boolean
          method?: Database["public"]["Enums"]["delivery_method"]
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          base_fee?: number
          per_km_fee?: number
          max_distance_km?: number | null
          road_factor?: number
          medium_surcharge?: number
          large_surcharge?: number
          free_delivery_min?: number | null
          delivery_note?: string | null
          updated_at?: string
        }
        Update: {
          store_id?: string
          delivery_enabled?: boolean
          method?: Database["public"]["Enums"]["delivery_method"]
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          base_fee?: number
          per_km_fee?: number
          max_distance_km?: number | null
          road_factor?: number
          medium_surcharge?: number
          large_surcharge?: number
          free_delivery_min?: number | null
          delivery_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_delivery_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_invitations: {
        Row: {
          id: string
          store_id: string
          email: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          email: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          email?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          store_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          created_at: string
        }
        Insert: {
          store_id: string
          user_id: string
          role?: Database["public"]["Enums"]["member_role"]
          created_at?: string
        }
        Update: {
          store_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_settings: {
        Row: {
          store_id: string
          cod_enabled: boolean
          cod_max_amount: number | null
          prepaid_enabled: boolean
          platform_fee_percent: number
          paystack_subaccount_code: string | null
          settlement_bank_name: string | null
          settlement_account_name: string | null
          settlement_account_last4: string | null
          subaccount_connected_at: string | null
          updated_at: string
          paystack_mode: string | null
          paystack_key_last4: string | null
          paystack_status: string | null
          paystack_split_checked_at: string | null
          paystack_webhook_at: string | null
        }
        Insert: {
          store_id: string
          cod_enabled?: boolean
          cod_max_amount?: number | null
          prepaid_enabled?: boolean
          platform_fee_percent?: number
          paystack_subaccount_code?: string | null
          settlement_bank_name?: string | null
          settlement_account_name?: string | null
          settlement_account_last4?: string | null
          subaccount_connected_at?: string | null
          updated_at?: string
          paystack_mode?: string | null
          paystack_key_last4?: string | null
          paystack_status?: string | null
          paystack_split_checked_at?: string | null
          paystack_webhook_at?: string | null
        }
        Update: {
          store_id?: string
          cod_enabled?: boolean
          cod_max_amount?: number | null
          prepaid_enabled?: boolean
          platform_fee_percent?: number
          paystack_subaccount_code?: string | null
          settlement_bank_name?: string | null
          settlement_account_name?: string | null
          settlement_account_last4?: string | null
          subaccount_connected_at?: string | null
          updated_at?: string
          paystack_mode?: string | null
          paystack_key_last4?: string | null
          paystack_status?: string | null
          paystack_split_checked_at?: string | null
          paystack_webhook_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_paystack_keys: {
        Row: {
          store_id: string
          public_key: string
          secret_key_encrypted: string
          mode: string
          created_at: string
          updated_at: string
        }
        Insert: {
          store_id: string
          public_key: string
          secret_key_encrypted: string
          mode: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          store_id?: string
          public_key?: string
          secret_key_encrypted?: string
          mode?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_paystack_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          store_id: string
          business_name: string
          logo_url: string | null
          description: string | null
          address: string | null
          whatsapp_number: string | null
          contact_phone: string | null
          email: string | null
          currency: string
          social_links: Json
          hero_title: string | null
          hero_subtitle: string | null
          hero_image_url: string | null
          brand_color: string | null
          updated_at: string
        }
        Insert: {
          store_id: string
          business_name: string
          logo_url?: string | null
          description?: string | null
          address?: string | null
          whatsapp_number?: string | null
          contact_phone?: string | null
          email?: string | null
          currency?: string
          social_links?: Json
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          brand_color?: string | null
          updated_at?: string
        }
        Update: {
          store_id?: string
          business_name?: string
          logo_url?: string | null
          description?: string | null
          address?: string | null
          whatsapp_number?: string | null
          contact_phone?: string | null
          email?: string | null
          currency?: string
          social_links?: Json
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          brand_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          plan: string
          status_reason: string | null
          created_by: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          plan?: string
          status_reason?: string | null
          created_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          plan?: string
          status_reason?: string | null
          created_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      adjust_delivery_fee: {
        Args: {
          p_order_id: string
          p_fee: number
          p_note?: string
        }
        Returns: undefined
      }
      admin_list_stores: {
        Args: {
          p_status?: Database["public"]["Enums"]["store_status"]
          p_search?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          status_reason: string
          created_at: string
          approved_at: string
          owner_name: string
          owner_email: string
          owner_phone: string
          product_count: number
          order_count: number
          orders_30d: number
          last_order_at: string
          paystack_mode: string
          paystack_status: string
          platform_fee_percent: number
          total_count: number
        }[]
      }
      admin_platform_stats: {
        Args: never
        Returns: Json
      }
      admin_store_summary: {
        Args: {
          p_store_id: string
        }
        Returns: Json
      }
      begin_payment: {
        Args: {
          p_tracking_token: string
        }
        Returns: Json
      }
      cancel_order_by_token: {
        Args: {
          p_token: string
          p_reason?: string
        }
        Returns: undefined
      }
      confirm_payment: {
        Args: {
          p_reference: string
          p_amount_minor: number
          p_currency: string
          p_channel?: string
          p_data?: Json
        }
        Returns: Json
      }
      connect_store_paystack: {
        Args: {
          p_store_id: string
          p_public_key: string
          p_secret_encrypted: string
          p_secret_last4: string
          p_mode: string
          p_split_code: string
        }
        Returns: undefined
      }
      create_store: {
        Args: {
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      disconnect_store_paystack: {
        Args: {
          p_store_id: string
        }
        Returns: undefined
      }
      expire_unpaid_orders: {
        Args: never
        Returns: number
      }
      fail_payment: {
        Args: {
          p_reference: string
          p_reason?: string
          p_data?: Json
        }
        Returns: undefined
      }
      get_cart: {
        Args: {
          p_store_slug: string
          p_items: Json
        }
        Returns: Json
      }
      get_checkout_config: {
        Args: {
          p_store_slug: string
        }
        Returns: Json
      }
      get_delivery_quote: {
        Args: {
          p_store_slug: string
          p_items: Json
          p_zone_id?: string
          p_lat?: number
          p_lng?: number
        }
        Returns: Json
      }
      get_invitation: {
        Args: {
          p_token: string
        }
        Returns: {
          store_name: string
          store_slug: string
          email: string
          role: Database["public"]["Enums"]["member_role"]
          is_valid: boolean
          reason: string
        }[]
      }
      get_order_by_token: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      get_order_counts: {
        Args: {
          p_store_id: string
        }
        Returns: Json
      }
      get_store_sales: {
        Args: {
          p_store_id: string
        }
        Returns: Json
      }
      hit_rate_limit: {
        Args: {
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      list_my_orders: {
        Args: never
        Returns: {
          order_number: number
          store_name: string
          store_slug: string
          status: Database["public"]["Enums"]["order_status"]
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          total: number
          currency: string
          item_count: number
          created_at: string
          tracking_token: string
        }[]
      }
      pgrst_watch: {
        Args: never
        Returns: unknown
      }
      place_order: {
        Args: {
          p_store_slug: string
          p_items: Json
          p_customer: Json
          p_delivery: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
        }
        Returns: Json
      }
      record_paystack_webhook: {
        Args: {
          p_store_id: string
        }
        Returns: undefined
      }
      set_paystack_split_status: {
        Args: {
          p_store_id: string
          p_ok: boolean
        }
        Returns: undefined
      }
      set_product_images: {
        Args: {
          p_product_id: string
          p_images: Json
        }
        Returns: string[]
      }
      set_store_platform_fee: {
        Args: {
          p_store_id: string
          p_percent: number
        }
        Returns: undefined
      }
      set_store_status: {
        Args: {
          p_store_id: string
          p_status: Database["public"]["Enums"]["store_status"]
          p_reason?: string
        }
        Returns: undefined
      }
      update_order_status: {
        Args: {
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
          p_note?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      delivery_method: "zones" | "distance"
      delivery_size: "small" | "medium" | "large"
      member_role: "owner" | "manager" | "staff"
      order_status: "pending" | "confirmed" | "processing" | "out_for_delivery" | "delivered" | "cancelled"
      payment_method: "pay_on_delivery" | "prepaid"
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"
      store_status: "pending" | "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
