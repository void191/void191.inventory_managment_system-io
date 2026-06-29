import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { verifyToken, requireRole } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'grainhouse_ims_jwt_secret_key_2026';

app.use(cors());
app.use(express.json());

// Helper function to execute query
async function dbQuery(text, params) {
  return pool.query(text, params);
}

// ----------------------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await dbQuery(
      `SELECT u.*, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`, 
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      role: user.role,
      permissions: user.permissions,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// USERS (Admin only)
// ----------------------------------------------------------------
app.get('/api/users', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const usersRes = await dbQuery(
      `SELECT u.id, u.full_name, u.email, r.name as role, u.is_active, u.created_at, u.permissions 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       ORDER BY u.created_at DESC`
    );
    res.json(usersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', verifyToken, requireRole(['admin']), async (req, res) => {
  const { full_name, email, password, role, permissions } = req.body;
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const roleRes = await dbQuery('SELECT id FROM roles WHERE name = $1', [role.toLowerCase()]);
    if (roleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const roleId = roleRes.rows[0].id;

    // Check duplicate
    const checkUser = await dbQuery('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await dbQuery(
      `INSERT INTO users (full_name, email, password_hash, role_id, permissions) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, full_name, email, created_at, is_active, permissions`,
      [full_name, email, passwordHash, roleId, JSON.stringify(permissions)]
    );

    res.status(201).json({ ...newUser.rows[0], role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/users/:id/deactivate', verifyToken, requireRole(['admin']), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const userRes = await dbQuery('SELECT id FROM users WHERE id = $1', [targetId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await dbQuery('UPDATE users SET is_active = FALSE WHERE id = $1', [targetId]);
    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  const targetId = parseInt(req.params.id);
  const { full_name, email, password, role, permissions } = req.body;

  if (!full_name || !email || !role || !permissions) {
    return res.status(400).json({ error: 'Full name, email, role, and permissions are required' });
  }

  try {
    const roleRes = await dbQuery('SELECT id FROM roles WHERE name = $1', [role.toLowerCase()]);
    if (roleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const roleId = roleRes.rows[0].id;

    // Check duplicate email
    const checkUser = await dbQuery('SELECT id FROM users WHERE email = $1 AND id != $2', [email, targetId]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      const updatedUser = await dbQuery(
        `UPDATE users 
         SET full_name = $1, email = $2, password_hash = $3, role_id = $4, permissions = $5 
         WHERE id = $6 
         RETURNING id, full_name, email, created_at, is_active, permissions`,
        [full_name, email, passwordHash, roleId, JSON.stringify(permissions), targetId]
      );
      if (updatedUser.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ ...updatedUser.rows[0], role });
    } else {
      const updatedUser = await dbQuery(
        `UPDATE users 
         SET full_name = $1, email = $2, role_id = $3, permissions = $4 
         WHERE id = $5 
         RETURNING id, full_name, email, created_at, is_active, permissions`,
        [full_name, email, roleId, JSON.stringify(permissions), targetId]
      );
      if (updatedUser.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ ...updatedUser.rows[0], role });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------
app.get('/api/dashboard', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Low stock count: available <= reorder_threshold
    const lowStockRes = await dbQuery(`
      SELECT COUNT(DISTINCT p.id) 
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      GROUP BY p.id, p.reorder_threshold
      HAVING COALESCE(SUM(sl.available), 0) <= p.reorder_threshold
    `);
    const lowStockCount = lowStockRes.rows.length;

    // Overdue POs: status != 'Delivered' and eta < today
    const overduePORes = await dbQuery(`
      SELECT COUNT(id) FROM purchase_orders 
      WHERE status != 'Delivered' AND eta < $1
    `, [today]);
    const overduePOs = parseInt(overduePORes.rows[0].count || 0);

    // Overdue SOs: status != 'Shipped' and due_date < today
    const overdueSORes = await dbQuery(`
      SELECT COUNT(id) FROM sales_orders 
      WHERE status != 'Shipped' AND status != 'Returned' AND due_date < $1
    `, [today]);
    const dueSOPoints = parseInt(overdueSORes.rows[0].count || 0);

    // Unresolved Returns: status = 'Returned'
    const returnsRes = await dbQuery(`
      SELECT COUNT(id) FROM sales_orders WHERE status = 'Returned'
    `);
    const unresolvedReturns = parseInt(returnsRes.rows[0].count || 0);

    // Reorder Queue Table: items below threshold
    const queueRes = await dbQuery(`
      SELECT p.id, p.sku, p.name, c.name as category, s.name as supplier,
             COALESCE(SUM(sl.on_hand), 0) as on_hand,
             COALESCE(SUM(sl.available), 0) as available,
             p.reorder_threshold as threshold
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      GROUP BY p.id, p.sku, p.name, c.name, s.name, p.reorder_threshold
      HAVING COALESCE(SUM(sl.available), 0) <= p.reorder_threshold
    `);

    // Today's Activity Feed
    const feedRes = await dbQuery(`
      SELECT sm.id, sm.created_at, sm.movement_type, sm.quantity, sm.notes, 
             p.name as product_name, w.name as warehouse_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.created_at::date = CURRENT_DATE
      ORDER BY sm.created_at DESC
    `);

    // Warehouse Occupancy
    const warehouseRes = await dbQuery(`
      SELECT id, name, location, total_bins, occupancy_percent
      FROM warehouses
      ORDER BY id ASC
    `);

    res.json({
      stats: {
        lowStockCount,
        overduePOs,
        dueSOPoints,
        unresolvedReturns
      },
      reorderQueue: queueRes.rows.map(r => ({
        ...r,
        on_hand: parseInt(r.on_hand),
        available: parseInt(r.available)
      })),
      todayFeed: feedRes.rows,
      warehouseOccupancies: warehouseRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// PRODUCTS
// ----------------------------------------------------------------
app.get('/api/products', verifyToken, async (req, res) => {
  try {
    const productsRes = await dbQuery(`
      SELECT p.*, c.name as category, s.name as supplier,
             COALESCE(SUM(sl.on_hand), 0)::int as stock,
             COALESCE(SUM(sl.reserved), 0)::int as reserved,
             COALESCE(SUM(sl.available), 0)::int as available
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      GROUP BY p.id, c.name, s.name
      ORDER BY p.name ASC
    `);
    res.json(productsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const { sku, name, category, price, supplier, reorder_threshold, image_url, barcode, additional_details, initial_stock } = req.body;
  if (!sku || !name || !category || !supplier) {
    return res.status(400).json({ error: 'SKU, name, category, and supplier are required' });
  }

  try {
    // Category check
    let catRes = await dbQuery('SELECT id FROM categories WHERE name = $1', [category]);
    if (catRes.rows.length === 0) {
      catRes = await dbQuery('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category]);
    }
    const categoryId = catRes.rows[0].id;

    // Supplier check
    const supRes = await dbQuery('SELECT id FROM suppliers WHERE name = $1', [supplier]);
    if (supRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid supplier name' });
    }
    const supplierId = supRes.rows[0].id;

    const barcodeVal = barcode || `0100${sku.replace(/\D/g, '') || '0000'}8`;

    const productInsert = await dbQuery(`
      INSERT INTO products (sku, name, category_id, price, supplier_id, reorder_threshold, image_url, barcode, additional_details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [sku, name, categoryId, parseFloat(price) || 0, supplierId, parseInt(reorder_threshold) || 0, image_url || '', barcodeVal, additional_details || {}]);

    const newProd = productInsert.rows[0];

    const initialStockQty = parseInt(initial_stock) || 0;

    // Seed stock levels. If initial_stock is specified, set it in the default warehouse.
    const wRes = await dbQuery('SELECT id, name FROM warehouses ORDER BY id ASC');
    if (wRes.rows.length > 0) {
      const defaultWh = wRes.rows[0];
      for (const w of wRes.rows) {
        const isDefault = w.id === defaultWh.id;
        const qty = isDefault ? initialStockQty : 0;
        await dbQuery(
          'INSERT INTO stock_levels (product_id, warehouse_id, on_hand, reserved, available) VALUES ($1, $2, $3, 0, $3)',
          [newProd.id, w.id, qty]
        );

        if (isDefault && initialStockQty > 0) {
          // Log stock movement
          await dbQuery(
            `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes)
             VALUES ($1, $2, 'Receipt', $3, 'Initial inventory load')`,
            [newProd.id, w.id, initialStockQty]
          );
        }
      }
    }

    res.status(201).json({
      ...newProd,
      category,
      supplier,
      stock: initialStockQty,
      reserved: 0,
      available: initialStockQty
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/products/:id', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const prodId = parseInt(req.params.id);
  const { sku, name, category, price, supplier, reorder_threshold, barcode, additional_details } = req.body;

  try {
    const prodRes = await dbQuery('SELECT id FROM products WHERE id = $1', [prodId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Category
    let categoryId = null;
    if (category) {
      let catRes = await dbQuery('SELECT id FROM categories WHERE name = $1', [category]);
      if (catRes.rows.length === 0) {
        catRes = await dbQuery('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category]);
      }
      categoryId = catRes.rows[0].id;
    }

    // Supplier
    let supplierId = null;
    if (supplier) {
      const supRes = await dbQuery('SELECT id FROM suppliers WHERE name = $1', [supplier]);
      if (supRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid supplier' });
      }
      supplierId = supRes.rows[0].id;
    }

    await dbQuery(`
      UPDATE products SET
        sku = COALESCE($1, sku),
        name = COALESCE($2, name),
        category_id = COALESCE($3, category_id),
        price = COALESCE($4, price),
        supplier_id = COALESCE($5, supplier_id),
        reorder_threshold = COALESCE($6, reorder_threshold),
        barcode = COALESCE($7, barcode),
        additional_details = COALESCE($8, additional_details)
      WHERE id = $9
    `, [sku, name, categoryId, price !== undefined ? parseFloat(price) : null, supplierId, reorder_threshold !== undefined ? parseInt(reorder_threshold) : null, barcode, additional_details, prodId]);

    // Fetch updated product
    const updatedRes = await dbQuery(`
      SELECT p.*, c.name as category, s.name as supplier,
             COALESCE(SUM(sl.on_hand), 0)::int as stock,
             COALESCE(SUM(sl.reserved), 0)::int as reserved,
             COALESCE(SUM(sl.available), 0)::int as available
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.id = $1
      GROUP BY p.id, c.name, s.name
    `, [prodId]);

    res.json(updatedRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/products/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  const prodId = parseInt(req.params.id);
  try {
    const prodRes = await dbQuery('SELECT id FROM products WHERE id = $1', [prodId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete related rows first
    await dbQuery('DELETE FROM stock_levels WHERE product_id = $1', [prodId]);
    await dbQuery('DELETE FROM contracts WHERE product_id = $1', [prodId]);
    await dbQuery('DELETE FROM purchase_order_lines WHERE product_id = $1', [prodId]);
    await dbQuery('DELETE FROM sales_order_lines WHERE product_id = $1', [prodId]);
    await dbQuery('DELETE FROM stock_movements WHERE product_id = $1', [prodId]);
    await dbQuery('DELETE FROM products WHERE id = $1', [prodId]);

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// STOCK LEVELS
// ----------------------------------------------------------------
app.get('/api/stock-levels', verifyToken, async (req, res) => {
  try {
    const levelsRes = await dbQuery(`
      SELECT sl.id, sl.product_id, sl.warehouse_id, sl.on_hand, sl.reserved, sl.available,
             p.name as product_name, p.sku as product_sku, w.name as warehouse_name
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      JOIN warehouses w ON sl.warehouse_id = w.id
      ORDER BY w.name, p.name
    `);
    res.json(levelsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// WAREHOUSES
// ----------------------------------------------------------------
app.get('/api/warehouses', verifyToken, async (req, res) => {
  try {
    const warehousesRes = await dbQuery('SELECT * FROM warehouses ORDER BY name ASC');
    res.json(warehousesRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// SUPPLIERS
// ----------------------------------------------------------------
app.get('/api/suppliers', verifyToken, async (req, res) => {
  try {
    const suppliersRes = await dbQuery(`
      SELECT s.*, COALESCE(COUNT(c.id), 0)::int as contracts_count
      FROM suppliers s
      LEFT JOIN contracts c ON s.id = c.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(suppliersRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/suppliers/:id/contracts', verifyToken, async (req, res) => {
  const supId = parseInt(req.params.id);
  try {
    const contractsRes = await dbQuery(`
      SELECT c.*, p.name as product_name, p.sku as product_sku 
      FROM contracts c
      JOIN products p ON c.product_id = p.id
      WHERE c.supplier_id = $1
    `, [supId]);
    res.json(contractsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/suppliers/:id/orders', verifyToken, async (req, res) => {
  const supId = parseInt(req.params.id);
  try {
    const ordersRes = await dbQuery(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.supplier_id = $1
      ORDER BY po.created_at DESC
    `, [supId]);
    
    // Attach lines
    const finalOrders = [];
    for (const o of ordersRes.rows) {
      const lines = await dbQuery(`
        SELECT pol.*, p.name as product_name, p.sku as product_sku 
        FROM purchase_order_lines pol
        JOIN products p ON pol.product_id = p.id
        WHERE pol.po_id = $1
      `, [o.id]);
      finalOrders.push({ ...o, lines: lines.rows });
    }
    
    res.json(finalOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// PURCHASE ORDERS
// ----------------------------------------------------------------
app.get('/api/purchase-orders', verifyToken, async (req, res) => {
  try {
    const posRes = await dbQuery(`
      SELECT po.*, s.name as supplier_name 
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `);
    
    const finalPOs = [];
    for (const po of posRes.rows) {
      const lines = await dbQuery(`
        SELECT pol.*, p.name as product_name, p.sku as product_sku 
        FROM purchase_order_lines pol
        JOIN products p ON pol.product_id = p.id
        WHERE pol.po_id = $1
      `, [po.id]);
      finalPOs.push({ ...po, lines: lines.rows });
    }
    
    res.json(finalPOs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/purchase-orders', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const { supplier_name, eta, items } = req.body;
  if (!supplier_name || !eta || !items || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, ETA, and items list are required' });
  }

  try {
    const supRes = await dbQuery('SELECT id FROM suppliers WHERE name = $1', [supplier_name]);
    if (supRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid supplier' });
    }
    const supplierId = supRes.rows[0].id;

    // Calculate total amount
    let total = 0;
    for (const item of items) {
      total += parseInt(item.quantity) * parseFloat(item.unit_price || 0);
    }

    // Insert PO
    const poInsert = await dbQuery(
      `INSERT INTO purchase_orders (supplier_id, eta, total_amount, status)
       VALUES ($1, $2, $3, 'Draft') RETURNING id, created_at, status`,
      [supplierId, eta, total]
    );
    const poId = poInsert.rows[0].id;

    // Insert PO lines
    const finalLines = [];
    for (const item of items) {
      const prodRes = await dbQuery('SELECT id FROM products WHERE name = $1', [item.product_name]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_name}`);
      }
      const productId = prodRes.rows[0].id;

      const lineInsert = await dbQuery(
        `INSERT INTO purchase_order_lines (po_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [poId, productId, parseInt(item.quantity), parseFloat(item.unit_price)]
      );
      finalLines.push({
        ...lineInsert.rows[0],
        product_name: item.product_name,
        product_sku: item.product_sku
      });
    }

    res.status(201).json({
      id: poId,
      supplier_id: supplierId,
      supplier_name,
      eta,
      total_amount: total,
      status: poInsert.rows[0].status,
      created_at: poInsert.rows[0].created_at,
      lines: finalLines
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.patch('/api/purchase-orders/:id/receive', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const poId = parseInt(req.params.id);
  try {
    const poRes = await dbQuery('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
    if (poRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    const po = poRes.rows[0];
    if (po.status === 'Delivered') {
      return res.status(400).json({ error: 'Order is already marked as received' });
    }

    // Set to Delivered
    await dbQuery("UPDATE purchase_orders SET status = 'Delivered' WHERE id = $1", [poId]);

    // Fetch lines to update stock
    const linesRes = await dbQuery('SELECT * FROM purchase_order_lines WHERE po_id = $1', [poId]);
    
    // Choose Warehouse Alpha as default for received items
    const alphaRes = await dbQuery("SELECT id FROM warehouses WHERE name = 'Warehouse Alpha'");
    const warehouseId = alphaRes.rows[0].id;

    for (const line of linesRes.rows) {
      // Update stock levels
      const checkLevel = await dbQuery(
        'SELECT id, on_hand, available FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2',
        [line.product_id, warehouseId]
      );
      if (checkLevel.rows.length > 0) {
        await dbQuery(
          `UPDATE stock_levels 
           SET on_hand = on_hand + $1, available = available + $1 
           WHERE product_id = $2 AND warehouse_id = $3`,
          [line.quantity, line.product_id, warehouseId]
        );
      } else {
        await dbQuery(
          `INSERT INTO stock_levels (product_id, warehouse_id, on_hand, reserved, available)
           VALUES ($1, $2, $3, 0, $3)`,
          [line.product_id, warehouseId, line.quantity]
        );
      }

      // Log movement
      await dbQuery(
        `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes)
         VALUES ($1, $2, 'Receipt', $3, $4)`,
        [line.product_id, warehouseId, line.quantity, `Received PO #${poId}`]
      );
    }

    res.json({ message: 'Purchase order received successfully and stock updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// SALES ORDERS
// ----------------------------------------------------------------
app.get('/api/sales-orders', verifyToken, async (req, res) => {
  try {
    const sosRes = await dbQuery('SELECT * FROM sales_orders ORDER BY created_at DESC');
    
    const finalSOs = [];
    for (const so of sosRes.rows) {
      const lines = await dbQuery(`
        SELECT sol.*, p.name as product_name, p.sku as product_sku 
        FROM sales_order_lines sol
        JOIN products p ON sol.product_id = p.id
        WHERE sol.so_id = $1
      `, [so.id]);
      finalSOs.push({ ...so, lines: lines.rows });
    }
    
    res.json(finalSOs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sales-orders', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const { customer_name, destination, due_date, items } = req.body;
  if (!customer_name || !destination || !due_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Customer, Destination, Due Date, and items are required' });
  }

  try {
    let total = 0;
    for (const item of items) {
      total += parseInt(item.quantity) * parseFloat(item.unit_price || 0);
    }

    // Insert SO
    const soInsert = await dbQuery(
      `INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status)
       VALUES ($1, $2, $3, $4, 'Allocated') RETURNING id, status, created_at`,
      [customer_name, destination, due_date, total]
    );
    const soId = soInsert.rows[0].id;

    // Default to Warehouse Alpha for allocations/reservations
    const alphaRes = await dbQuery("SELECT id FROM warehouses WHERE name = 'Warehouse Alpha'");
    const warehouseId = alphaRes.rows[0].id;

    const finalLines = [];
    for (const item of items) {
      const prodRes = await dbQuery('SELECT id FROM products WHERE name = $1', [item.product_name]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_name}`);
      }
      const productId = prodRes.rows[0].id;

      // Check stock and reserve
      await dbQuery(
        `UPDATE stock_levels 
         SET reserved = reserved + $1, available = available - $1 
         WHERE product_id = $2 AND warehouse_id = $3`,
        [parseInt(item.quantity), productId, warehouseId]
      );

      const lineInsert = await dbQuery(
        `INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [soId, productId, parseInt(item.quantity), parseFloat(item.unit_price)]
      );
      finalLines.push({
        ...lineInsert.rows[0],
        product_name: item.product_name,
        product_sku: item.product_sku
      });
    }

    res.status(201).json({
      id: soId,
      customer_name,
      destination,
      due_date,
      total_amount: total,
      status: soInsert.rows[0].status,
      created_at: soInsert.rows[0].created_at,
      lines: finalLines
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.patch('/api/sales-orders/:id/ship', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const soId = parseInt(req.params.id);
  try {
    const soRes = await dbQuery('SELECT * FROM sales_orders WHERE id = $1', [soId]);
    if (soRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    
    const so = soRes.rows[0];
    if (so.status === 'Shipped') {
      return res.status(400).json({ error: 'Order is already shipped' });
    }

    // Set to Shipped
    await dbQuery("UPDATE sales_orders SET status = 'Shipped' WHERE id = $1", [soId]);

    // Fetch lines to update stock (deduct on_hand & reserved)
    const linesRes = await dbQuery('SELECT * FROM sales_order_lines WHERE so_id = $1', [soId]);
    
    const alphaRes = await dbQuery("SELECT id FROM warehouses WHERE name = 'Warehouse Alpha'");
    const warehouseId = alphaRes.rows[0].id;

    for (const line of linesRes.rows) {
      await dbQuery(
        `UPDATE stock_levels 
         SET on_hand = on_hand - $1, reserved = reserved - $1 
         WHERE product_id = $2 AND warehouse_id = $3`,
        [line.quantity, line.product_id, warehouseId]
      );

      // Log movement
      await dbQuery(
        `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes)
         VALUES ($1, $2, 'Issue', -$3, $4)`,
        [line.product_id, warehouseId, line.quantity, `Shipped SO #${soId}`]
      );
    }

    res.json({ message: 'Sales order shipped successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/sales-orders/:id/return', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const soId = parseInt(req.params.id);
  try {
    const soRes = await dbQuery('SELECT * FROM sales_orders WHERE id = $1', [soId]);
    if (soRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }
    
    const so = soRes.rows[0];
    if (so.status === 'Returned') {
      return res.status(400).json({ error: 'Order is already returned' });
    }

    // Set to Returned
    await dbQuery("UPDATE sales_orders SET status = 'Returned' WHERE id = $1", [soId]);

    // Fetch lines to return stock (add to on_hand & available)
    const linesRes = await dbQuery('SELECT * FROM sales_order_lines WHERE so_id = $1', [soId]);
    
    const alphaRes = await dbQuery("SELECT id FROM warehouses WHERE name = 'Warehouse Alpha'");
    const warehouseId = alphaRes.rows[0].id;

    for (const line of linesRes.rows) {
      await dbQuery(
        `UPDATE stock_levels 
         SET on_hand = on_hand + $1, available = available + $1 
         WHERE product_id = $2 AND warehouse_id = $3`,
        [line.quantity, line.product_id, warehouseId]
      );

      // Log movement
      await dbQuery(
        `INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes)
         VALUES ($1, $2, 'Receipt', $3, $4)`,
        [line.product_id, warehouseId, line.quantity, `Returned items from SO #${soId}`]
      );
    }

    res.json({ message: 'Sales order returned successfully and inventory adjusted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// STOCK MOVEMENTS
// ----------------------------------------------------------------
app.get('/api/stock-movements', verifyToken, async (req, res) => {
  try {
    const movementsRes = await dbQuery(`
      SELECT sm.id, sm.created_at, sm.movement_type, sm.quantity, sm.notes,
             p.name as product_name, p.sku as product_sku, w.name as warehouse_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      ORDER BY sm.created_at DESC
    `);
    res.json(movementsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// REPORTS (Admin, Manager)
// ----------------------------------------------------------------
app.get('/api/reports/:type', verifyToken, requireRole(['admin', 'manager']), async (req, res) => {
  const { type } = req.params;
  try {
    if (type === 'inventory') {
      const summaryRes = await dbQuery(`
        SELECT p.sku, p.name, c.name as category,
               COALESCE(SUM(sl.on_hand), 0)::int as on_hand,
               COALESCE(SUM(sl.available), 0)::int as available,
               p.price,
               (COALESCE(SUM(sl.on_hand), 0) * p.price) as total_value
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        GROUP BY p.id, p.sku, p.name, c.name, p.price
        ORDER BY total_value DESC
      `);
      res.json(summaryRes.rows);
    } else if (type === 'sales') {
      const salesRes = await dbQuery(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
               SUM(total_amount) as total_sales,
               COUNT(id) as total_orders
        FROM sales_orders
        WHERE status = 'Shipped'
        GROUP BY month
        ORDER BY month ASC
      `);
      res.json(salesRes.rows);
    } else if (type === 'purchases') {
      const purchasesRes = await dbQuery(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
               SUM(total_amount) as total_purchases,
               COUNT(id) as total_orders
        FROM purchase_orders
        WHERE status = 'Delivered'
        GROUP BY month
        ORDER BY month ASC
      `);
      res.json(purchasesRes.rows);
    } else {
      res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------------------
// CASHIER & POS MODULE ENDPOINTS
// ----------------------------------------------------------------

// 1. Charge Transaction
app.post('/api/cashier/charge', verifyToken, requireRole(['admin', 'cashier']), async (req, res) => {
  const { items, payment_method, amount_tendered, change_given, tax_percent, total_amount } = req.body;
  const cashierId = req.user.id;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in transaction' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create completed Sales Order
    const soRes = await client.query(`
      INSERT INTO sales_orders (customer_name, destination, due_date, total_amount, status)
      VALUES ($1, $2, CURRENT_DATE, $3, $4)
      RETURNING id
    `, ['Walk-in Customer', 'Over-the-counter', total_amount, 'Completed']);
    const soId = soRes.rows[0].id;

    // Get Warehouse Alpha as default stock source
    const whRes = await client.query("SELECT id FROM warehouses WHERE name = 'Warehouse Alpha'");
    const warehouseId = whRes.rows[0].id;

    for (const item of items) {
      const prodRes = await client.query('SELECT id FROM products WHERE sku = $1', [item.sku]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.sku}`);
      }
      const productId = prodRes.rows[0].id;

      // Insert line
      await client.query(`
        INSERT INTO sales_order_lines (so_id, product_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `, [soId, productId, item.qty, item.price]);

      // Deduct stock levels
      await client.query(`
        UPDATE stock_levels 
        SET on_hand = on_hand - $1, available = available - $1 
        WHERE product_id = $2 AND warehouse_id = $3
      `, [item.qty, productId, warehouseId]);

      // Log movement (Issue)
      await client.query(`
        INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, notes)
        VALUES ($1, $2, 'Issue', $3, $4)
      `, [productId, warehouseId, -item.qty, `POS Cashier Transaction SO #${soId}`]);
    }

    // Insert cash transaction record
    await client.query(`
      INSERT INTO cash_transactions (cashier_id, so_id, payment_method, amount_tendered, change_given, tax_percent, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [cashierId, soId, payment_method, amount_tendered || 0, change_given || 0, tax_percent || 15.0, total_amount]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Transaction charged successfully', so_id: soId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
});

// 2. Open Drawer ESC/POS Trigger
app.post('/api/cashier/open-drawer', verifyToken, requireRole(['admin', 'cashier']), async (req, res) => {
  const { port_path, baud_rate } = req.body;
  console.log(`Triggering cash drawer on serial port ${port_path || 'COM3'}...`);
  
  try {
    let SerialPort;
    try {
      const spModule = await import('serialport');
      SerialPort = spModule.SerialPort;
    } catch (e) {
      // Dynamic imports may throw if package is uninstalled
    }

    if (!SerialPort) {
      return res.status(200).json({ 
        message: 'Local fallback: Drawer triggered, serialport library is not installed.',
        fallback: true
      });
    }

    const port = new SerialPort({
      path: port_path || 'COM3',
      baudRate: parseInt(baud_rate) || 9600,
    });

    port.write(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]), (err) => {
      if (err) {
        console.error('Failed to open serial port drawer:', err);
        return res.status(500).json({ error: err.message });
      }
      port.close();
      res.json({ message: 'ESC/POS cash drawer trigger sent successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(200).json({ 
      message: `Local fallback: Drawer trigger failed (${err.message})`,
      error: err.message,
      fallback: true
    });
  }
});

// 3. Print Receipt ESC/POS Stream
app.post('/api/cashier/print-receipt', verifyToken, requireRole(['admin', 'cashier']), async (req, res) => {
  const { port_path, baud_rate, receipt_data } = req.body;
  console.log(`Sending ESC/POS print job to printer on port ${port_path || 'COM3'}...`);

  try {
    let SerialPort;
    try {
      const spModule = await import('serialport');
      SerialPort = spModule.SerialPort;
    } catch (e) {
      // Dynamic imports fallback
    }

    if (!SerialPort) {
      return res.status(200).json({ 
        message: 'Local fallback: Print job accepted, serialport library is not installed.',
        fallback: true
      });
    }

    const port = new SerialPort({
      path: port_path || 'COM3',
      baudRate: parseInt(baud_rate) || 9600,
    });

    const chunks = [];
    chunks.push(Buffer.from([0x1B, 0x40])); // Init
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Align center
    chunks.push(Buffer.from('GRAINHOUSE IMS\nPOS RECEIPT\n\n'));
    chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Align left
    chunks.push(Buffer.from(`Date: ${new Date().toLocaleString()}\n`));
    chunks.push(Buffer.from(`Cashier: ${receipt_data.cashier_name || 'Staff'}\n`));
    chunks.push(Buffer.from(`Order ID: SO #${receipt_data.so_id || 'N/A'}\n`));
    chunks.push(Buffer.from('================================\n'));

    for (const item of receipt_data.items || []) {
      const line = `${item.name.slice(0, 16)} x${item.qty} $${(item.price * item.qty).toFixed(2)}\n`;
      chunks.push(Buffer.from(line));
    }

    chunks.push(Buffer.from('================================\n'));
    chunks.push(Buffer.from(`Subtotal: $${parseFloat(receipt_data.subtotal).toFixed(2)}\n`));
    chunks.push(Buffer.from(`Tax (${receipt_data.tax_percent}%): $${parseFloat(receipt_data.tax).toFixed(2)}\n`));
    chunks.push(Buffer.from(`Total Amount: $${parseFloat(receipt_data.total).toFixed(2)}\n`));
    chunks.push(Buffer.from(`Payment Method: ${receipt_data.payment_method}\n`));
    if (receipt_data.payment_method === 'Cash') {
      chunks.push(Buffer.from(`Tendered: $${parseFloat(receipt_data.amount_tendered).toFixed(2)}\n`));
      chunks.push(Buffer.from(`Change: $${parseFloat(receipt_data.change_given).toFixed(2)}\n`));
    }
    chunks.push(Buffer.from('================================\n\n'));
    chunks.push(Buffer.from([0x1B, 0x61, 0x01])); // Align center
    chunks.push(Buffer.from('Thank you for your purchase.\n\n\n\n'));
    chunks.push(Buffer.from([0x1D, 0x56, 0x42, 0x00])); // Cut paper

    const fullBuffer = Buffer.concat(chunks);

    port.write(fullBuffer, (err) => {
      if (err) {
        console.error('Failed to print receipt ESC/POS stream:', err);
        return res.status(500).json({ error: err.message });
      }
      port.close();
      res.json({ message: 'ESC/POS print job processed successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(200).json({ 
      message: `Local fallback: Print job failed (${err.message})`,
      error: err.message,
      fallback: true
    });
  }
});

// 4. Get Today's Transactions
app.get('/api/cashier/transactions', verifyToken, requireRole(['admin', 'cashier']), async (req, res) => {
  try {
    const txRes = await dbQuery(`
      SELECT ct.*, u.full_name as cashier_name
      FROM cash_transactions ct
      JOIN users u ON ct.cashier_id = u.id
      WHERE ct.created_at >= CURRENT_DATE
      ORDER BY ct.created_at DESC
    `);
    res.json(txRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start backend server
app.listen(PORT, () => {
  console.log(`Grainhouse API Server running on port ${PORT}`);
});
