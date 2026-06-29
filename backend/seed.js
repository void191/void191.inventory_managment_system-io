import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('Starting database seeding...');
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('Schema created successfully.');

    // 2. Insert Roles
    console.log('Inserting roles...');
    const rolesRes = await client.query(`
      INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('viewer'), ('cashier')
      RETURNING id, name;
    `);
    const roles = {};
    rolesRes.rows.forEach(r => { roles[r.name] = r.id; });

    // 3. Hash passwords and insert users
    console.log('Hashing passwords and inserting users...');
    const saltRounds = 12;
    const adminHash = await bcrypt.hash('Admin1234!', saltRounds);
    const managerHash = await bcrypt.hash('Manager1234!', saltRounds);
    const viewerHash = await bcrypt.hash('Viewer1234!', saltRounds);
    const cashierHash = await bcrypt.hash('Cashier1234!', saltRounds);

    await client.query(`
      INSERT INTO users (full_name, email, password_hash, role_id) VALUES
      ('System Administrator', 'admin@grainhouse.com', $1, $5),
      ('Warehouse Manager', 'manager@grainhouse.com', $2, $6),
      ('Operations Viewer', 'viewer@grainhouse.com', $3, $7),
      ('Cashier Staff', 'cashier@grainhouse.com', $4, $8);
    `, [adminHash, managerHash, viewerHash, cashierHash, roles['admin'], roles['manager'], roles['viewer'], roles['cashier']]);

    // 4. Insert Suppliers
    console.log('Inserting suppliers...');
    const suppliersRes = await client.query(`
      INSERT INTO suppliers (name, contact_name, email, phone, region, performance_rating) VALUES
      ('Apex Grain Supplies', 'John Doe', 'john@apexgrain.com', '+1-555-0191', 'North', 5),
      ('Midwest Harvest Partners', 'Sarah Jenkins', 'sarah@midwestharvest.com', '+1-555-0192', 'Midwest', 4),
      ('Valley Agritech', 'Michael Chang', 'mchang@valleyagri.com', '+1-555-0193', 'West', 5),
      ('Global Bulk Logistics', 'Elena Rostova', 'elena@globalbulk.com', '+1-555-0194', 'South', 3)
      RETURNING id, name;
    `);
    const suppliers = {};
    suppliersRes.rows.forEach(s => { suppliers[s.name] = s.id; });

    // 5. Insert Warehouses
    console.log('Inserting warehouses...');
    const warehousesRes = await client.query(`
      INSERT INTO warehouses (name, location, total_bins, occupancy_percent) VALUES
      ('Warehouse Alpha', 'Chicago, IL', 100, 45),
      ('Warehouse Beta', 'Denver, CO', 80, 70),
      ('Warehouse Gamma', 'Houston, TX', 120, 20)
      RETURNING id, name;
    `);
    const warehouses = {};
    warehousesRes.rows.forEach(w => { warehouses[w.name] = w.id; });

    // 6. Insert Categories
    console.log('Inserting categories...');
    const categoriesRes = await client.query(`
      INSERT INTO categories (name) VALUES
      ('Grains'),
      ('Equipment'),
      ('Packaging')
      RETURNING id, name;
    `);
    const categories = {};
    categoriesRes.rows.forEach(c => { categories[c.name] = c.id; });

    // 7. Insert Products
    console.log('Inserting products...');
    const productsRes = await client.query(`
      INSERT INTO products (sku, name, category_id, price, supplier_id, reorder_threshold, barcode, additional_details) VALUES
      ('GR-WHT-001', 'Organic Hard Red Winter Wheat', $1, 12.50, $4, 50, '010000018', '{"moisture_target": "13.5%", "grade": "No. 1 HRW"}'),
      ('GR-CRN-002', 'Premium Yellow Dent Corn', $1, 8.90, $5, 75, '010000028', '{"moisture_target": "14.0%", "variety": "Dent"}'),
      ('EQ-MTR-003', 'Heavy Duty Grain Moisture Meter', $2, 249.99, $6, 5, '010000038', '{"warranty": "2 Years", "model": "HD-500"}'),
      ('EQ-SLR-004', 'Automatic Bag Sealer', $2, 599.00, $6, 2, '010000048', '{"power": "110V/60Hz", "sealing_width": "10mm"}'),
      ('PK-BAG-005', 'Woven Polypropylene Bags 50lb', $3, 0.45, $7, 500, '010000058', '{"size": "18x30 inches", "color": "White"}'),
      ('PK-WRP-006', 'Industrial Stretch Wrap Roll', $3, 22.00, $7, 20, '010000068', '{"gauge": "80 gauge", "width": "18 inches"}')
      RETURNING id, sku;
    `, [
      categories['Grains'], categories['Equipment'], categories['Packaging'],
      suppliers['Apex Grain Supplies'], suppliers['Midwest Harvest Partners'],
      suppliers['Valley Agritech'], suppliers['Global Bulk Logistics']
    ]);
    const products = {};
    productsRes.rows.forEach(p => { products[p.sku] = p.id; });

    // 8. Insert Stock Levels
    console.log('Inserting stock levels...');
    await client.query(`
      INSERT INTO stock_levels (product_id, warehouse_id, on_hand, reserved, available) VALUES
      ($1, $7, 200, 20, 180),
      ($1, $8, 150, 0, 150),
      ($1, $9, 50, 10, 40),
      ($2, $7, 300, 50, 250),
      ($2, $8, 80, 0, 80),
      ($3, $7, 12, 2, 10),
      ($3, $8, 4, 1, 3),
      ($4, $7, 5, 0, 5),
      ($4, $9, 3, 1, 2),
      ($5, $7, 2500, 300, 2200),
      ($5, $9, 1000, 0, 1000),
      ($6, $7, 45, 5, 40),
      ($6, $8, 15, 0, 15)
    `, [
      products['GR-WHT-001'], products['GR-CRN-002'], products['EQ-MTR-003'],
      products['EQ-SLR-004'], products['PK-BAG-005'], products['PK-WRP-006'],
      warehouses['Warehouse Alpha'], warehouses['Warehouse Beta'], warehouses['Warehouse Gamma']
    ]);

    // 9. Insert Purchase Orders and lines
    console.log('Inserting purchase orders...');
    const po1 = await client.query(`
      INSERT INTO purchase_orders (supplier_id, eta, total_amount, status) VALUES
      ($1, '2026-07-15', 1250.00, 'Sent') RETURNING id;
    `, [suppliers['Apex Grain Supplies']]);
    await client.query(`
      INSERT INTO purchase_order_lines (po_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 100, 12.50);
    `, [po1.rows[0].id, products['GR-WHT-001']]);

    const po2 = await client.query(`
      INSERT INTO purchase_orders (supplier_id, eta, total_amount, status) VALUES
      ($1, '2026-06-25', 1849.95, 'Delivered') RETURNING id;
    `, [suppliers['Valley Agritech']]);
    await client.query(`
      INSERT INTO purchase_order_lines (po_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 5, 249.99),
      ($1, $3, 1, 599.00);
    `, [po2.rows[0].id, products['EQ-MTR-003'], products['EQ-SLR-004']]);

    const po3 = await client.query(`
      INSERT INTO purchase_orders (supplier_id, eta, total_amount, status) VALUES
      ($1, '2026-07-20', 440.00, 'Draft') RETURNING id;
    `, [suppliers['Global Bulk Logistics']]);
    await client.query(`
      INSERT INTO purchase_order_lines (po_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 20, 22.00);
    `, [po3.rows[0].id, products['PK-WRP-006']]);

    // 10. Insert Sales Orders and lines
    console.log('Inserting sales orders...');
    const so1 = await client.query(`
      INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status) VALUES
      ('Bakehouse Co.', 'Chicago, IL', '2026-07-02', 375.00, 'Allocated') RETURNING id;
    `);
    await client.query(`
      INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 30, 12.50);
    `, [so1.rows[0].id, products['GR-WHT-001']]);

    const so2 = await client.query(`
      INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status) VALUES
      ('Farm Union', 'Denver, CO', '2026-06-28', 1139.98, 'Shipped') RETURNING id;
    `);
    await client.query(`
      INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 1, 249.99),
      ($1, $3, 1, 599.00),
      ($1, $4, 650, 0.45);
    `, [so2.rows[0].id, products['EQ-MTR-003'], products['EQ-SLR-004'], products['PK-BAG-005']]);

    const so3 = await client.query(`
      INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status) VALUES
      ('Apex Breadmakers', 'Minneapolis, MN', '2026-07-10', 250.00, 'Allocated') RETURNING id;
    `);
    await client.query(`
      INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 20, 12.50);
    `, [so3.rows[0].id, products['GR-WHT-001']]);

    const so4 = await client.query(`
      INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status) VALUES
      ('Continental Feeds', 'Omaha, NE', '2026-06-15', 445.00, 'Returned') RETURNING id;
    `);
    await client.query(`
      INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price) VALUES
      ($1, $2, 50, 8.90);
    `, [so4.rows[0].id, products['GR-CRN-002']]);

    // 11. Insert Stock Movements
    console.log('Inserting stock movements...');
    await client.query(`
      INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes, created_at) VALUES
      ($1, $6, 'Receipt', 200, 'Initial setup load', NOW() - INTERVAL '10 days'),
      ($2, $6, 'Receipt', 300, 'Initial Setup load', NOW() - INTERVAL '10 days'),
      ($3, $6, 'Receipt', 15, 'Purchased from Valley Agritech', NOW() - INTERVAL '8 days'),
      ($3, $7, 'Transfer', 4, 'Transfer from Warehouse Alpha to Beta', NOW() - INTERVAL '7 days'),
      ($1, $7, 'Receipt', 150, 'Direct delivery', NOW() - INTERVAL '6 days'),
      ($5, $6, 'Receipt', 2500, 'Packaging supply bulk arrival', NOW() - INTERVAL '5 days'),
      ($1, $6, 'Issue', -20, 'Fulfillment for Bakehouse Co. partial allocation', NOW() - INTERVAL '4 days'),
      ($4, $6, 'Receipt', 5, 'Supplier direct arrival', NOW() - INTERVAL '3 days'),
      ($3, $6, 'Issue', -1, 'Shipped to Farm Union', NOW() - INTERVAL '2 days'),
      ($4, $8, 'Receipt', 3, 'Houston equipment arrival', NOW() - INTERVAL '1 day')
    `, [
      products['GR-WHT-001'], products['GR-CRN-002'], products['EQ-MTR-003'],
      products['EQ-SLR-004'], products['PK-BAG-005'], warehouses['Warehouse Alpha'],
      warehouses['Warehouse Beta'], warehouses['Warehouse Gamma']
    ]);

    // 12. Insert Contracts
    console.log('Inserting contracts...');
    const contractsData = [
      { supplier: 'Apex Grain Supplies', product: 'GR-WHT-001', terms: 'Bulk Winter wheat supply contract, 10% discount on volume > 1000 bags', start: '2026-01-01', end: '2026-12-31' },
      { supplier: 'Apex Grain Supplies', product: 'GR-WHT-001', terms: 'Organic grain certification agreement and quality standards validation', start: '2026-02-15', end: '2027-02-15' },
      { supplier: 'Midwest Harvest Partners', product: 'GR-CRN-002', terms: 'Corn pricing index agreement, fixed price of $8.90/bag through harvest', start: '2026-03-01', end: '2026-11-30' },
      { supplier: 'Midwest Harvest Partners', product: 'GR-CRN-002', terms: 'Emergency supply agreement, guaranteed delivery of up to 500 bags within 48h', start: '2026-05-01', end: '2027-05-01' },
      { supplier: 'Valley Agritech', product: 'EQ-MTR-003', terms: 'Equipment support SLA, 24-hour response on moisture meters replacement', start: '2026-04-01', end: '2028-04-01' },
      { supplier: 'Valley Agritech', product: 'EQ-SLR-004', terms: 'Discount agreement on automatic sealers, 5% off on orders of 3+ units', start: '2026-01-10', end: '2027-01-10' },
      { supplier: 'Global Bulk Logistics', product: 'PK-BAG-005', terms: 'Packaging bags direct agreement, fixed price $0.45 per woven bag', start: '2026-01-01', end: '2026-12-31' },
      { supplier: 'Global Bulk Logistics', product: 'PK-WRP-006', terms: 'Industrial wrap supply contract, bulk shipments bi-monthly at $22/roll', start: '2026-02-01', end: '2027-02-01' },
    ];
    for (const c of contractsData) {
      await client.query(`
        INSERT INTO contracts (supplier_id, product_id, terms, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
      `, [suppliers[c.supplier], products[c.product], c.terms, c.start, c.end]);
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
  } finally {
    client.release();
  }
}

seed().catch(err => {
  console.error('Fatal error during seed execution:', err);
  process.exit(1);
});
