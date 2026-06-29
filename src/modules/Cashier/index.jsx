import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Printer, DollarSign, Settings, X, Plus, Minus, CreditCard, ChevronDown, ChevronUp, Receipt, AlertTriangle } from 'lucide-react';
import api from '../../api';
import Dropdown from '../../app/components/Dropdown';

function Cashier() {
  // POS register transaction state
  const [cart, setCart] = useState([]);
  
  // Settings persisted in localStorage
  const [portPath, setPortPath] = useState(localStorage.getItem('pos_port_path') || 'COM3');
  const [baudRate, setBaudRate] = useState(localStorage.getItem('pos_baud_rate') || '9600');
  const [taxRate, setTaxRate] = useState(localStorage.getItem('pos_tax_rate') || '15');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Database data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [charging, setCharging] = useState(false);

  // Toast / notification state
  const [toastMessage, setToastMessage] = useState('');

  // Load products and categories from API on mount
  const fetchPOSData = async () => {
    setLoading(true);
    setError('');
    try {
      const prodsData = await api.get('/api/products');
      
      const mappedProds = prodsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price),
        image: p.image_url
      }));

      setProducts(mappedProds);

      const uniqueCats = ['All', ...new Set(mappedProds.map(p => p.category))];
      setCategories(uniqueCats);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load POS data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOSData();
  }, []);

  // Save settings when changed
  const saveSettings = (key, val) => {
    localStorage.setItem(key, val);
    if (key === 'pos_port_path') setPortPath(val);
    if (key === 'pos_baud_rate') setBaudRate(val);
    if (key === 'pos_tax_rate') setTaxRate(val);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // Filter products by search query and category
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // POS operations
  const handleAddProduct = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        return prev.map(item => item.sku === product.sku ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const handleUpdateQty = (sku, delta) => {
    setCart(prev => prev.map(item => {
      if (item.sku === sku) {
        const nextQty = item.qty + delta;
        return { ...item, qty: nextQty < 1 ? 1 : nextQty };
      }
      return item;
    }));
  };

  const handleRemoveItem = (sku) => {
    setCart(prev => prev.filter(item => item.sku !== sku));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Are you sure you want to clear the current transaction?')) {
      setCart([]);
    }
  };

  // Totals calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [cart]);

  const tax = useMemo(() => {
    const rate = parseFloat(taxRate) || 0;
    return subtotal * (rate / 100);
  }, [subtotal, taxRate]);

  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);

  // Open Drawer trigger (ESC/POS)
  // Explainer: COM3/COM4 represent Serial/USB thermal ports on Windows. /dev/ttyUSB0 is typical for Linux.
  const handleOpenDrawer = async () => {
    showToast('Opening Cash Drawer...');
    
    // 1. Try Web Serial API
    if (navigator.serial) {
      try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: parseInt(baudRate) || 9600 });
        const writer = port.writable.getWriter();
        const escposTrigger = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
        await writer.write(escposTrigger);
        writer.releaseLock();
        await port.close();
        showToast('Cash drawer opened via Web Serial.');
        return;
      } catch (err) {
        console.warn('Web Serial open failed, falling back to server', err);
      }
    }

    // 2. Fallback: Express Server Endpoint
    try {
      const res = await api.post('/api/cashier/open-drawer', {
        port_path: portPath,
        baud_rate: baudRate
      });
      if (res.fallback) {
        showToast('Local fallback triggered: Drawer open command completed.');
      } else {
        showToast('Cash drawer opened via server.');
      }
    } catch (err) {
      showToast(`Drawer Error: ${err.message || 'Port unavailable'}`);
    }
  };

  // Print Receipt handlers
  const handleBrowserPrint = (receiptData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up blocked. Enable pop-ups to print receipts.');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>POS Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              background-color: #f4ece1;
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .receipt-card {
              background: #fff;
              width: 80mm;
              padding: 18px;
              box-shadow: 0 4px 15px rgba(62, 47, 35, 0.15);
              box-sizing: border-box;
              border: 1px solid rgba(122, 92, 62, 0.18);
              color: #3E2F23;
              font-size: 13px;
              line-height: 1.4;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #7A5C3E; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; }
            .items { margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            
            @media print {
              body {
                background: #fff;
                padding: 0;
                display: block;
              }
              .receipt-card {
                width: 100%;
                box-shadow: none;
                border: none;
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="center bold" style="font-size: 16px;">GRAINHOUSE IMS</div>
            <div class="center">POS TRANSACTION RECEIPT</div>
            <div class="divider"></div>
            <div>Date: ${new Date().toLocaleString()}</div>
            <div>Cashier: ${receiptData.cashier_name}</div>
            <div>Order ID: SO #${receiptData.so_id}</div>
            <div class="divider"></div>
            <div class="bold">ITEMS</div>
            <div class="items">
              ${receiptData.items.map(item => `
                <div class="item-row">
                  <span>${item.name.slice(0, 18)}</span>
                  <span>x${item.qty} $${(item.price * item.qty).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            <div class="divider"></div>
            <div class="flex"><span>Subtotal:</span><span>$${parseFloat(receiptData.subtotal).toFixed(2)}</span></div>
            <div class="flex"><span>Tax (${receiptData.tax_percent}%):</span><span>$${parseFloat(receiptData.tax).toFixed(2)}</span></div>
            <div class="flex bold" style="font-size: 14px; margin-top: 4px;"><span>Total:</span><span>$${parseFloat(receiptData.total).toFixed(2)}</span></div>
            <div class="divider"></div>
            <div class="flex"><span>Payment Method:</span><span>${receiptData.payment_method}</span></div>
            ${receiptData.payment_method === 'Cash' ? `
              <div class="flex"><span>Tendered:</span><span>$${parseFloat(receiptData.amount_tendered).toFixed(2)}</span></div>
              <div class="flex bold"><span>Change Given:</span><span>$${parseFloat(receiptData.change_given).toFixed(2)}</span></div>
            ` : ''}
            <div class="divider"></div>
            <div class="center" style="margin-top: 15px; font-style: italic;">Thank you for your purchase.</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handlePrintReceipt = async (soId, receiptInfo) => {
    const cashierName = localStorage.getItem('user') || 'Cashier Staff';
    const payload = {
      cashier_name: cashierName,
      so_id: soId,
      items: receiptInfo.items,
      subtotal: receiptInfo.subtotal,
      tax: receiptInfo.tax,
      tax_percent: taxRate,
      total: receiptInfo.total,
      payment_method: receiptInfo.payment_method,
      amount_tendered: receiptInfo.amount_tendered,
      change_given: receiptInfo.change_given
    };

    try {
      const res = await api.post('/api/cashier/print-receipt', {
        port_path: portPath,
        baud_rate: baudRate,
        receipt_data: payload
      });

      if (res.fallback) {
        showToast('Thermal printer unavailable — using browser print');
        handleBrowserPrint(payload);
      } else {
        showToast('Thermal receipt printed successfully.');
      }
    } catch (err) {
      console.warn('ESC/POS printing failed, fallback to browser print', err);
      showToast('Thermal printer unavailable — using browser print');
      handleBrowserPrint(payload);
    }
  };

  // Charge confirmation
  const changeDue = useMemo(() => {
    if (paymentMethod !== 'Cash') return 0;
    const tendered = parseFloat(amountTendered) || 0;
    return Math.max(0, tendered - total);
  }, [amountTendered, total, paymentMethod]);

  const canConfirmPayment = useMemo(() => {
    if (paymentMethod !== 'Cash') return true;
    const tendered = parseFloat(amountTendered) || 0;
    return tendered >= total;
  }, [amountTendered, total, paymentMethod]);

  const handleConfirmPayment = async () => {
    if (!canConfirmPayment) return;
    setCharging(true);
    setPaymentError('');

    const cashierUser = localStorage.getItem('user') || 'Cashier';
    const transactionSnapshot = {
      items: cart.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price })),
      subtotal,
      tax,
      total,
      payment_method: paymentMethod,
      amount_tendered: paymentMethod === 'Cash' ? parseFloat(amountTendered) : total,
      change_given: paymentMethod === 'Cash' ? changeDue : 0
    };

    try {
      const res = await api.post('/api/cashier/charge', {
        items: transactionSnapshot.items,
        payment_method: paymentMethod,
        amount_tendered: transactionSnapshot.amount_tendered,
        change_given: transactionSnapshot.change_given,
        tax_percent: parseFloat(taxRate) || 15.0,
        total_amount: total
      });

      // Clear register cart
      setCart([]);
      setIsPaymentModalOpen(false);
      setAmountTendered('');
      setCharging(false);

      // Print receipt automatically
      handlePrintReceipt(res.so_id, transactionSnapshot);
    } catch (err) {
      setPaymentError(err.message || 'Transaction submission failed.');
      setCharging(false);
    }
  };

  const renderThumbnail = (product) => {
    if (product.image) {
      return (
        <img 
          src={product.image} 
          alt={product.name} 
          className="product-thumbnail-img" 
          style={{ width: '48px', height: '48px', borderRadius: '8px' }}
        />
      );
    }
    const letter = product.name ? product.name.charAt(0) : 'P';
    return (
      <div 
        className="product-thumbnail-placeholder"
        style={{ width: '48px', height: '48px', borderRadius: '8px', fontSize: '1.2rem' }}
      >
        {letter}
      </div>
    );
  };

  return (
    <section className="module-page route-fade">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--color-text-dark)',
          color: '#FFF',
          padding: '12px 20px',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 1100,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Printer size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <Receipt size={20} />
          </div>
          <div>
            <p className="eyebrow">Checkout Terminal</p>
            <h3>Point of Sale Register</h3>
          </div>
        </div>

        {/* Collapsible Settings Trigger */}
        <button
          type="button"
          className="subtle-button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Settings size={18} />
          POS Settings
        </button>
      </div>

      {/* Persistent Settings Panel */}
      {settingsOpen && (
        <div className="card stack" style={{ padding: 18, marginBottom: 20, gap: 14, background: '#fffcf7', borderColor: 'rgba(166,124,82,0.2)' }}>
          <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'center', width: '100%' }}>
            <strong style={{ fontSize: '0.94rem' }}>Configure Thermal Printer & Cash Drawer</strong>
            <button type="button" className="close-detail-btn" style={{ position: 'static' }} onClick={() => setSettingsOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--sand-muted)', margin: 0 }}>
            * Serial Port Configuration instructions: COM3/COM4 are standard on Windows. On Linux/Unix use paths like `/dev/ttyUSB0` or `/dev/ttyS0`.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            <label>
              <span className="eyebrow" style={{ fontSize: '0.66rem' }}>Serial Port Path</span>
              <input
                className="surface-input"
                style={{ padding: 6, fontSize: '0.84rem', marginTop: 4 }}
                value={portPath}
                onChange={(e) => saveSettings('pos_port_path', e.target.value)}
                placeholder="COM3"
              />
            </label>
            <label>
              <span className="eyebrow" style={{ fontSize: '0.66rem' }}>Baud Rate</span>
              <input
                className="surface-input"
                style={{ padding: 6, fontSize: '0.84rem', marginTop: 4 }}
                value={baudRate}
                onChange={(e) => saveSettings('pos_baud_rate', e.target.value)}
                placeholder="9600"
              />
            </label>
            <label>
              <span className="eyebrow" style={{ fontSize: '0.66rem' }}>Default Tax (%)</span>
              <input
                className="surface-input"
                style={{ padding: 6, fontSize: '0.84rem', marginTop: 4 }}
                type="number"
                value={taxRate}
                onChange={(e) => saveSettings('pos_tax_rate', e.target.value)}
                placeholder="15"
              />
            </label>
          </div>
        </div>
      )}

      {/* POS split layouts */}
      <div className="split-layout" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        
        {/* Left selector panel */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="toolbar" style={{ gridTemplateColumns: '1fr', padding: 0 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--sand-muted)' }} />
              <input
                className="surface-input"
                style={{ paddingLeft: 38 }}
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`tab-button ${selectedCategory === cat ? 'is-active' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="skeleton-bar" style={{ height: 60, borderRadius: 8 }}></div>
              <div className="skeleton-bar" style={{ height: 60, borderRadius: 8 }}></div>
            </div>
          ) : error ? (
            <div className="banner" style={{ borderLeftColor: 'var(--danger)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <AlertTriangle color="var(--danger)" />
                <div>
                  <strong>POS Loading Failed</strong>
                  <p>{error}</p>
                </div>
              </div>
              <button onClick={fetchPOSData} className="subtle-button">Retry</button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 14,
              maxHeight: '62vh',
              overflowY: 'auto',
              paddingRight: 6
            }}>
              {filteredProducts.map(prod => (
                <div
                  key={prod.sku}
                  className="card"
                  onClick={() => handleAddProduct(prod)}
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: '#ffffff',
                    border: '1px solid rgba(122, 92, 62, 0.12)',
                    transition: 'all 0.15s ease-in-out'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(122, 92, 62, 0.12)'}
                >
                  <div style={{ marginBottom: 8 }}>{renderThumbnail(prod)}</div>
                  <strong style={{ fontSize: '0.86rem', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {prod.name}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--sand-muted)', display: 'block', margin: '4px 0' }}>{prod.sku}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent-hover)', fontSize: '0.94rem' }}>${prod.price.toFixed(2)}</span>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--sand-muted)', padding: '24px 0' }}>
                  No catalog products match this search.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right POS transaction panel */}
        <div className="card stack" style={{ padding: 18, background: '#fffcf9', border: '1px solid rgba(166,124,82,0.2)', height: '76vh', display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: '1rem', borderBottom: '1px solid rgba(166,124,82,0.14)', paddingBottom: 10, marginBottom: 10 }}>
            Current Sale Register
          </strong>

          {/* Cart list */}
          <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: 14 }}>
            {cart.map(item => (
              <div
                key={item.sku}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(122,92,62,0.06)'
                }}
              >
                <div style={{ maxWidth: '40%' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                    {item.name}
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--sand-muted)' }}>${item.price.toFixed(2)}</span>
                </div>

                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="subtle-button"
                    style={{ padding: 4, borderRadius: 6, minWidth: 24, height: 24 }}
                    onClick={() => handleUpdateQty(item.sku, -1)}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                  <button
                    type="button"
                    className="subtle-button"
                    style={{ padding: 4, borderRadius: 6, minWidth: 24, height: 24 }}
                    onClick={() => handleAddProduct(item)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: 50, textAlign: 'right' }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                    onClick={() => handleRemoveItem(item.sku)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--sand-muted)', fontSize: '0.9rem' }}>
                Register empty. Select products from the left to checkout.
              </div>
            )}
          </div>

          {/* Calculations footer */}
          <div style={{ borderTop: '1px solid rgba(166,124,82,0.14)', paddingTop: 12 }} className="stack">
            <div className="list-row" style={{ padding: '4px 0', fontSize: '0.86rem' }}>
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>
            <div className="list-row" style={{ padding: '4px 0', fontSize: '0.86rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Tax Rate (%)
              </span>
              <input
                type="number"
                className="surface-input"
                style={{ width: 50, padding: '2px 4px', fontSize: '0.8rem', textAlign: 'right', marginTop: 0 }}
                value={taxRate}
                onChange={(e) => saveSettings('pos_tax_rate', e.target.value)}
              />
            </div>
            <div className="list-row" style={{ padding: '4px 0', fontSize: '0.86rem' }}>
              <span>Tax Calculated</span>
              <strong>${tax.toFixed(2)}</strong>
            </div>
            <div className="list-row" style={{ padding: '8px 0 14px', borderTop: '1px dashed rgba(166,124,82,0.2)' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Total Due</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--color-accent-hover)', fontWeight: 800 }}>
                ${total.toFixed(2)}
              </strong>
            </div>

            {/* Bottom Actions grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className="subtle-button"
                style={{ border: '1px solid var(--color-border)', fontSize: '0.8rem', padding: '10px 0', justifyContent: 'center' }}
                onClick={handleOpenDrawer}
              >
                Open Drawer
              </button>
              <button
                type="button"
                className="subtle-button"
                style={{ border: '1px solid var(--color-border)', fontSize: '0.8rem', padding: '10px 0', color: 'var(--danger)', justifyContent: 'center' }}
                onClick={handleClearCart}
                disabled={cart.length === 0}
              >
                Clear
              </button>
              <button
                type="button"
                className="action-button"
                style={{ fontSize: '0.84rem', padding: '10px 0', background: 'var(--color-accent-primary)', justifyContent: 'center' }}
                onClick={() => {
                  if (cart.length > 0) {
                    setPaymentError('');
                    setAmountTendered('');
                    setIsPaymentModalOpen(true);
                  }
                }}
                disabled={cart.length === 0}
              >
                Charge
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isPaymentModalOpen && (
        <div className="overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsPaymentModalOpen(false)}>
          <div
            className="modal-card route-fade"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '460px',
              padding: 24,
              animation: 'scaleIn 0.2s ease-out',
              borderRadius: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3>Complete Checkout</h3>
              <button type="button" className="close-detail-btn" style={{ position: 'static' }} onClick={() => setIsPaymentModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {paymentError && (
              <div className="banner" style={{ borderLeftColor: 'var(--danger)', marginBottom: 16, padding: '8px 12px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>{paymentError}</span>
              </div>
            )}

            <div className="center bold" style={{ fontSize: '0.84rem', color: 'var(--sand-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Amount Due
            </div>
            <div className="center bold" style={{ fontSize: '2.4rem', color: 'var(--color-accent-hover)', margin: '4px 0 20px' }}>
              ${total.toFixed(2)}
            </div>

            {/* Payment Method selection */}
            <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
              <span className="eyebrow">Payment Method</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {['Cash', 'Card', 'Other'].map(method => (
                  <button
                    key={method}
                    type="button"
                    className="subtle-button"
                    style={{
                      border: '1px solid var(--color-border)',
                      background: paymentMethod === method ? 'var(--color-surface-strong)' : 'transparent',
                      borderColor: paymentMethod === method ? 'var(--color-accent-primary)' : 'var(--color-border)',
                      fontWeight: paymentMethod === method ? 700 : 500
                    }}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash payments Change calculations */}
            {paymentMethod === 'Cash' && (
              <div className="stack" style={{ gap: 12, background: 'rgba(214,195,163,0.1)', padding: 14, borderRadius: 12, marginBottom: 20 }}>
                <label>
                  <span className="eyebrow" style={{ fontSize: '0.74rem' }}>Amount Tendered ($)</span>
                  <input
                    type="number"
                    className="surface-input"
                    style={{ fontSize: '1.2rem', padding: 8, marginTop: 4 }}
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </label>
                
                {amountTendered && parseFloat(amountTendered) < total ? (
                  <span style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600 }}>
                    Warning: Tendered amount is less than total due.
                  </span>
                ) : amountTendered ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Change Due</span>
                    <strong style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
                      ${changeDue.toFixed(2)}
                    </strong>
                  </div>
                ) : null}
              </div>
            )}

            {paymentMethod === 'Card' && (
              <div style={{ padding: 14, background: 'rgba(166,124,82,0.06)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={18} color="var(--sand-muted)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  External card reader checkout. Verify payment on terminal before confirming.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <button
                type="button"
                className="subtle-button"
                style={{ flexGrow: 1, justifyContent: 'center' }}
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={charging}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                style={{ flexGrow: 1, justifyContent: 'center', background: 'var(--color-accent-primary)' }}
                disabled={!canConfirmPayment || charging || (paymentMethod === 'Cash' && !amountTendered)}
                onClick={handleConfirmPayment}
              >
                {charging ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

export default Cashier;
