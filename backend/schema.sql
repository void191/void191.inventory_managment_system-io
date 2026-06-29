-- Drop existing tables
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS sales_order_lines CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_lines CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_levels CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Users and roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Core IMS tables
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(150),
  phone VARCHAR(30),
  region VARCHAR(100),
  performance_rating INTEGER DEFAULT 0
);

CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(150),
  total_bins INTEGER DEFAULT 0,
  occupancy_percent INTEGER DEFAULT 0
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  price NUMERIC(10,2),
  supplier_id INTEGER REFERENCES suppliers(id),
  reorder_threshold INTEGER DEFAULT 0,
  image_url TEXT,
  barcode VARCHAR(100),
  additional_details JSONB
);

CREATE TABLE stock_levels (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  on_hand INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0
);

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id),
  eta DATE,
  total_amount NUMERIC(10,2),
  status VARCHAR(50) DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_order_lines (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  unit_price NUMERIC(10,2)
);

CREATE TABLE sales_orders (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(150),
  destination VARCHAR(150),
  due_date DATE,
  total_amount NUMERIC(10,2),
  status VARCHAR(50) DEFAULT 'Allocated',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sales_order_lines (
  id SERIAL PRIMARY KEY,
  so_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  unit_price NUMERIC(10,2)
);

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  movement_type VARCHAR(50),
  quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id),
  product_id INTEGER REFERENCES products(id),
  terms TEXT,
  start_date DATE,
  end_date DATE
);

CREATE TABLE cash_transactions (
  id SERIAL PRIMARY KEY,
  cashier_id INTEGER REFERENCES users(id),
  so_id INTEGER REFERENCES sales_orders(id),
  payment_method VARCHAR(50),
  amount_tendered NUMERIC(10,2),
  change_given NUMERIC(10,2),
  tax_percent NUMERIC(5,2),
  total_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
CREATE INDEX idx_so_lines_so ON sales_order_lines(so_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_cash_transactions_cashier ON cash_transactions(cashier_id);
