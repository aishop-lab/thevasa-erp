export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          gst_number: string | null;
          pan_number: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          settings: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          gst_number?: string | null;
          pan_number?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          settings?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          gst_number?: string | null;
          pan_number?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          settings?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: "admin" | "manager" | "viewer" | "accountant";
          invited_by: string | null;
          joined_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          user_id: string;
          role: "admin" | "manager" | "viewer" | "accountant";
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: "admin" | "manager" | "viewer" | "accountant";
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      size_masters: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          display_order: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          name: string;
          display_order?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          display_order?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "size_masters_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      color_masters: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          hex_code: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          name: string;
          hex_code?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          hex_code?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "color_masters_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          team_id: string;
          sku: string;
          name: string;
          description: string | null;
          category: string | null;
          material: string | null;
          cost_price: number;
          mrp: number;
          selling_price: number;
          gst_rate: number;
          hsn_code: string | null;
          low_stock_threshold: number | null;
          is_active: boolean | null;
          images: string[] | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          sku: string;
          name: string;
          description?: string | null;
          category?: string | null;
          material?: string | null;
          cost_price?: number;
          mrp?: number;
          selling_price?: number;
          gst_rate?: number;
          hsn_code?: string | null;
          low_stock_threshold?: number | null;
          is_active?: boolean | null;
          images?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          sku?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          material?: string | null;
          cost_price?: number;
          mrp?: number;
          selling_price?: number;
          gst_rate?: number;
          hsn_code?: string | null;
          low_stock_threshold?: number | null;
          is_active?: boolean | null;
          images?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          team_id: string;
          variant_sku: string;
          size_id: string | null;
          color_id: string | null;
          barcode: string | null;
          weight_grams: number | null;
          cost_price: number | null;
          mrp: number | null;
          selling_price: number | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          team_id?: string;
          variant_sku: string;
          size_id?: string | null;
          color_id?: string | null;
          barcode?: string | null;
          weight_grams?: number | null;
          cost_price?: number | null;
          mrp?: number | null;
          selling_price?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          team_id?: string;
          variant_sku?: string;
          size_id?: string | null;
          color_id?: string | null;
          barcode?: string | null;
          weight_grams?: number | null;
          cost_price?: number | null;
          mrp?: number | null;
          selling_price?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "size_masters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "color_masters";
            referencedColumns: ["id"];
          },
        ];
      };
      platforms: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      platform_credentials: {
        Row: {
          id: string;
          team_id: string;
          platform_id: string;
          credentials: Json;
          is_connected: boolean | null;
          last_verified_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          platform_id: string;
          credentials?: Json;
          is_connected?: boolean | null;
          last_verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          platform_id?: string;
          credentials?: Json;
          is_connected?: boolean | null;
          last_verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_credentials_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_credentials_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_mappings: {
        Row: {
          id: string;
          team_id: string;
          variant_id: string;
          platform_id: string;
          external_product_id: string | null;
          external_variant_id: string | null;
          external_sku: string | null;
          asin: string | null;
          listing_url: string | null;
          is_active: boolean | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          variant_id: string;
          platform_id: string;
          external_product_id?: string | null;
          external_variant_id?: string | null;
          external_sku?: string | null;
          asin?: string | null;
          listing_url?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          variant_id?: string;
          platform_id?: string;
          external_product_id?: string | null;
          external_variant_id?: string | null;
          external_sku?: string | null;
          asin?: string | null;
          listing_url?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_mappings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_mappings_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_mappings_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouses: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          code: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          is_fba: boolean | null;
          platform_id: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          name: string;
          code?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          is_fba?: boolean | null;
          platform_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          code?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          is_fba?: boolean | null;
          platform_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "warehouses_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouses_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_stock: {
        Row: {
          id: string;
          team_id: string;
          warehouse_id: string;
          variant_id: string;
          qty_on_hand: number;
          qty_reserved: number;
          qty_available: number;
          last_synced_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          warehouse_id: string;
          variant_id: string;
          qty_on_hand?: number;
          qty_reserved?: number;
          last_synced_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          warehouse_id?: string;
          variant_id?: string;
          qty_on_hand?: number;
          qty_reserved?: number;
          last_synced_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_stock_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          team_id: string;
          warehouse_id: string;
          variant_id: string;
          movement_type:
            | "purchase"
            | "sales"
            | "transfer_in"
            | "transfer_out"
            | "adjustment"
            | "return"
            | "damage"
            | "fba_sync";
          quantity: number;
          reference_type: string | null;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          warehouse_id: string;
          variant_id: string;
          movement_type:
            | "purchase"
            | "sales"
            | "transfer_in"
            | "transfer_out"
            | "adjustment"
            | "return"
            | "damage"
            | "fba_sync";
          quantity: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          warehouse_id?: string;
          variant_id?: string;
          movement_type?:
            | "purchase"
            | "sales"
            | "transfer_in"
            | "transfer_out"
            | "adjustment"
            | "return"
            | "damage"
            | "fba_sync";
          quantity?: number;
          reference_type?: string | null;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_discrepancies: {
        Row: {
          id: string;
          team_id: string;
          variant_id: string;
          warehouse_id: string;
          fba_warehouse_id: string | null;
          system_qty: number;
          physical_qty: number;
          discrepancy: number;
          severity: "none" | "minor" | "moderate" | "major";
          status: "open" | "investigating" | "resolved" | "dismissed";
          reason: string | null;
          investigation_notes: string | null;
          resolution_notes: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          detected_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          variant_id: string;
          warehouse_id: string;
          fba_warehouse_id?: string | null;
          system_qty: number;
          physical_qty: number;
          status?: "open" | "investigating" | "resolved" | "dismissed";
          reason?: string | null;
          investigation_notes?: string | null;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          detected_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          variant_id?: string;
          warehouse_id?: string;
          fba_warehouse_id?: string | null;
          system_qty?: number;
          physical_qty?: number;
          status?: "open" | "investigating" | "resolved" | "dismissed";
          reason?: string | null;
          investigation_notes?: string | null;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          detected_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_discrepancies_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_discrepancies_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_discrepancies_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_discrepancies_fba_warehouse_id_fkey";
            columns: ["fba_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          team_id: string;
          platform_id: string;
          order_number: string;
          external_order_id: string | null;
          status:
            | "pending"
            | "confirmed"
            | "processing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
            | "refunded";
          customer_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          shipping_address: Json | null;
          billing_address: Json | null;
          subtotal: number | null;
          discount: number | null;
          shipping_charge: number | null;
          tax_amount: number | null;
          total_amount: number | null;
          currency: string | null;
          payment_status:
            | "pending"
            | "paid"
            | "partially_paid"
            | "refunded"
            | "failed";
          fulfillment_status:
            | "unfulfilled"
            | "partially_fulfilled"
            | "fulfilled"
            | "returned";
          tracking_number: string | null;
          tracking_url: string | null;
          courier: string | null;
          platform_metadata: Json | null;
          notes: string | null;
          ordered_at: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          platform_id: string;
          order_number: string;
          external_order_id?: string | null;
          status?:
            | "pending"
            | "confirmed"
            | "processing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
            | "refunded";
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          shipping_address?: Json | null;
          billing_address?: Json | null;
          subtotal?: number | null;
          discount?: number | null;
          shipping_charge?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          currency?: string | null;
          payment_status?:
            | "pending"
            | "paid"
            | "partially_paid"
            | "refunded"
            | "failed";
          fulfillment_status?:
            | "unfulfilled"
            | "partially_fulfilled"
            | "fulfilled"
            | "returned";
          tracking_number?: string | null;
          tracking_url?: string | null;
          courier?: string | null;
          platform_metadata?: Json | null;
          notes?: string | null;
          ordered_at?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          platform_id?: string;
          order_number?: string;
          external_order_id?: string | null;
          status?:
            | "pending"
            | "confirmed"
            | "processing"
            | "shipped"
            | "delivered"
            | "cancelled"
            | "returned"
            | "refunded";
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          shipping_address?: Json | null;
          billing_address?: Json | null;
          subtotal?: number | null;
          discount?: number | null;
          shipping_charge?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          currency?: string | null;
          payment_status?:
            | "pending"
            | "paid"
            | "partially_paid"
            | "refunded"
            | "failed";
          fulfillment_status?:
            | "unfulfilled"
            | "partially_fulfilled"
            | "fulfilled"
            | "returned";
          tracking_number?: string | null;
          tracking_url?: string | null;
          courier?: string | null;
          platform_metadata?: Json | null;
          notes?: string | null;
          ordered_at?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          team_id: string;
          variant_id: string | null;
          product_name: string;
          variant_name: string | null;
          sku: string | null;
          quantity: number;
          unit_price: number;
          discount: number | null;
          tax_amount: number | null;
          total: number;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          team_id?: string;
          variant_id?: string | null;
          product_name: string;
          variant_name?: string | null;
          sku?: string | null;
          quantity?: number;
          unit_price?: number;
          discount?: number | null;
          tax_amount?: number | null;
          total?: number;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          team_id?: string;
          variant_id?: string | null;
          product_name?: string;
          variant_name?: string | null;
          sku?: string | null;
          quantity?: number;
          unit_price?: number;
          discount?: number | null;
          tax_amount?: number | null;
          total?: number;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          team_id: string;
          amount: number;
          method: string | null;
          transaction_id: string | null;
          status: "pending" | "completed" | "failed" | "refunded";
          paid_at: string | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          team_id?: string;
          amount: number;
          method?: string | null;
          transaction_id?: string | null;
          status?: "pending" | "completed" | "failed" | "refunded";
          paid_at?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          team_id?: string;
          amount?: number;
          method?: string | null;
          transaction_id?: string | null;
          status?: "pending" | "completed" | "failed" | "refunded";
          paid_at?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      chart_of_accounts: {
        Row: {
          id: string;
          team_id: string;
          code: string;
          name: string;
          account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
          parent_id: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          code: string;
          name: string;
          account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
          parent_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          code?: string;
          name?: string;
          account_type?: "asset" | "liability" | "equity" | "revenue" | "expense";
          parent_id?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      general_ledger: {
        Row: {
          id: string;
          team_id: string;
          account_id: string;
          date: string;
          description: string | null;
          debit: number | null;
          credit: number | null;
          reference_type: string | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          account_id: string;
          date: string;
          description?: string | null;
          debit?: number | null;
          credit?: number | null;
          reference_type?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          account_id?: string;
          date?: string;
          description?: string | null;
          debit?: number | null;
          credit?: number | null;
          reference_type?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "general_ledger_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "general_ledger_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_revenue: {
        Row: {
          id: string;
          team_id: string;
          order_id: string;
          platform_id: string;
          gross_revenue: number;
          discount: number | null;
          net_revenue: number;
          tax_collected: number | null;
          date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          order_id: string;
          platform_id: string;
          gross_revenue?: number;
          discount?: number | null;
          net_revenue?: number;
          tax_collected?: number | null;
          date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          order_id?: string;
          platform_id?: string;
          gross_revenue?: number;
          discount?: number | null;
          net_revenue?: number;
          tax_collected?: number | null;
          date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_revenue_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_revenue_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_revenue_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          team_id: string;
          category: string;
          subcategory: string | null;
          description: string;
          amount: number;
          gst_amount: number | null;
          gst_rate: number | null;
          vendor: string | null;
          invoice_number: string | null;
          receipt_url: string | null;
          date: string;
          is_recurring: boolean | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          category: string;
          subcategory?: string | null;
          description: string;
          amount: number;
          gst_amount?: number | null;
          gst_rate?: number | null;
          vendor?: string | null;
          invoice_number?: string | null;
          receipt_url?: string | null;
          date: string;
          is_recurring?: boolean | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          category?: string;
          subcategory?: string | null;
          description?: string;
          amount?: number;
          gst_amount?: number | null;
          gst_rate?: number | null;
          vendor?: string | null;
          invoice_number?: string | null;
          receipt_url?: string | null;
          date?: string;
          is_recurring?: boolean | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_fees: {
        Row: {
          id: string;
          team_id: string;
          order_id: string | null;
          platform_id: string;
          fee_type: string;
          amount: number;
          description: string | null;
          date: string;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          order_id?: string | null;
          platform_id: string;
          fee_type: string;
          amount: number;
          description?: string | null;
          date: string;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          order_id?: string | null;
          platform_id?: string;
          fee_type?: string;
          amount?: number;
          description?: string | null;
          date?: string;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_fees_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_fees_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_fees_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      gst_transactions: {
        Row: {
          id: string;
          team_id: string;
          reference_type: string;
          reference_id: string;
          hsn_code: string | null;
          taxable_amount: number;
          cgst_rate: number | null;
          cgst_amount: number | null;
          sgst_rate: number | null;
          sgst_amount: number | null;
          igst_rate: number | null;
          igst_amount: number | null;
          total_tax: number;
          transaction_type: "output" | "input";
          date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          reference_type: string;
          reference_id: string;
          hsn_code?: string | null;
          taxable_amount: number;
          cgst_rate?: number | null;
          cgst_amount?: number | null;
          sgst_rate?: number | null;
          sgst_amount?: number | null;
          igst_rate?: number | null;
          igst_amount?: number | null;
          total_tax: number;
          transaction_type: "output" | "input";
          date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          reference_type?: string;
          reference_id?: string;
          hsn_code?: string | null;
          taxable_amount?: number;
          cgst_rate?: number | null;
          cgst_amount?: number | null;
          sgst_rate?: number | null;
          sgst_amount?: number | null;
          igst_rate?: number | null;
          igst_amount?: number | null;
          total_tax?: number;
          transaction_type?: "output" | "input";
          date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gst_transactions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      cogs_records: {
        Row: {
          id: string;
          team_id: string;
          order_item_id: string | null;
          variant_id: string | null;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          order_item_id?: string | null;
          variant_id?: string | null;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          order_item_id?: string | null;
          variant_id?: string | null;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cogs_records_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cogs_records_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cogs_records_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      pl_summary: {
        Row: {
          id: string;
          team_id: string;
          period_start: string;
          period_end: string;
          gross_revenue: number | null;
          net_revenue: number | null;
          cogs: number | null;
          gross_profit: number | null;
          platform_fees: number | null;
          shipping_costs: number | null;
          other_expenses: number | null;
          total_expenses: number | null;
          net_profit: number | null;
          margin_percentage: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          period_start: string;
          period_end: string;
          gross_revenue?: number | null;
          net_revenue?: number | null;
          cogs?: number | null;
          gross_profit?: number | null;
          platform_fees?: number | null;
          shipping_costs?: number | null;
          other_expenses?: number | null;
          total_expenses?: number | null;
          net_profit?: number | null;
          margin_percentage?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          period_start?: string;
          period_end?: string;
          gross_revenue?: number | null;
          net_revenue?: number | null;
          cogs?: number | null;
          gross_profit?: number | null;
          platform_fees?: number | null;
          shipping_costs?: number | null;
          other_expenses?: number | null;
          total_expenses?: number | null;
          net_profit?: number | null;
          margin_percentage?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pl_summary_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_cycles: {
        Row: {
          id: string;
          team_id: string;
          platform_id: string;
          settlement_id: string | null;
          period_start: string | null;
          period_end: string | null;
          total_amount: number | null;
          status: "pending" | "processing" | "completed" | "disputed";
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          platform_id: string;
          settlement_id?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          total_amount?: number | null;
          status?: "pending" | "processing" | "completed" | "disputed";
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          platform_id?: string;
          settlement_id?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          total_amount?: number | null;
          status?: "pending" | "processing" | "completed" | "disputed";
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_cycles_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_cycles_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_transactions: {
        Row: {
          id: string;
          settlement_id: string;
          team_id: string;
          order_id: string | null;
          transaction_type: string;
          amount: number;
          description: string | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          settlement_id: string;
          team_id?: string;
          order_id?: string | null;
          transaction_type: string;
          amount: number;
          description?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          settlement_id?: string;
          team_id?: string;
          order_id?: string | null;
          transaction_type?: string;
          amount?: number;
          description?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_transactions_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlement_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_transactions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_transactions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payouts: {
        Row: {
          id: string;
          team_id: string;
          settlement_id: string | null;
          platform_id: string;
          amount: number;
          bank_reference: string | null;
          payout_date: string | null;
          status: "expected" | "received" | "disputed";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          settlement_id?: string | null;
          platform_id: string;
          amount: number;
          bank_reference?: string | null;
          payout_date?: string | null;
          status?: "expected" | "received" | "disputed";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          settlement_id?: string | null;
          platform_id?: string;
          amount?: number;
          bank_reference?: string | null;
          payout_date?: string | null;
          status?: "expected" | "received" | "disputed";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlement_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_logs: {
        Row: {
          id: string;
          team_id: string;
          platform_id: string;
          sync_type: string;
          status: "running" | "completed" | "failed" | "partial";
          records_processed: number | null;
          records_created: number | null;
          records_updated: number | null;
          records_failed: number | null;
          error_message: string | null;
          metadata: Json | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string;
          platform_id: string;
          sync_type: string;
          status?: "running" | "completed" | "failed" | "partial";
          records_processed?: number | null;
          records_created?: number | null;
          records_updated?: number | null;
          records_failed?: number | null;
          error_message?: string | null;
          metadata?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          platform_id?: string;
          sync_type?: string;
          status?: "running" | "completed" | "failed" | "partial";
          records_processed?: number | null;
          records_created?: number | null;
          records_updated?: number | null;
          records_failed?: number | null;
          error_message?: string | null;
          metadata?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_logs_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_logs_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: {
          id: string;
          team_id: string | null;
          platform_id: string | null;
          event_type: string;
          payload: Json;
          processed: boolean | null;
          error: string | null;
          received_at: string | null;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          team_id?: string | null;
          platform_id?: string | null;
          event_type: string;
          payload: Json;
          processed?: boolean | null;
          error?: string | null;
          received_at?: string | null;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string | null;
          platform_id?: string | null;
          event_type?: string;
          payload?: Json;
          processed?: boolean | null;
          error?: string | null;
          received_at?: string | null;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_events_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_events_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_team_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      detect_inventory_discrepancies: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

// Convenience aliases matching the user's requested naming
export type Insertable<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type Updatable<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
