create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

drop extension if exists "pg_net";

create sequence "public"."security_logs_id_seq";

drop policy "public_view_active_products" on "public"."products";

drop policy "shopping_carts_delete_self_or_admin" on "public"."shopping_carts";

drop policy "shopping_carts_insert_self" on "public"."shopping_carts";

drop policy "shopping_carts_select_self" on "public"."shopping_carts";

drop policy "shopping_carts_update_self" on "public"."shopping_carts";

drop policy "orders_delete_admin" on "public"."orders";

drop policy "orders_select_admin" on "public"."orders";

drop policy "orders_update_admin" on "public"."orders";

revoke delete on table "public"."active_products_sync" from "anon";

revoke insert on table "public"."active_products_sync" from "anon";

revoke references on table "public"."active_products_sync" from "anon";

revoke select on table "public"."active_products_sync" from "anon";

revoke trigger on table "public"."active_products_sync" from "anon";

revoke truncate on table "public"."active_products_sync" from "anon";

revoke update on table "public"."active_products_sync" from "anon";

revoke delete on table "public"."active_products_sync" from "authenticated";

revoke insert on table "public"."active_products_sync" from "authenticated";

revoke references on table "public"."active_products_sync" from "authenticated";

revoke select on table "public"."active_products_sync" from "authenticated";

revoke trigger on table "public"."active_products_sync" from "authenticated";

revoke truncate on table "public"."active_products_sync" from "authenticated";

revoke update on table "public"."active_products_sync" from "authenticated";

revoke delete on table "public"."active_products_sync" from "service_role";

revoke insert on table "public"."active_products_sync" from "service_role";

revoke references on table "public"."active_products_sync" from "service_role";

revoke select on table "public"."active_products_sync" from "service_role";

revoke trigger on table "public"."active_products_sync" from "service_role";

revoke truncate on table "public"."active_products_sync" from "service_role";

revoke update on table "public"."active_products_sync" from "service_role";

revoke delete on table "public"."password_reset_logs" from "anon";

revoke insert on table "public"."password_reset_logs" from "anon";

revoke references on table "public"."password_reset_logs" from "anon";

revoke select on table "public"."password_reset_logs" from "anon";

revoke trigger on table "public"."password_reset_logs" from "anon";

revoke truncate on table "public"."password_reset_logs" from "anon";

revoke update on table "public"."password_reset_logs" from "anon";

revoke delete on table "public"."password_reset_logs" from "authenticated";

revoke insert on table "public"."password_reset_logs" from "authenticated";

revoke references on table "public"."password_reset_logs" from "authenticated";

revoke select on table "public"."password_reset_logs" from "authenticated";

revoke trigger on table "public"."password_reset_logs" from "authenticated";

revoke truncate on table "public"."password_reset_logs" from "authenticated";

revoke update on table "public"."password_reset_logs" from "authenticated";

revoke delete on table "public"."password_reset_logs" from "service_role";

revoke insert on table "public"."password_reset_logs" from "service_role";

revoke references on table "public"."password_reset_logs" from "service_role";

revoke select on table "public"."password_reset_logs" from "service_role";

revoke trigger on table "public"."password_reset_logs" from "service_role";

revoke truncate on table "public"."password_reset_logs" from "service_role";

revoke update on table "public"."password_reset_logs" from "service_role";

drop view if exists "public"."active_products";

drop function if exists "public"."set_session_id"(session_id text);

alter table "public"."active_products_sync" drop constraint "active_products_pkey";

alter table "public"."password_reset_logs" drop constraint "password_reset_logs_pkey";

drop index if exists "public"."idx_password_reset_logs_target_user";

drop index if exists "public"."idx_products_active_primary_category";

drop index if exists "public"."idx_products_primary_category";

drop index if exists "public"."password_reset_logs_pkey";

drop index if exists "public"."active_products_pkey";

drop table "public"."active_products_sync";

drop table "public"."password_reset_logs";


  create table "public"."active_products" (
    "id" uuid not null,
    "sku" text,
    "name" text not null,
    "short_desc" text,
    "long_desc" text,
    "price_cents" integer not null,
    "currency" text default 'INR'::text,
    "category" text,
    "is_active" boolean default true,
    "show_on_index" boolean default true,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."active_products" enable row level security;


  create table "public"."admin_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "role" text not null,
    "permissions" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."admin_roles" enable row level security;


  create table "public"."admin_totp_secrets" (
    "id" uuid not null default gen_random_uuid(),
    "secret_base32" text not null,
    "label" text default 'ACE#1 Admin'::text,
    "issuer" text default 'ACE1'::text,
    "active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."admin_totp_secrets" enable row level security;


  create table "public"."analytics_daily" (
    "id" uuid not null default gen_random_uuid(),
    "date" date not null,
    "total_orders" integer default 0,
    "total_revenue_cents" bigint default 0,
    "total_customers" integer default 0,
    "new_customers" integer default 0,
    "page_views" integer default 0,
    "unique_visitors" integer default 0,
    "abandoned_carts" integer default 0,
    "conversion_rate" numeric(5,2),
    "avg_order_value_cents" integer default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."analytics_daily" enable row level security;


  create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "user_email" text,
    "action" text not null,
    "entity_type" text,
    "entity_id" text,
    "old_values" jsonb,
    "new_values" jsonb,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "slug" text not null,
    "description" text,
    "image_url" text,
    "parent_id" uuid,
    "sort_order" integer default 0,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."categories" enable row level security;


  create table "public"."content_blocks" (
    "id" uuid not null default gen_random_uuid(),
    "block_type" text not null,
    "title" text,
    "content" text,
    "image_url" text,
    "link_url" text,
    "link_text" text,
    "position" text,
    "sort_order" integer default 0,
    "is_active" boolean default true,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."content_blocks" enable row level security;


  create table "public"."coupons" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "description" text,
    "discount_type" text not null,
    "discount_value" numeric(10,2) not null,
    "min_order_value_cents" integer default 0,
    "max_discount_cents" integer,
    "usage_limit" integer,
    "usage_count" integer default 0,
    "per_user_limit" integer default 1,
    "applicable_products" jsonb,
    "applicable_categories" jsonb,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "is_active" boolean default true,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."coupons" enable row level security;


  create table "public"."csrf_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "token" text not null,
    "session_id" text not null,
    "created_at" timestamp without time zone default now(),
    "expires_at" timestamp without time zone not null
      );


alter table "public"."csrf_tokens" enable row level security;


  create table "public"."customer_notes" (
    "id" uuid not null default gen_random_uuid(),
    "customer_id" uuid not null,
    "note" text not null,
    "note_type" text default 'general'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."customer_notes" enable row level security;


  create table "public"."email_templates" (
    "id" uuid not null default gen_random_uuid(),
    "template_type" text not null,
    "subject" text not null,
    "body_html" text not null,
    "body_text" text,
    "variables" jsonb,
    "is_active" boolean default true,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."email_templates" enable row level security;


  create table "public"."inventory_adjustments" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" uuid,
    "adjustment_type" text not null,
    "quantity_change" integer not null,
    "quantity_before" integer,
    "quantity_after" integer,
    "size" text,
    "reason" text,
    "reference_id" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."inventory_adjustments" enable row level security;


  create table "public"."page_views" (
    "id" uuid not null default gen_random_uuid(),
    "visitor_id" text not null,
    "page_url" text not null,
    "page_title" text,
    "referrer" text,
    "user_agent" text,
    "ip_address" text,
    "user_id" uuid,
    "session_id" text,
    "device_type" text,
    "country" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."page_views" enable row level security;


  create table "public"."product_changes" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" uuid not null,
    "actor_id" uuid,
    "actor_email" text,
    "change_time" timestamp with time zone not null default now(),
    "change_summary" text,
    "change_diff" jsonb not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."product_changes" enable row level security;


  create table "public"."product_variants" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" uuid,
    "sku" text,
    "size" text,
    "color" text,
    "price_cents" integer,
    "stock" integer default 0,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."product_variants" enable row level security;


  create table "public"."security_logs" (
    "id" integer not null default nextval('public.security_logs_id_seq'::regclass),
    "timestamp" timestamp with time zone default now(),
    "event" text,
    "details" jsonb,
    "user_agent" text,
    "ip_address" text,
    "url" text
      );


alter table "public"."security_logs" enable row level security;


  create table "public"."shipping_methods" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "carrier" text,
    "base_rate_cents" integer default 0,
    "free_shipping_threshold_cents" integer,
    "estimated_days_min" integer,
    "estimated_days_max" integer,
    "is_active" boolean default true,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."shipping_methods" enable row level security;


  create table "public"."site_settings" (
    "id" integer not null default 1,
    "site_title" text,
    "site_description" text,
    "contact_email" text,
    "contact_phone" text,
    "instagram_url" text,
    "maintenance_mode" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "admin_api_url" text
      );


alter table "public"."site_settings" enable row level security;


  create table "public"."store_settings" (
    "id" integer not null default 1,
    "store_name" text default 'ACE#1'::text,
    "store_email" text,
    "store_phone" text,
    "store_address" jsonb,
    "currency" text default 'INR'::text,
    "currency_symbol" text default '₹'::text,
    "tax_rate" numeric(5,2) default 0,
    "tax_inclusive" boolean default true,
    "timezone" text default 'Asia/Kolkata'::text,
    "date_format" text default 'DD/MM/YYYY'::text,
    "low_stock_threshold" integer default 10,
    "enable_reviews" boolean default true,
    "enable_wishlist" boolean default true,
    "enable_guest_checkout" boolean default false,
    "social_links" jsonb default '{}'::jsonb,
    "seo_settings" jsonb default '{}'::jsonb,
    "payment_settings" jsonb default '{}'::jsonb,
    "shipping_settings" jsonb default '{}'::jsonb,
    "notification_settings" jsonb default '{}'::jsonb,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."store_settings" enable row level security;


  create table "public"."wishlists" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "session_id" text,
    "product_id" uuid not null,
    "added_at" timestamp with time zone default now()
      );


alter table "public"."wishlists" enable row level security;

alter table "public"."cart_items" enable row level security;

alter table "public"."inventory" enable row level security;

alter table "public"."order_items" enable row level security;

alter table "public"."orders" add column "coupon_id" uuid;

alter table "public"."orders" add column "delivered_at" timestamp with time zone;

alter table "public"."orders" add column "discount_cents" integer default 0;

alter table "public"."orders" add column "refund_amount_cents" integer;

alter table "public"."orders" add column "refund_reason" text;

alter table "public"."orders" add column "refund_status" text;

alter table "public"."orders" add column "shipped_at" timestamp with time zone;

alter table "public"."orders" add column "shipping_cents" integer default 0;

alter table "public"."orders" add column "shipping_method_id" uuid;

alter table "public"."orders" add column "tax_cents" integer default 0;

alter table "public"."orders" add column "tracking_number" text;

alter table "public"."orders" enable row level security;

alter table "public"."payments" enable row level security;

alter table "public"."product_images" enable row level security;

alter table "public"."products" add column "description" text;

alter table "public"."products" add column "show_on_index" boolean default true;

alter table "public"."reviews" add column "order_id" uuid;

alter table "public"."session_revocations" enable row level security;

alter table "public"."sessions" add column "ip_address" text;

alter table "public"."sessions" add column "jwt_token" text;

alter table "public"."sessions" add column "session_id" text;

alter table "public"."sessions" add column "user_agent" text;

alter table "public"."sessions" add column "user_data" jsonb;

alter table "public"."sessions" enable row level security;

alter table "public"."user_roles" enable row level security;

alter table "public"."users" enable row level security;

alter sequence "public"."security_logs_id_seq" owned by "public"."security_logs"."id";

CREATE UNIQUE INDEX admin_roles_pkey ON public.admin_roles USING btree (id);

CREATE UNIQUE INDEX admin_roles_user_id_key ON public.admin_roles USING btree (user_id);

CREATE UNIQUE INDEX admin_totp_secrets_pkey ON public.admin_totp_secrets USING btree (id);

CREATE UNIQUE INDEX analytics_daily_date_key ON public.analytics_daily USING btree (date);

CREATE UNIQUE INDEX analytics_daily_pkey ON public.analytics_daily USING btree (id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);

CREATE INDEX categories_parent_id_idx ON public.categories USING btree (parent_id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);

CREATE UNIQUE INDEX content_blocks_pkey ON public.content_blocks USING btree (id);

CREATE UNIQUE INDEX coupons_code_key ON public.coupons USING btree (code);

CREATE UNIQUE INDEX coupons_pkey ON public.coupons USING btree (id);

CREATE UNIQUE INDEX csrf_tokens_pkey ON public.csrf_tokens USING btree (id);

CREATE UNIQUE INDEX csrf_tokens_token_key ON public.csrf_tokens USING btree (token);

CREATE UNIQUE INDEX customer_notes_pkey ON public.customer_notes USING btree (id);

CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);

CREATE UNIQUE INDEX email_templates_template_type_key ON public.email_templates USING btree (template_type);

CREATE INDEX idx_admin_totp_active_created_at ON public.admin_totp_secrets USING btree (active DESC, created_at DESC);

CREATE INDEX idx_analytics_daily_date ON public.analytics_daily USING btree (date);

CREATE INDEX idx_audit_logs_date ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);

CREATE INDEX idx_content_blocks_type ON public.content_blocks USING btree (block_type);

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);

CREATE INDEX idx_csrf_tokens_expires_at ON public.csrf_tokens USING btree (expires_at);

CREATE INDEX idx_csrf_tokens_session_id ON public.csrf_tokens USING btree (session_id);

CREATE INDEX idx_csrf_tokens_token ON public.csrf_tokens USING btree (token);

CREATE INDEX idx_customer_notes_customer ON public.customer_notes USING btree (customer_id);

CREATE INDEX idx_inventory_adjustments_date ON public.inventory_adjustments USING btree (created_at);

CREATE INDEX idx_inventory_adjustments_product ON public.inventory_adjustments USING btree (product_id);

CREATE INDEX idx_product_changes_change_time ON public.product_changes USING btree (change_time DESC);

CREATE INDEX idx_product_changes_product_id ON public.product_changes USING btree (product_id);

CREATE INDEX idx_product_variants_product ON public.product_variants USING btree (product_id);

CREATE INDEX idx_products_active_and_featured ON public.products USING btree (is_active, show_on_index) WHERE ((is_active = true) AND (show_on_index = true));

CREATE INDEX idx_products_show_on_index ON public.products USING btree (show_on_index) WHERE (show_on_index = true);

CREATE INDEX idx_security_logs_timestamp ON public.security_logs USING btree ("timestamp" DESC);

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);

CREATE INDEX idx_sessions_session_id ON public.sessions USING btree (session_id);

CREATE INDEX idx_wishlists_product_id ON public.wishlists USING btree (product_id);

CREATE INDEX idx_wishlists_session_id ON public.wishlists USING btree (session_id);

CREATE INDEX idx_wishlists_user_id ON public.wishlists USING btree (user_id);

CREATE UNIQUE INDEX inventory_adjustments_pkey ON public.inventory_adjustments USING btree (id);

CREATE INDEX orders_coupon_id_idx ON public.orders USING btree (coupon_id);

CREATE INDEX orders_shipping_method_id_idx ON public.orders USING btree (shipping_method_id);

CREATE INDEX page_views_created_at_idx ON public.page_views USING btree (created_at DESC);

CREATE INDEX page_views_page_url_idx ON public.page_views USING btree (page_url);

CREATE UNIQUE INDEX page_views_pkey ON public.page_views USING btree (id);

CREATE INDEX page_views_user_id_idx ON public.page_views USING btree (user_id);

CREATE INDEX page_views_visitor_id_idx ON public.page_views USING btree (visitor_id);

CREATE UNIQUE INDEX product_changes_pkey ON public.product_changes USING btree (id);

CREATE UNIQUE INDEX product_variants_pkey ON public.product_variants USING btree (id);

CREATE UNIQUE INDEX product_variants_sku_key ON public.product_variants USING btree (sku);

CREATE INDEX reviews_order_product_idx ON public.reviews USING btree (order_id, product_id);

CREATE UNIQUE INDEX reviews_unique_per_order_product_user ON public.reviews USING btree (user_id, product_id, order_id) WHERE (order_id IS NOT NULL);

CREATE UNIQUE INDEX security_logs_pkey ON public.security_logs USING btree (id);

CREATE UNIQUE INDEX sessions_session_id_key ON public.sessions USING btree (session_id);

CREATE UNIQUE INDEX shipping_methods_pkey ON public.shipping_methods USING btree (id);

CREATE UNIQUE INDEX site_settings_pkey ON public.site_settings USING btree (id);

CREATE UNIQUE INDEX store_settings_pkey ON public.store_settings USING btree (id);

CREATE UNIQUE INDEX wishlists_pkey ON public.wishlists USING btree (id);

CREATE UNIQUE INDEX wishlists_session_id_product_id_key ON public.wishlists USING btree (session_id, product_id);

CREATE UNIQUE INDEX wishlists_user_id_product_id_key ON public.wishlists USING btree (user_id, product_id);

CREATE UNIQUE INDEX active_products_pkey ON public.active_products USING btree (id);

alter table "public"."active_products" add constraint "active_products_pkey" PRIMARY KEY using index "active_products_pkey";

alter table "public"."admin_roles" add constraint "admin_roles_pkey" PRIMARY KEY using index "admin_roles_pkey";

alter table "public"."admin_totp_secrets" add constraint "admin_totp_secrets_pkey" PRIMARY KEY using index "admin_totp_secrets_pkey";

alter table "public"."analytics_daily" add constraint "analytics_daily_pkey" PRIMARY KEY using index "analytics_daily_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."content_blocks" add constraint "content_blocks_pkey" PRIMARY KEY using index "content_blocks_pkey";

alter table "public"."coupons" add constraint "coupons_pkey" PRIMARY KEY using index "coupons_pkey";

alter table "public"."csrf_tokens" add constraint "csrf_tokens_pkey" PRIMARY KEY using index "csrf_tokens_pkey";

alter table "public"."customer_notes" add constraint "customer_notes_pkey" PRIMARY KEY using index "customer_notes_pkey";

alter table "public"."email_templates" add constraint "email_templates_pkey" PRIMARY KEY using index "email_templates_pkey";

alter table "public"."inventory_adjustments" add constraint "inventory_adjustments_pkey" PRIMARY KEY using index "inventory_adjustments_pkey";

alter table "public"."page_views" add constraint "page_views_pkey" PRIMARY KEY using index "page_views_pkey";

alter table "public"."product_changes" add constraint "product_changes_pkey" PRIMARY KEY using index "product_changes_pkey";

alter table "public"."product_variants" add constraint "product_variants_pkey" PRIMARY KEY using index "product_variants_pkey";

alter table "public"."security_logs" add constraint "security_logs_pkey" PRIMARY KEY using index "security_logs_pkey";

alter table "public"."shipping_methods" add constraint "shipping_methods_pkey" PRIMARY KEY using index "shipping_methods_pkey";

alter table "public"."site_settings" add constraint "site_settings_pkey" PRIMARY KEY using index "site_settings_pkey";

alter table "public"."store_settings" add constraint "store_settings_pkey" PRIMARY KEY using index "store_settings_pkey";

alter table "public"."wishlists" add constraint "wishlists_pkey" PRIMARY KEY using index "wishlists_pkey";

alter table "public"."admin_roles" add constraint "admin_roles_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'support'::text, 'warehouse'::text, 'marketing'::text, 'finance'::text]))) not valid;

alter table "public"."admin_roles" validate constraint "admin_roles_role_check";

alter table "public"."admin_roles" add constraint "admin_roles_user_id_key" UNIQUE using index "admin_roles_user_id_key";

alter table "public"."analytics_daily" add constraint "analytics_daily_date_key" UNIQUE using index "analytics_daily_date_key";

alter table "public"."categories" add constraint "categories_name_key" UNIQUE using index "categories_name_key";

alter table "public"."categories" add constraint "categories_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.categories(id) not valid;

alter table "public"."categories" validate constraint "categories_parent_id_fkey";

alter table "public"."categories" add constraint "categories_slug_key" UNIQUE using index "categories_slug_key";

alter table "public"."content_blocks" add constraint "content_blocks_block_type_check" CHECK ((block_type = ANY (ARRAY['banner'::text, 'announcement'::text, 'collection'::text, 'promo'::text, 'faq'::text, 'policy'::text]))) not valid;

alter table "public"."content_blocks" validate constraint "content_blocks_block_type_check";

alter table "public"."coupons" add constraint "coupons_code_key" UNIQUE using index "coupons_code_key";

alter table "public"."coupons" add constraint "coupons_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'free_shipping'::text]))) not valid;

alter table "public"."coupons" validate constraint "coupons_discount_type_check";

alter table "public"."csrf_tokens" add constraint "csrf_tokens_token_key" UNIQUE using index "csrf_tokens_token_key";

alter table "public"."customer_notes" add constraint "customer_notes_note_type_check" CHECK ((note_type = ANY (ARRAY['general'::text, 'support'::text, 'order'::text, 'refund'::text, 'complaint'::text]))) not valid;

alter table "public"."customer_notes" validate constraint "customer_notes_note_type_check";

alter table "public"."email_templates" add constraint "email_templates_template_type_check" CHECK ((template_type = ANY (ARRAY['order_confirmation'::text, 'order_shipped'::text, 'order_delivered'::text, 'order_cancelled'::text, 'refund_processed'::text, 'abandoned_cart'::text, 'welcome'::text, 'password_reset'::text, 'review_request'::text, 'promotional'::text, 'newsletter'::text]))) not valid;

alter table "public"."email_templates" validate constraint "email_templates_template_type_check";

alter table "public"."email_templates" add constraint "email_templates_template_type_key" UNIQUE using index "email_templates_template_type_key";

alter table "public"."inventory_adjustments" add constraint "inventory_adjustments_adjustment_type_check" CHECK ((adjustment_type = ANY (ARRAY['purchase'::text, 'sale'::text, 'return'::text, 'damage'::text, 'correction'::text, 'transfer'::text]))) not valid;

alter table "public"."inventory_adjustments" validate constraint "inventory_adjustments_adjustment_type_check";

alter table "public"."inventory_adjustments" add constraint "inventory_adjustments_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_adjustments" validate constraint "inventory_adjustments_product_id_fkey";

alter table "public"."orders" add constraint "orders_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) not valid;

alter table "public"."orders" validate constraint "orders_coupon_id_fkey";

alter table "public"."orders" add constraint "orders_shipping_method_id_fkey" FOREIGN KEY (shipping_method_id) REFERENCES public.shipping_methods(id) not valid;

alter table "public"."orders" validate constraint "orders_shipping_method_id_fkey";

alter table "public"."page_views" add constraint "page_views_device_type_check" CHECK ((device_type = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text]))) not valid;

alter table "public"."page_views" validate constraint "page_views_device_type_check";

alter table "public"."page_views" add constraint "page_views_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."page_views" validate constraint "page_views_user_id_fkey";

alter table "public"."product_variants" add constraint "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."product_variants" validate constraint "product_variants_product_id_fkey";

alter table "public"."product_variants" add constraint "product_variants_sku_key" UNIQUE using index "product_variants_sku_key";

alter table "public"."reviews" add constraint "reviews_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_order_id_fkey";

alter table "public"."sessions" add constraint "sessions_session_id_key" UNIQUE using index "sessions_session_id_key";

alter table "public"."site_settings" add constraint "single_row" CHECK ((id = 1)) not valid;

alter table "public"."site_settings" validate constraint "single_row";

alter table "public"."store_settings" add constraint "store_settings_id_check" CHECK ((id = 1)) not valid;

alter table "public"."store_settings" validate constraint "store_settings_id_check";

alter table "public"."wishlists" add constraint "wishlists_check" CHECK (((user_id IS NOT NULL) OR (session_id IS NOT NULL))) not valid;

alter table "public"."wishlists" validate constraint "wishlists_check";

alter table "public"."wishlists" add constraint "wishlists_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."wishlists" validate constraint "wishlists_product_id_fkey";

alter table "public"."wishlists" add constraint "wishlists_session_id_product_id_key" UNIQUE using index "wishlists_session_id_product_id_key";

alter table "public"."wishlists" add constraint "wishlists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."wishlists" validate constraint "wishlists_user_id_fkey";

alter table "public"."wishlists" add constraint "wishlists_user_id_product_id_key" UNIQUE using index "wishlists_user_id_product_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ace1_is_admin_session()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    session_token text;
    admin_email text;
BEGIN
    session_token := public.ace1_session_token();
    IF session_token IS NULL THEN
        RETURN false;
    END IF;

    SELECT u.email
    INTO admin_email
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.token = session_token
      AND s.expires_at > now()
    LIMIT 1;

    RETURN admin_email IS NOT NULL AND lower(admin_email) = 'hello@ace1.in';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ace1_session_token()
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    headers jsonb;
    auth_header text;
BEGIN
    BEGIN
        headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;

    auth_header := headers ->> 'authorization';
    IF auth_header IS NOT NULL AND length(trim(auth_header)) > 0 THEN
        -- Trim leading 'Bearer ' if present
        auth_header := regexp_replace(auth_header, '^Bearer\\s+', '', 'i');
    END IF;

    RETURN COALESCE(nullif(headers ->> 'ace1-session', ''), nullif(auth_header, ''));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_to_wishlist_by_session(p_session_id text, p_product_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO wishlists (session_id, product_id)
    VALUES (p_session_id, p_product_id)
    ON CONFLICT (session_id, product_id) DO NOTHING
    RETURNING id INTO v_id;
    
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM wishlists 
        WHERE session_id = p_session_id AND product_id = p_product_id;
    END IF;
    
    RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.sessions WHERE expires_at < NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.function_name()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Write your function logic here
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_wishlist_by_session(p_session_id text)
 RETURNS TABLE(id uuid, product_id uuid, added_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT w.id, w.product_id, w.added_at
    FROM wishlists w
    WHERE w.session_id = p_session_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND is_admin = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.log_audit_event(p_action text, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_audit_id UUID;
BEGIN
    -- Try to get current user info
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO public.audit_logs (user_id, user_email, action, entity_type, entity_id, old_values, new_values)
    VALUES (v_user_id, v_user_email, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_from_wishlist_by_session(p_session_id text, p_product_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM wishlists 
    WHERE session_id = p_session_id AND product_id = p_product_id;
    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_session_by_token(t text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.sessions WHERE token = t;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_sessions_for_email(p_email text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  deleted_count int := 0;
BEGIN
  SELECT id INTO uid FROM public.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF uid IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.sessions WHERE user_id = uid RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_session(p_session_id text)
 RETURNS TABLE(id uuid, user_id uuid, jwt_token text, user_data jsonb, expires_at timestamp with time zone, user_email text, user_first_name text, user_last_name text, user_phone text, user_role text, user_avatar text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.jwt_token,
        s.user_data,
        s.expires_at,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.role,
        u.avatar
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.session_id = p_session_id
    AND s.expires_at > NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_to_cart_by_session(p_session_id text, p_product_id uuid, p_quantity integer, p_size text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart_id UUID := public._ensure_cart_for_session(p_session_id);
  v_id UUID;
  v_existing_quantity INTEGER;
BEGIN
  SELECT id, quantity INTO v_id, v_existing_quantity
  FROM cart_items
  WHERE cart_id = v_cart_id
    AND product_id = p_product_id
    AND (size = p_size OR (size IS NULL AND p_size IS NULL))
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE cart_items SET quantity = v_existing_quantity + p_quantity, updated_at = now() WHERE id = v_id;
    RETURN v_id;
  ELSE
    INSERT INTO cart_items (cart_id, product_id, quantity, size) VALUES (v_cart_id, p_product_id, p_quantity, p_size) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_cart_by_session(p_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_cart_by_session(p_session_id text)
 RETURNS TABLE(id uuid, product_id uuid, quantity integer, size text, added_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.added_at
  FROM cart_items ci
  JOIN shopping_carts sc ON sc.id = ci.cart_id
  WHERE sc.session_id = p_session_id AND sc.user_id IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_session_cart_to_user(p_session_id text, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
  v_row RECORD;
BEGIN
  IF v_cart_id IS NULL THEN RETURN 0; END IF;

  FOR v_row IN SELECT product_id, quantity, size FROM cart_items WHERE cart_id = v_cart_id LOOP
    INSERT INTO shopping_carts (user_id, product_id, quantity, size) VALUES (p_user_id, v_row.product_id, v_row.quantity, v_row.size)
    ON CONFLICT (user_id, product_id, size) DO UPDATE SET quantity = shopping_carts.quantity + EXCLUDED.quantity, updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  DELETE FROM shopping_carts WHERE id = v_cart_id AND user_id IS NULL;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_from_cart_by_session(p_session_id text, p_product_id uuid, p_size text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  DELETE FROM cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_active_products()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- only maintain active_products for current active, not-deleted, show_on_index products
    IF NEW.deleted_at IS NULL AND NEW.is_active = true AND COALESCE(NEW.show_on_index, true) = true THEN
      INSERT INTO public.active_products (
        id, sku, name, short_desc, long_desc, price_cents, currency, category, is_active, show_on_index, deleted_at, created_at
      ) VALUES (
        NEW.id, NEW.sku, NEW.name, NEW.short_desc, NEW.long_desc, NEW.price_cents, NEW.currency, NEW.category, NEW.is_active, COALESCE(NEW.show_on_index, true), NEW.deleted_at, NEW.created_at
      ) ON CONFLICT (id) DO UPDATE
      SET sku = EXCLUDED.sku,
          name = EXCLUDED.name,
          short_desc = EXCLUDED.short_desc,
          long_desc = EXCLUDED.long_desc,
          price_cents = EXCLUDED.price_cents,
          currency = EXCLUDED.currency,
          category = EXCLUDED.category,
          is_active = EXCLUDED.is_active,
          show_on_index = EXCLUDED.show_on_index,
          deleted_at = EXCLUDED.deleted_at,
          created_at = COALESCE(EXCLUDED.created_at, public.active_products.created_at);
    ELSE
      -- if not active/visible, remove from active_products
      DELETE FROM public.active_products WHERE id = NEW.id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.active_products WHERE id = OLD.id;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_cart_item_by_session(p_session_id text, p_product_id uuid, p_quantity integer, p_size text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart_id UUID := (SELECT id FROM shopping_carts WHERE session_id = p_session_id LIMIT 1);
BEGIN
  IF v_cart_id IS NULL THEN RETURN FALSE; END IF;
  IF p_quantity <= 0 THEN
    DELETE FROM cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  ELSE
    UPDATE cart_items SET quantity = p_quantity, updated_at = now() WHERE cart_id = v_cart_id AND product_id = p_product_id AND (size = p_size OR (size IS NULL AND p_size IS NULL));
  END IF;
  RETURN FOUND;
END;
$function$
;

grant delete on table "public"."active_products" to "anon";

grant insert on table "public"."active_products" to "anon";

grant references on table "public"."active_products" to "anon";

grant select on table "public"."active_products" to "anon";

grant trigger on table "public"."active_products" to "anon";

grant truncate on table "public"."active_products" to "anon";

grant update on table "public"."active_products" to "anon";

grant delete on table "public"."active_products" to "authenticated";

grant insert on table "public"."active_products" to "authenticated";

grant references on table "public"."active_products" to "authenticated";

grant select on table "public"."active_products" to "authenticated";

grant trigger on table "public"."active_products" to "authenticated";

grant truncate on table "public"."active_products" to "authenticated";

grant update on table "public"."active_products" to "authenticated";

grant delete on table "public"."active_products" to "service_role";

grant insert on table "public"."active_products" to "service_role";

grant references on table "public"."active_products" to "service_role";

grant select on table "public"."active_products" to "service_role";

grant trigger on table "public"."active_products" to "service_role";

grant truncate on table "public"."active_products" to "service_role";

grant update on table "public"."active_products" to "service_role";

grant delete on table "public"."admin_roles" to "anon";

grant insert on table "public"."admin_roles" to "anon";

grant references on table "public"."admin_roles" to "anon";

grant select on table "public"."admin_roles" to "anon";

grant trigger on table "public"."admin_roles" to "anon";

grant truncate on table "public"."admin_roles" to "anon";

grant update on table "public"."admin_roles" to "anon";

grant delete on table "public"."admin_roles" to "authenticated";

grant insert on table "public"."admin_roles" to "authenticated";

grant references on table "public"."admin_roles" to "authenticated";

grant select on table "public"."admin_roles" to "authenticated";

grant trigger on table "public"."admin_roles" to "authenticated";

grant truncate on table "public"."admin_roles" to "authenticated";

grant update on table "public"."admin_roles" to "authenticated";

grant delete on table "public"."admin_roles" to "service_role";

grant insert on table "public"."admin_roles" to "service_role";

grant references on table "public"."admin_roles" to "service_role";

grant select on table "public"."admin_roles" to "service_role";

grant trigger on table "public"."admin_roles" to "service_role";

grant truncate on table "public"."admin_roles" to "service_role";

grant update on table "public"."admin_roles" to "service_role";

grant delete on table "public"."admin_totp_secrets" to "anon";

grant insert on table "public"."admin_totp_secrets" to "anon";

grant references on table "public"."admin_totp_secrets" to "anon";

grant select on table "public"."admin_totp_secrets" to "anon";

grant trigger on table "public"."admin_totp_secrets" to "anon";

grant truncate on table "public"."admin_totp_secrets" to "anon";

grant update on table "public"."admin_totp_secrets" to "anon";

grant delete on table "public"."admin_totp_secrets" to "authenticated";

grant insert on table "public"."admin_totp_secrets" to "authenticated";

grant references on table "public"."admin_totp_secrets" to "authenticated";

grant select on table "public"."admin_totp_secrets" to "authenticated";

grant trigger on table "public"."admin_totp_secrets" to "authenticated";

grant truncate on table "public"."admin_totp_secrets" to "authenticated";

grant update on table "public"."admin_totp_secrets" to "authenticated";

grant delete on table "public"."admin_totp_secrets" to "service_role";

grant insert on table "public"."admin_totp_secrets" to "service_role";

grant references on table "public"."admin_totp_secrets" to "service_role";

grant select on table "public"."admin_totp_secrets" to "service_role";

grant trigger on table "public"."admin_totp_secrets" to "service_role";

grant truncate on table "public"."admin_totp_secrets" to "service_role";

grant update on table "public"."admin_totp_secrets" to "service_role";

grant delete on table "public"."analytics_daily" to "anon";

grant insert on table "public"."analytics_daily" to "anon";

grant references on table "public"."analytics_daily" to "anon";

grant select on table "public"."analytics_daily" to "anon";

grant trigger on table "public"."analytics_daily" to "anon";

grant truncate on table "public"."analytics_daily" to "anon";

grant update on table "public"."analytics_daily" to "anon";

grant delete on table "public"."analytics_daily" to "authenticated";

grant insert on table "public"."analytics_daily" to "authenticated";

grant references on table "public"."analytics_daily" to "authenticated";

grant select on table "public"."analytics_daily" to "authenticated";

grant trigger on table "public"."analytics_daily" to "authenticated";

grant truncate on table "public"."analytics_daily" to "authenticated";

grant update on table "public"."analytics_daily" to "authenticated";

grant delete on table "public"."analytics_daily" to "service_role";

grant insert on table "public"."analytics_daily" to "service_role";

grant references on table "public"."analytics_daily" to "service_role";

grant select on table "public"."analytics_daily" to "service_role";

grant trigger on table "public"."analytics_daily" to "service_role";

grant truncate on table "public"."analytics_daily" to "service_role";

grant update on table "public"."analytics_daily" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."content_blocks" to "anon";

grant insert on table "public"."content_blocks" to "anon";

grant references on table "public"."content_blocks" to "anon";

grant select on table "public"."content_blocks" to "anon";

grant trigger on table "public"."content_blocks" to "anon";

grant truncate on table "public"."content_blocks" to "anon";

grant update on table "public"."content_blocks" to "anon";

grant delete on table "public"."content_blocks" to "authenticated";

grant insert on table "public"."content_blocks" to "authenticated";

grant references on table "public"."content_blocks" to "authenticated";

grant select on table "public"."content_blocks" to "authenticated";

grant trigger on table "public"."content_blocks" to "authenticated";

grant truncate on table "public"."content_blocks" to "authenticated";

grant update on table "public"."content_blocks" to "authenticated";

grant delete on table "public"."content_blocks" to "service_role";

grant insert on table "public"."content_blocks" to "service_role";

grant references on table "public"."content_blocks" to "service_role";

grant select on table "public"."content_blocks" to "service_role";

grant trigger on table "public"."content_blocks" to "service_role";

grant truncate on table "public"."content_blocks" to "service_role";

grant update on table "public"."content_blocks" to "service_role";

grant delete on table "public"."coupons" to "anon";

grant insert on table "public"."coupons" to "anon";

grant references on table "public"."coupons" to "anon";

grant select on table "public"."coupons" to "anon";

grant trigger on table "public"."coupons" to "anon";

grant truncate on table "public"."coupons" to "anon";

grant update on table "public"."coupons" to "anon";

grant delete on table "public"."coupons" to "authenticated";

grant insert on table "public"."coupons" to "authenticated";

grant references on table "public"."coupons" to "authenticated";

grant select on table "public"."coupons" to "authenticated";

grant trigger on table "public"."coupons" to "authenticated";

grant truncate on table "public"."coupons" to "authenticated";

grant update on table "public"."coupons" to "authenticated";

grant delete on table "public"."coupons" to "service_role";

grant insert on table "public"."coupons" to "service_role";

grant references on table "public"."coupons" to "service_role";

grant select on table "public"."coupons" to "service_role";

grant trigger on table "public"."coupons" to "service_role";

grant truncate on table "public"."coupons" to "service_role";

grant update on table "public"."coupons" to "service_role";

grant delete on table "public"."csrf_tokens" to "anon";

grant insert on table "public"."csrf_tokens" to "anon";

grant references on table "public"."csrf_tokens" to "anon";

grant select on table "public"."csrf_tokens" to "anon";

grant trigger on table "public"."csrf_tokens" to "anon";

grant truncate on table "public"."csrf_tokens" to "anon";

grant update on table "public"."csrf_tokens" to "anon";

grant delete on table "public"."csrf_tokens" to "authenticated";

grant insert on table "public"."csrf_tokens" to "authenticated";

grant references on table "public"."csrf_tokens" to "authenticated";

grant select on table "public"."csrf_tokens" to "authenticated";

grant trigger on table "public"."csrf_tokens" to "authenticated";

grant truncate on table "public"."csrf_tokens" to "authenticated";

grant update on table "public"."csrf_tokens" to "authenticated";

grant delete on table "public"."csrf_tokens" to "service_role";

grant insert on table "public"."csrf_tokens" to "service_role";

grant references on table "public"."csrf_tokens" to "service_role";

grant select on table "public"."csrf_tokens" to "service_role";

grant trigger on table "public"."csrf_tokens" to "service_role";

grant truncate on table "public"."csrf_tokens" to "service_role";

grant update on table "public"."csrf_tokens" to "service_role";

grant delete on table "public"."customer_notes" to "anon";

grant insert on table "public"."customer_notes" to "anon";

grant references on table "public"."customer_notes" to "anon";

grant select on table "public"."customer_notes" to "anon";

grant trigger on table "public"."customer_notes" to "anon";

grant truncate on table "public"."customer_notes" to "anon";

grant update on table "public"."customer_notes" to "anon";

grant delete on table "public"."customer_notes" to "authenticated";

grant insert on table "public"."customer_notes" to "authenticated";

grant references on table "public"."customer_notes" to "authenticated";

grant select on table "public"."customer_notes" to "authenticated";

grant trigger on table "public"."customer_notes" to "authenticated";

grant truncate on table "public"."customer_notes" to "authenticated";

grant update on table "public"."customer_notes" to "authenticated";

grant delete on table "public"."customer_notes" to "service_role";

grant insert on table "public"."customer_notes" to "service_role";

grant references on table "public"."customer_notes" to "service_role";

grant select on table "public"."customer_notes" to "service_role";

grant trigger on table "public"."customer_notes" to "service_role";

grant truncate on table "public"."customer_notes" to "service_role";

grant update on table "public"."customer_notes" to "service_role";

grant delete on table "public"."email_templates" to "anon";

grant insert on table "public"."email_templates" to "anon";

grant references on table "public"."email_templates" to "anon";

grant select on table "public"."email_templates" to "anon";

grant trigger on table "public"."email_templates" to "anon";

grant truncate on table "public"."email_templates" to "anon";

grant update on table "public"."email_templates" to "anon";

grant delete on table "public"."email_templates" to "authenticated";

grant insert on table "public"."email_templates" to "authenticated";

grant references on table "public"."email_templates" to "authenticated";

grant select on table "public"."email_templates" to "authenticated";

grant trigger on table "public"."email_templates" to "authenticated";

grant truncate on table "public"."email_templates" to "authenticated";

grant update on table "public"."email_templates" to "authenticated";

grant delete on table "public"."email_templates" to "service_role";

grant insert on table "public"."email_templates" to "service_role";

grant references on table "public"."email_templates" to "service_role";

grant select on table "public"."email_templates" to "service_role";

grant trigger on table "public"."email_templates" to "service_role";

grant truncate on table "public"."email_templates" to "service_role";

grant update on table "public"."email_templates" to "service_role";

grant delete on table "public"."inventory_adjustments" to "anon";

grant insert on table "public"."inventory_adjustments" to "anon";

grant references on table "public"."inventory_adjustments" to "anon";

grant select on table "public"."inventory_adjustments" to "anon";

grant trigger on table "public"."inventory_adjustments" to "anon";

grant truncate on table "public"."inventory_adjustments" to "anon";

grant update on table "public"."inventory_adjustments" to "anon";

grant delete on table "public"."inventory_adjustments" to "authenticated";

grant insert on table "public"."inventory_adjustments" to "authenticated";

grant references on table "public"."inventory_adjustments" to "authenticated";

grant select on table "public"."inventory_adjustments" to "authenticated";

grant trigger on table "public"."inventory_adjustments" to "authenticated";

grant truncate on table "public"."inventory_adjustments" to "authenticated";

grant update on table "public"."inventory_adjustments" to "authenticated";

grant delete on table "public"."inventory_adjustments" to "service_role";

grant insert on table "public"."inventory_adjustments" to "service_role";

grant references on table "public"."inventory_adjustments" to "service_role";

grant select on table "public"."inventory_adjustments" to "service_role";

grant trigger on table "public"."inventory_adjustments" to "service_role";

grant truncate on table "public"."inventory_adjustments" to "service_role";

grant update on table "public"."inventory_adjustments" to "service_role";

grant delete on table "public"."page_views" to "anon";

grant insert on table "public"."page_views" to "anon";

grant references on table "public"."page_views" to "anon";

grant select on table "public"."page_views" to "anon";

grant trigger on table "public"."page_views" to "anon";

grant truncate on table "public"."page_views" to "anon";

grant update on table "public"."page_views" to "anon";

grant delete on table "public"."page_views" to "authenticated";

grant insert on table "public"."page_views" to "authenticated";

grant references on table "public"."page_views" to "authenticated";

grant select on table "public"."page_views" to "authenticated";

grant trigger on table "public"."page_views" to "authenticated";

grant truncate on table "public"."page_views" to "authenticated";

grant update on table "public"."page_views" to "authenticated";

grant delete on table "public"."page_views" to "service_role";

grant insert on table "public"."page_views" to "service_role";

grant references on table "public"."page_views" to "service_role";

grant select on table "public"."page_views" to "service_role";

grant trigger on table "public"."page_views" to "service_role";

grant truncate on table "public"."page_views" to "service_role";

grant update on table "public"."page_views" to "service_role";

grant delete on table "public"."product_changes" to "anon";

grant insert on table "public"."product_changes" to "anon";

grant references on table "public"."product_changes" to "anon";

grant select on table "public"."product_changes" to "anon";

grant trigger on table "public"."product_changes" to "anon";

grant truncate on table "public"."product_changes" to "anon";

grant update on table "public"."product_changes" to "anon";

grant delete on table "public"."product_changes" to "authenticated";

grant insert on table "public"."product_changes" to "authenticated";

grant references on table "public"."product_changes" to "authenticated";

grant select on table "public"."product_changes" to "authenticated";

grant trigger on table "public"."product_changes" to "authenticated";

grant truncate on table "public"."product_changes" to "authenticated";

grant update on table "public"."product_changes" to "authenticated";

grant delete on table "public"."product_changes" to "service_role";

grant insert on table "public"."product_changes" to "service_role";

grant references on table "public"."product_changes" to "service_role";

grant select on table "public"."product_changes" to "service_role";

grant trigger on table "public"."product_changes" to "service_role";

grant truncate on table "public"."product_changes" to "service_role";

grant update on table "public"."product_changes" to "service_role";

grant delete on table "public"."product_variants" to "anon";

grant insert on table "public"."product_variants" to "anon";

grant references on table "public"."product_variants" to "anon";

grant select on table "public"."product_variants" to "anon";

grant trigger on table "public"."product_variants" to "anon";

grant truncate on table "public"."product_variants" to "anon";

grant update on table "public"."product_variants" to "anon";

grant delete on table "public"."product_variants" to "authenticated";

grant insert on table "public"."product_variants" to "authenticated";

grant references on table "public"."product_variants" to "authenticated";

grant select on table "public"."product_variants" to "authenticated";

grant trigger on table "public"."product_variants" to "authenticated";

grant truncate on table "public"."product_variants" to "authenticated";

grant update on table "public"."product_variants" to "authenticated";

grant delete on table "public"."product_variants" to "service_role";

grant insert on table "public"."product_variants" to "service_role";

grant references on table "public"."product_variants" to "service_role";

grant select on table "public"."product_variants" to "service_role";

grant trigger on table "public"."product_variants" to "service_role";

grant truncate on table "public"."product_variants" to "service_role";

grant update on table "public"."product_variants" to "service_role";

grant delete on table "public"."security_logs" to "anon";

grant insert on table "public"."security_logs" to "anon";

grant references on table "public"."security_logs" to "anon";

grant select on table "public"."security_logs" to "anon";

grant trigger on table "public"."security_logs" to "anon";

grant truncate on table "public"."security_logs" to "anon";

grant update on table "public"."security_logs" to "anon";

grant delete on table "public"."security_logs" to "authenticated";

grant insert on table "public"."security_logs" to "authenticated";

grant references on table "public"."security_logs" to "authenticated";

grant select on table "public"."security_logs" to "authenticated";

grant trigger on table "public"."security_logs" to "authenticated";

grant truncate on table "public"."security_logs" to "authenticated";

grant update on table "public"."security_logs" to "authenticated";

grant delete on table "public"."security_logs" to "service_role";

grant insert on table "public"."security_logs" to "service_role";

grant references on table "public"."security_logs" to "service_role";

grant select on table "public"."security_logs" to "service_role";

grant trigger on table "public"."security_logs" to "service_role";

grant truncate on table "public"."security_logs" to "service_role";

grant update on table "public"."security_logs" to "service_role";

grant delete on table "public"."shipping_methods" to "anon";

grant insert on table "public"."shipping_methods" to "anon";

grant references on table "public"."shipping_methods" to "anon";

grant select on table "public"."shipping_methods" to "anon";

grant trigger on table "public"."shipping_methods" to "anon";

grant truncate on table "public"."shipping_methods" to "anon";

grant update on table "public"."shipping_methods" to "anon";

grant delete on table "public"."shipping_methods" to "authenticated";

grant insert on table "public"."shipping_methods" to "authenticated";

grant references on table "public"."shipping_methods" to "authenticated";

grant select on table "public"."shipping_methods" to "authenticated";

grant trigger on table "public"."shipping_methods" to "authenticated";

grant truncate on table "public"."shipping_methods" to "authenticated";

grant update on table "public"."shipping_methods" to "authenticated";

grant delete on table "public"."shipping_methods" to "service_role";

grant insert on table "public"."shipping_methods" to "service_role";

grant references on table "public"."shipping_methods" to "service_role";

grant select on table "public"."shipping_methods" to "service_role";

grant trigger on table "public"."shipping_methods" to "service_role";

grant truncate on table "public"."shipping_methods" to "service_role";

grant update on table "public"."shipping_methods" to "service_role";

grant delete on table "public"."site_settings" to "anon";

grant insert on table "public"."site_settings" to "anon";

grant references on table "public"."site_settings" to "anon";

grant select on table "public"."site_settings" to "anon";

grant trigger on table "public"."site_settings" to "anon";

grant truncate on table "public"."site_settings" to "anon";

grant update on table "public"."site_settings" to "anon";

grant delete on table "public"."site_settings" to "authenticated";

grant insert on table "public"."site_settings" to "authenticated";

grant references on table "public"."site_settings" to "authenticated";

grant select on table "public"."site_settings" to "authenticated";

grant trigger on table "public"."site_settings" to "authenticated";

grant truncate on table "public"."site_settings" to "authenticated";

grant update on table "public"."site_settings" to "authenticated";

grant delete on table "public"."site_settings" to "service_role";

grant insert on table "public"."site_settings" to "service_role";

grant references on table "public"."site_settings" to "service_role";

grant select on table "public"."site_settings" to "service_role";

grant trigger on table "public"."site_settings" to "service_role";

grant truncate on table "public"."site_settings" to "service_role";

grant update on table "public"."site_settings" to "service_role";

grant delete on table "public"."store_settings" to "anon";

grant insert on table "public"."store_settings" to "anon";

grant references on table "public"."store_settings" to "anon";

grant select on table "public"."store_settings" to "anon";

grant trigger on table "public"."store_settings" to "anon";

grant truncate on table "public"."store_settings" to "anon";

grant update on table "public"."store_settings" to "anon";

grant delete on table "public"."store_settings" to "authenticated";

grant insert on table "public"."store_settings" to "authenticated";

grant references on table "public"."store_settings" to "authenticated";

grant select on table "public"."store_settings" to "authenticated";

grant trigger on table "public"."store_settings" to "authenticated";

grant truncate on table "public"."store_settings" to "authenticated";

grant update on table "public"."store_settings" to "authenticated";

grant delete on table "public"."store_settings" to "service_role";

grant insert on table "public"."store_settings" to "service_role";

grant references on table "public"."store_settings" to "service_role";

grant select on table "public"."store_settings" to "service_role";

grant trigger on table "public"."store_settings" to "service_role";

grant truncate on table "public"."store_settings" to "service_role";

grant update on table "public"."store_settings" to "service_role";

grant delete on table "public"."wishlists" to "anon";

grant insert on table "public"."wishlists" to "anon";

grant references on table "public"."wishlists" to "anon";

grant select on table "public"."wishlists" to "anon";

grant trigger on table "public"."wishlists" to "anon";

grant truncate on table "public"."wishlists" to "anon";

grant update on table "public"."wishlists" to "anon";

grant delete on table "public"."wishlists" to "authenticated";

grant insert on table "public"."wishlists" to "authenticated";

grant references on table "public"."wishlists" to "authenticated";

grant select on table "public"."wishlists" to "authenticated";

grant trigger on table "public"."wishlists" to "authenticated";

grant truncate on table "public"."wishlists" to "authenticated";

grant update on table "public"."wishlists" to "authenticated";

grant delete on table "public"."wishlists" to "service_role";

grant insert on table "public"."wishlists" to "service_role";

grant references on table "public"."wishlists" to "service_role";

grant select on table "public"."wishlists" to "service_role";

grant trigger on table "public"."wishlists" to "service_role";

grant truncate on table "public"."wishlists" to "service_role";

grant update on table "public"."wishlists" to "service_role";


  create policy "active_products_delete_admin"
  on "public"."active_products"
  as permissive
  for delete
  to public
using (security.is_admin());



  create policy "active_products_insert_admin"
  on "public"."active_products"
  as permissive
  for insert
  to public
with check (security.is_admin());



  create policy "active_products_select_admin"
  on "public"."active_products"
  as permissive
  for select
  to public
using (security.is_admin());



  create policy "active_products_select_public"
  on "public"."active_products"
  as permissive
  for select
  to public
using (true);



  create policy "active_products_update_admin"
  on "public"."active_products"
  as permissive
  for update
  to public
using (security.is_admin())
with check (security.is_admin());



  create policy "admin_all_admin_roles"
  on "public"."admin_roles"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "admin_totp_delete"
  on "public"."admin_totp_secrets"
  as permissive
  for delete
  to public
using ((auth.role() = 'service_role'::text));



  create policy "admin_totp_insert"
  on "public"."admin_totp_secrets"
  as permissive
  for insert
  to public
with check ((auth.role() = 'service_role'::text));



  create policy "admin_totp_select"
  on "public"."admin_totp_secrets"
  as permissive
  for select
  to public
using ((auth.role() = 'service_role'::text));



  create policy "admin_totp_update"
  on "public"."admin_totp_secrets"
  as permissive
  for update
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "admin_all_analytics"
  on "public"."analytics_daily"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "admin_all_audit_logs"
  on "public"."audit_logs"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "admin_all_categories"
  on "public"."categories"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "public_read_categories"
  on "public"."categories"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "admin_all_content_blocks"
  on "public"."content_blocks"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "public_read_content_blocks"
  on "public"."content_blocks"
  as permissive
  for select
  to public
using (((is_active = true) AND ((start_date IS NULL) OR (start_date <= now())) AND ((end_date IS NULL) OR (end_date >= now()))));



  create policy "admin_all_coupons"
  on "public"."coupons"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "public_read_active_coupons"
  on "public"."coupons"
  as permissive
  for select
  to public
using (((is_active = true) AND ((start_date IS NULL) OR (start_date <= now())) AND ((end_date IS NULL) OR (end_date >= now()))));



  create policy "delete_expired_csrf_tokens"
  on "public"."csrf_tokens"
  as permissive
  for delete
  to public
using ((expires_at < now()));



  create policy "insert_csrf_tokens"
  on "public"."csrf_tokens"
  as permissive
  for insert
  to public
with check (true);



  create policy "public_read_csrf_tokens"
  on "public"."csrf_tokens"
  as permissive
  for select
  to public
using (true);



  create policy "admin_all_customer_notes"
  on "public"."customer_notes"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "admin_all_email_templates"
  on "public"."email_templates"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "inventory_select_all"
  on "public"."inventory"
  as permissive
  for select
  to public
using (true);



  create policy "admin_all_inventory_adjustments"
  on "public"."inventory_adjustments"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "order_items_insert_authenticated"
  on "public"."order_items"
  as permissive
  for insert
  to public
with check (true);



  create policy "order_items_select_own"
  on "public"."order_items"
  as permissive
  for select
  to public
using ((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "select_order_items_own"
  on "public"."order_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));



  create policy "insert_orders_user"
  on "public"."orders"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "orders_insert_own"
  on "public"."orders"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "orders_update_own"
  on "public"."orders"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "select_own_orders"
  on "public"."orders"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "update_own_orders"
  on "public"."orders"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "page_views_insert"
  on "public"."page_views"
  as permissive
  for insert
  to public
with check (true);



  create policy "page_views_select_admin"
  on "public"."page_views"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.is_admin = true)))));



  create policy "payments_insert_system"
  on "public"."payments"
  as permissive
  for insert
  to public
with check (true);



  create policy "payments_select_own"
  on "public"."payments"
  as permissive
  for select
  to public
using ((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "product_changes_admin_access"
  on "public"."product_changes"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.is_admin = true))))))
with check ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.is_admin = true))))));



  create policy "product_changes_insert_admin"
  on "public"."product_changes"
  as permissive
  for insert
  to public
with check (security.is_admin());



  create policy "product_changes_select_admin"
  on "public"."product_changes"
  as permissive
  for select
  to public
using (security.is_admin());



  create policy "product_deletion_audit_insert_admin"
  on "public"."product_deletion_audit"
  as permissive
  for insert
  to public
with check (security.is_admin());



  create policy "product_deletion_audit_select_admin"
  on "public"."product_deletion_audit"
  as permissive
  for select
  to public
using (security.is_admin());



  create policy "product_images_select_all"
  on "public"."product_images"
  as permissive
  for select
  to public
using (true);



  create policy "public_select_product_images"
  on "public"."product_images"
  as permissive
  for select
  to public
using (true);



  create policy "admin_all_product_variants"
  on "public"."product_variants"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "security_logs_delete_admin"
  on "public"."security_logs"
  as permissive
  for delete
  to public
using (security.is_admin());



  create policy "security_logs_delete_all"
  on "public"."security_logs"
  as permissive
  for delete
  to public
using (true);



  create policy "security_logs_insert_admin"
  on "public"."security_logs"
  as permissive
  for insert
  to public
with check (security.is_admin());



  create policy "security_logs_insert_all"
  on "public"."security_logs"
  as permissive
  for insert
  to public
with check (true);



  create policy "security_logs_select_admin"
  on "public"."security_logs"
  as permissive
  for select
  to public
using (security.is_admin());



  create policy "security_logs_select_all"
  on "public"."security_logs"
  as permissive
  for select
  to public
using (true);



  create policy "security_logs_update_admin"
  on "public"."security_logs"
  as permissive
  for update
  to public
using (security.is_admin())
with check (security.is_admin());



  create policy "sessions_delete_token"
  on "public"."sessions"
  as permissive
  for delete
  to public
using (((public.ace1_session_token() IS NOT NULL) AND (token = public.ace1_session_token())));



  create policy "sessions_insert_public"
  on "public"."sessions"
  as permissive
  for insert
  to public
with check (true);



  create policy "sessions_select_token"
  on "public"."sessions"
  as permissive
  for select
  to public
using (((public.ace1_session_token() IS NOT NULL) AND (token = public.ace1_session_token())));



  create policy "sessions_update_token"
  on "public"."sessions"
  as permissive
  for update
  to public
using (((public.ace1_session_token() IS NOT NULL) AND (token = public.ace1_session_token())))
with check (((public.ace1_session_token() IS NOT NULL) AND (token = public.ace1_session_token())));



  create policy "admin_all_shipping_methods"
  on "public"."shipping_methods"
  as permissive
  for all
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "public_read_shipping_methods"
  on "public"."shipping_methods"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "Authenticated users can add to cart"
  on "public"."shopping_carts"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Authenticated users can remove from cart"
  on "public"."shopping_carts"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Authenticated users can update cart"
  on "public"."shopping_carts"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Authenticated users can view own cart"
  on "public"."shopping_carts"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "site_settings_delete_admin"
  on "public"."site_settings"
  as permissive
  for delete
  to public
using (security.is_admin());



  create policy "site_settings_insert_admin"
  on "public"."site_settings"
  as permissive
  for insert
  to public
with check (security.is_admin());



  create policy "site_settings_insert_all"
  on "public"."site_settings"
  as permissive
  for insert
  to public
with check (true);



  create policy "site_settings_select_all"
  on "public"."site_settings"
  as permissive
  for select
  to public
using (true);



  create policy "site_settings_update_admin"
  on "public"."site_settings"
  as permissive
  for update
  to public
using (security.is_admin())
with check (security.is_admin());



  create policy "site_settings_update_all"
  on "public"."site_settings"
  as permissive
  for update
  to public
using (true);



  create policy "admin_update_store_settings"
  on "public"."store_settings"
  as permissive
  for update
  to public
using ((public.ace1_is_admin_session() OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.is_admin = true))))));



  create policy "public_read_store_settings"
  on "public"."store_settings"
  as permissive
  for select
  to public
using (true);



  create policy "Users can view own role"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Authenticated users can add to wishlist"
  on "public"."wishlists"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Authenticated users can remove from wishlist"
  on "public"."wishlists"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Authenticated users can view own wishlist"
  on "public"."wishlists"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "orders_delete_admin"
  on "public"."orders"
  as permissive
  for delete
  to public
using (public.is_admin());



  create policy "orders_select_admin"
  on "public"."orders"
  as permissive
  for select
  to public
using (public.is_admin());



  create policy "orders_update_admin"
  on "public"."orders"
  as permissive
  for update
  to public
using (public.is_admin());



  create policy "Give anon users access to images in folder 10a042g_0"
  on "storage"."objects"
  as permissive
  for select
  to anon
using (((bucket_id = 'Images'::text) AND (storage.extension(name) = 'jpg'::text) AND (lower((storage.foldername(name))[1]) = 'public'::text) AND (auth.role() = 'anon'::text)));



