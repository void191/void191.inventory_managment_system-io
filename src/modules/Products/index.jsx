import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Search, Plus, LayoutGrid, List, AlignJustify, X, Printer, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import Dropdown from '../../app/components/Dropdown';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';

function getStockBadge(product) {
  if (product.stock <= product.threshold) return 'badge badge--danger';
  if (product.stock <= product.threshold * 1.5) return 'badge badge--warning';
  return 'badge badge--success';
}

function Products({ eventBus }) {
  const [storeState, storeActions] = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState({ key: 'name', direction: 'asc' });
  const [selectedSku, setSelectedSku] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View mode state: 'list', 'compact', 'grid'
  const [viewMode, setViewMode] = useState('list');

  // Add Product modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Grains',
    price: '',
    supplier: '',
    threshold: '',
    stock: '0', // Initial stock is 0
    image: null,
    barcode: ''
  });

  // Collapsible additional details state
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const barcodeRef = useRef(null);

  const permissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('permissions') || '{}');
    } catch {
      return {};
    }
  }, []);

  const fetchProductsAndSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsData, suppliersData] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/suppliers')
      ]);

      const mappedProducts = productsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price),
        image: p.image_url
      }));

      const mappedSuppliers = suppliersData.map(s => ({
        ...s,
        contact: s.contact_name,
        rating: s.performance_rating
      }));

      storeActions.setProducts(mappedProducts);
      storeActions.setSuppliers(mappedSuppliers);
      
      if (mappedProducts.length > 0 && !selectedSku) {
        setSelectedSku(mappedProducts[0].sku);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load catalog data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndSuppliers();
  }, []);

  // Auto-fill supplier options
  const suppliersList = storeState.suppliers.map(s => s.name);
  const categories = ['All', ...new Set(storeState.products.map((p) => p.category))];

  const categoryOptions = categories.length > 1
    ? categories.filter(c => c !== 'All').map(c => ({ label: c, value: c }))
    : [
        { label: 'Grains', value: 'Grains' },
        { label: 'Equipment', value: 'Equipment' },
        { label: 'Packaging', value: 'Packaging' }
      ];

  // Auto-generate SKU suggestion
  const suggestedSku = useMemo(() => {
    const numbers = storeState.products.map(p => parseInt(p.sku.replace(/\D/g, ''))).filter(n => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 1000;
    return `SKU-${max + 1}`;
  }, [storeState.products]);

  // Handle product addition
  const handleAddProduct = async () => {
    const sku = suggestedSku;
    const barcode = newProduct.barcode || `0100${sku.replace(/\D/g, '')}8`;
    
    try {
      const added = await api.post('/api/products', {
        sku,
        name: newProduct.name,
        category: newProduct.category,
        price: parseFloat(newProduct.price) || 0,
        supplier: newProduct.supplier || suppliersList[0] || 'Unknown',
        reorder_threshold: parseInt(newProduct.threshold) || 10,
        barcode,
        additional_details: {},
        image_url: newProduct.image || '',
        initial_stock: parseInt(newProduct.stock) || 0
      });

      const mapped = {
        ...added,
        threshold: added.reorder_threshold,
        details: added.additional_details,
        price: parseFloat(added.price),
        image: added.image_url
      };

      storeActions.setState({ products: [...storeState.products, mapped] });

      // Reset form
      setNewProduct({
        name: '',
        category: 'Grains',
        price: '',
        supplier: '',
        threshold: '',
        stock: '0',
        image: null,
        barcode: ''
      });
      setIsAddModalOpen(false);
      setSelectedSku(sku); // Select the newly added product
    } catch (err) {
      alert(err.message || 'Failed to save product');
    }
  };

  // Handle product deletion (Admin only)
  const handleDeleteProduct = async (product) => {
    if (!product) return;
    if (!confirm(`Are you sure you want to delete ${product.name}? This will remove all database relationships, inventory quantities, and contracts associated with it.`)) {
      return;
    }

    try {
      await api.delete(`/api/products/${product.id}`);
      const updated = storeState.products.filter(p => p.id !== product.id);
      storeActions.setProducts(updated);
      setSelectedSku(updated[0]?.sku || null);
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const handleAddCustomField = async () => {
    if (!customKey.trim() || !customValue.trim() || !selectedProduct) return;
    
    const fields = selectedProduct.details || {};
    const updatedDetails = {
      ...fields,
      [customKey.trim()]: customValue.trim()
    };

    try {
      const updated = await api.put(`/api/products/${selectedProduct.id}`, {
        additional_details: updatedDetails
      });

      const mapped = {
        ...updated,
        threshold: updated.reorder_threshold,
        details: updated.additional_details,
        price: parseFloat(updated.price),
        image: updated.image_url
      };

      const updatedProducts = storeState.products.map(p => p.id === selectedProduct.id ? mapped : p);
      storeActions.setProducts(updatedProducts);
      setCustomKey('');
      setCustomValue('');
    } catch (err) {
      alert(err.message || 'Failed to add custom field');
    }
  };

  const handleSort = (key) => {
    setSortBy((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  // Thumbnail render helper
  const renderThumbnail = (product, size = 'small') => {
    if (product.image) {
      return (
        <img 
          src={product.image} 
          alt={product.name} 
          className="product-thumbnail-img" 
          style={size === 'large' ? { width: '80px', height: '80px', borderRadius: '12px' } : {}}
        />
      );
    }
    const letter = product.name ? product.name.charAt(0) : 'P';
    return (
      <div 
        className="product-thumbnail-placeholder"
        style={size === 'large' ? { width: '80px', height: '80px', borderRadius: '12px', fontSize: '2.2rem' } : {}}
      >
        {letter}
      </div>
    );
  };

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return storeState.products
      .filter((product) => {
        const matchesQuery =
          !normalizedQuery ||
          [product.sku, product.name, product.supplier].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );
        const matchesCategory = category === 'All' || product.category === category;
        return matchesQuery && matchesCategory;
      })
      .sort((left, right) => {
        const leftValue = left[sortBy.key];
        const rightValue = right[sortBy.key];
        const comparison = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
        return sortBy.direction === 'asc' ? comparison : -comparison;
      });
  }, [storeState.products, category, query, sortBy]);

  const selectedProduct =
    filteredProducts.find((product) => product.sku === selectedSku) ?? filteredProducts[0] ?? null;

  // Render Barcode via JsBarcode
  useEffect(() => {
    if (selectedProduct && barcodeRef.current && window.JsBarcode) {
      try {
        window.JsBarcode(barcodeRef.current, selectedProduct.barcode || selectedProduct.sku, {
          format: 'CODE128',
          width: 1.5,
          height: 38,
          displayValue: true,
          font: 'DM Sans',
          fontSize: 11,
          lineColor: '#3E2F23',
          background: 'transparent'
        });
      } catch (err) {
        console.error('JsBarcode failed', err);
      }
    }
  }, [selectedProduct, viewMode, selectedSku]);

  const handlePrintBarcode = () => {
    if (!selectedProduct) return;
    const svgHtml = document.getElementById('product-barcode').outerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode - ${selectedProduct.sku}</title>
          <style>
            body { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: "DM Sans", sans-serif; }
            h2 { margin-bottom: 20px; color: #3E2F23; }
            button { margin-top: 20px; padding: 10px 20px; background: #A67C52; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h2>${selectedProduct.name}</h2>
          ${svgHtml}
          <button onclick="window.print()">Print Barcode</button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <section className="module-page">
        <div className="module-header">
          <div className="module-header__title">
            <div className="module-header__title-icon">
              <moduleConfig.icon size={20} />
            </div>
            <div>
              <p className="eyebrow">Catalog</p>
              <h3>Loading Product Records...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '36px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-page">
        <div className="banner" style={{ borderLeftColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AlertTriangle color="var(--danger)" />
            <div>
              <strong>Error Loading Products</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchProductsAndSuppliers} className="subtle-button">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-page route-fade">
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <moduleConfig.icon size={20} />
          </div>
          <div>
            <p className="eyebrow">Catalog</p>
            <h3>Product Master Records</h3>
          </div>
        </div>
        {permissions.add_products && (
          <button type="button" className="action-button" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexGrow: 1, flexWrap: 'wrap' }}>
          <label style={{ minWidth: 240 }}>
            <span className="eyebrow">Search</span>
            <div style={{ position: 'relative', marginTop: 6 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--sand-muted)' }} />
              <input
                className="surface-input"
                style={{ paddingLeft: 38 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SKU, name, supplier"
              />
            </div>
          </label>
          <div style={{ minWidth: 160 }}>
            <Dropdown
              label="Category"
              value={category}
              onChange={setCategory}
              options={categories.map((option) => ({ label: option, value: option }))}
            />
          </div>
        </div>

        {/* View Mode Toggles */}
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8, background: 'rgba(214,195,163,0.14)', padding: 4, borderRadius: 12 }}>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: 8, borderRadius: 10, background: viewMode === 'list' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <AlignJustify size={16} />
          </button>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: 8, borderRadius: 10, background: viewMode === 'compact' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setViewMode('compact')}
            title="Compact View"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: 8, borderRadius: 10, background: viewMode === 'grid' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setViewMode('grid')}
            title="Grid Card View"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      <div className={`split-layout ${selectedProduct ? 'has-detail' : ''}`}>
        
        {/* Main Products Listing */}
        {viewMode === 'grid' ? (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article
                key={product.sku}
                className="product-grid-card"
                onClick={() => {
                  setSelectedSku(product.sku);
                  eventBus.emit('product:selected', product);
                }}
                style={selectedSku === product.sku ? { borderColor: 'var(--color-accent-primary)', background: '#fffcf7' } : {}}
              >
                <div className="product-grid-card__img-container">
                  {product.image ? (
                    <img src={product.image} className="product-grid-card__img" alt={product.name} />
                  ) : (
                    <div className="product-grid-card__placeholder">{product.name.charAt(0)}</div>
                  )}
                </div>
                <strong style={{ fontSize: '1.02rem', color: 'var(--color-text-dark)' }}>{product.name}</strong>
                <span className="eyebrow" style={{ fontSize: '0.74rem', margin: '4px 0 10px' }}>{product.sku}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span className={getStockBadge(product)}>{product.stock} units</span>
                  <strong style={{ color: 'var(--color-accent-hover)' }}>${product.price.toFixed(2)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={`table-shell ${viewMode === 'compact' ? 'is-compact' : ''}`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {[
                      ['sku', 'SKU'],
                      ['name', 'Name'],
                      ['category', 'Category'],
                      ['price', 'Price'],
                      ['supplier', 'Supplier'],
                      ['stock', 'Stock'],
                    ].map(([key, label]) => (
                      <th key={key}>
                        <button className="table-sort" type="button" onClick={() => handleSort(key)}>
                          {label} <ArrowUpDown size={12} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.sku}
                      className="clickable-row"
                      onClick={() => {
                        setSelectedSku(product.sku);
                        eventBus.emit('product:selected', product);
                      }}
                      style={selectedSku === product.sku ? { background: 'var(--color-surface-strong)' } : {}}
                    >
                      <td style={{ width: 48, paddingLeft: 16 }}>{renderThumbnail(product, 'small')}</td>
                      <td>{product.sku}</td>
                      <td style={{ fontWeight: 500 }}>{product.name}</td>
                      <td>{product.category}</td>
                      <td>${product.price.toFixed(2)}</td>
                      <td>{product.supplier}</td>
                      <td>
                        <span className={getStockBadge(product)}>{product.stock} units</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Product Detail Panel */}
        {selectedProduct && (
          <aside className="detail-panel" style={{ position: 'relative' }}>
            <button
              type="button"
              className="close-detail-btn"
              onClick={() => setSelectedSku(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}>
              {renderThumbnail(selectedProduct, 'large')}
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedProduct.name}</h4>
                <div className="inline-meta" style={{ marginTop: 4 }}>
                  <span>{selectedProduct.sku}</span>
                  <span>•</span>
                  <span>{selectedProduct.category}</span>
                </div>
              </div>
            </div>

            <div className="stack" style={{ marginTop: 20 }}>
              <div className="list-row">
                <span>Supplier</span>
                <strong>{selectedProduct.supplier}</strong>
              </div>
              <div className="list-row">
                <span>Unit Price</span>
                <strong>${selectedProduct.price.toFixed(2)}</strong>
              </div>
              <div className="list-row">
                <span>Current Stock</span>
                <strong>{selectedProduct.stock}</strong>
              </div>
              <div className="list-row">
                <span>Reorder Threshold</span>
                <strong>{selectedProduct.threshold}</strong>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <p style={{ marginBottom: 8, fontSize: '0.85rem' }} className="eyebrow">Stock Confidence</p>
              <div className="progress-track">
                <div
                  className={`progress-fill ${
                    selectedProduct.stock <= selectedProduct.threshold
                      ? 'is-danger'
                      : selectedProduct.stock <= selectedProduct.threshold * 1.5
                        ? 'is-warning'
                        : 'is-success'
                  }`}
                  style={{ width: `${Math.min((selectedProduct.stock / (selectedProduct.threshold * 2.5 || 100)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Render Barcode Section */}
            <div style={{ marginTop: 24, padding: 12, background: 'rgba(214,195,163,0.12)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg id="product-barcode" ref={barcodeRef} style={{ width: '100%' }}></svg>
              <button
                type="button"
                className="subtle-button"
                style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
                onClick={handlePrintBarcode}
              >
                <Printer size={14} /> Print Label
              </button>
            </div>

            {/* Expandable Additional Details Section */}
            <div style={{ marginTop: 20, borderTop: '1px solid rgba(122,92,62,0.14)', paddingTop: 16 }}>
              <button
                type="button"
                className="subtle-button"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent' }}
                onClick={() => setDetailsExpanded(!detailsExpanded)}
              >
                <span style={{ fontWeight: 600 }}>Additional Details</span>
                {detailsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {detailsExpanded && (
                <div style={{ marginTop: 12, paddingLeft: 12 }}>
                  {/* Render Custom Fields */}
                  {selectedProduct.details && Object.keys(selectedProduct.details).length > 0 ? (
                    <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
                      {Object.entries(selectedProduct.details).map(([label, value]) => (
                        <div key={label} className="list-row" style={{ padding: '6px 10px', fontSize: '0.86rem' }}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.84rem', color: 'var(--sand-muted)', margin: '0 0 12px' }}>No additional details fields configured.</p>
                  )}

                  {/* Add Custom Field Form (Viewer restricted) */}
                  {permissions.add_products && (
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr auto', alignItems: 'end' }}>
                      <input
                        className="surface-input"
                        style={{ padding: '8px', fontSize: '0.84rem' }}
                        placeholder="Label"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                      />
                      <input
                        className="surface-input"
                        style={{ padding: '8px', fontSize: '0.84rem' }}
                        placeholder="Value"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className="action-button"
                        style={{ padding: '8px 12px', borderRadius: 10 }}
                        onClick={handleAddCustomField}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete product button (Admin only) */}
            {permissions.delete_products && (
              <button
                type="button"
                className="subtle-button"
                style={{
                  marginTop: 24,
                  padding: '10px 14px',
                  width: '100%',
                  color: 'var(--danger)',
                  background: 'rgba(182, 84, 67, 0.08)',
                  border: 'none',
                  borderRadius: 12,
                  justifyContent: 'center',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={() => handleDeleteProduct(selectedProduct)}
              >
                Delete Product
              </button>
            )}

          </aside>
        )}
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="overlay" role="presentation" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card" role="dialog" onClick={(event) => event.stopPropagation()} style={{ width: '560px' }}>
            <div className="module-header" style={{ marginBottom: 20 }}>
              <div>
                <p className="eyebrow">New Catalog Item</p>
                <h3>Add New Product</h3>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <label>
                  <span className="eyebrow">Suggested SKU</span>
                  <input className="surface-input" value={suggestedSku} disabled style={{ background: 'rgba(214,195,163,0.1)' }} />
                </label>
                <label>
                  <span className="eyebrow">Barcode (Optional)</span>
                  <input
                    className="surface-input"
                    placeholder="Auto-generated if blank"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span className="eyebrow">Product Name</span>
                <input
                  className="surface-input"
                  placeholder="e.g. Organic Dent Corn"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </label>

              <div className="form-grid">
                <Dropdown
                  label="Category"
                  value={newProduct.category}
                  onChange={(val) => setNewProduct({ ...newProduct, category: val })}
                  options={categoryOptions}
                />
                
                <Dropdown
                  label="Supplier"
                  value={newProduct.supplier || suppliersList[0] || ''}
                  onChange={(val) => setNewProduct({ ...newProduct, supplier: val })}
                  options={suppliersList.map(name => ({ label: name, value: name }))}
                />
              </div>

              <div className="form-grid">
                <label>
                  <span className="eyebrow">Unit Price ($)</span>
                  <input
                    className="surface-input"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                </label>

                <label>
                  <span className="eyebrow">Initial Stock</span>
                  <input
                    className="surface-input"
                    type="number"
                    placeholder="0"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  />
                </label>

                <label>
                  <span className="eyebrow">Reorder Threshold</span>
                  <input
                    className="surface-input"
                    type="number"
                    placeholder="10"
                    value={newProduct.threshold}
                    onChange={(e) => setNewProduct({ ...newProduct, threshold: e.target.value })}
                  />
                </label>
              </div>

              {/* Image Upload field */}
              <label>
                <span className="eyebrow">Product Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="surface-input"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewProduct({ ...newProduct, image: reader.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="subtle-button" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                onClick={handleAddProduct}
                disabled={!newProduct.name || !newProduct.price}
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Products;
