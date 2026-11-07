-- AuraLink / Busha Build Day Supabase Schema

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) PRIMARY KEY,
    merchant_id VARCHAR(64) NOT NULL DEFAULT 'amaka',
    customer VARCHAR(128) NOT NULL,
    handle VARCHAR(64),
    city VARCHAR(64),
    channel VARCHAR(16) NOT NULL DEFAULT 'NGN', -- 'NGN' | 'USDC'
    items JSONB NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL,
    discount NUMERIC(14, 2) DEFAULT 0,
    total NUMERIC(14, 2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'awaiting', -- awaiting | paid | underpaid | expired | late_paid | cancelled
    ref VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    received_ngn NUMERIC(14, 2),
    note TEXT,
    timeline JSONB DEFAULT '[]'::jsonb
);

-- Index for quick lookup on reference (used by buyer page) and status
CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders (ref);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- 2. Payments Table (Idempotency and Audit Log)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(32) REFERENCES orders(id) ON DELETE SET NULL,
    busha_event_id VARCHAR(128) UNIQUE NOT NULL,
    amount_received NUMERIC(18, 6) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    network VARCHAR(32),
    naira_value NUMERIC(14, 2) NOT NULL,
    fee NUMERIC(14, 2) NOT NULL,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_busha_event ON payments (busha_event_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);

-- 3. Ledger Table
CREATE TABLE IF NOT EXISTS ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(32) REFERENCES orders(id) ON DELETE SET NULL,
    customer VARCHAR(128) NOT NULL,
    amount_received NUMERIC(18, 6) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    naira_value NUMERIC(14, 2) NOT NULL,
    fee NUMERIC(14, 2) NOT NULL,
    net NUMERIC(14, 2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'settled', -- settled | pending | flagged
    busha_event_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger (created_at DESC);

-- 4. Balances Table
CREATE TABLE IF NOT EXISTS balances (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'amaka',
    ngn NUMERIC(14, 2) NOT NULL DEFAULT 842500,
    usdc NUMERIC(14, 2) NOT NULL DEFAULT 620,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize default balance row
INSERT INTO balances (id, ngn, usdc)
VALUES ('amaka', 842500, 620)
ON CONFLICT (id) DO NOTHING;

-- 5. Products Catalogue Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    price NUMERIC(14, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    emoji VARCHAR(16) NOT NULL,
    sku VARCHAR(32) NOT NULL
);

-- Seed products matching Amaka's boutique catalogue
INSERT INTO products (id, name, price, stock, emoji, sku) VALUES
('prod-1', 'Aso-Oke Crop Jacket', 48500, 14, '🧥', 'JKT-ASO-01'),
('prod-2', 'Adire Silk Maxi Dress', 62000, 8, '👗', 'DRS-ADR-02'),
('prod-3', 'Linen Wide-Leg Trouser', 34000, 22, '👖', 'TRS-LIN-03'),
('prod-4', 'Hand-woven Tote', 22500, 5, '👜', 'BAG-TOT-04'),
('prod-5', 'Beaded Waist Beads (Set)', 12000, 40, '📿', 'ACC-WST-05'),
('prod-6', 'Silk Wrap Scarf', 18500, 0, '🧣', 'SCF-SLK-06')
ON CONFLICT (id) DO NOTHING;
