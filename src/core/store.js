import { useState, useEffect } from 'react';

// Singleton state initialized to empty arrays since data is fetched from API
let state = {
  products: [],
  purchaseOrders: [],
  salesOrders: [],
  warehouses: [],
  suppliers: [],
  stockMovements: [],
  stockLevels: [],
  pendingNewPO: null,
};

const listeners = new Set();

export const store = {
  getState() {
    return state;
  },
  setState(nextState) {
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener(state));
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Setters for dynamic loading from API
  setProducts(products) {
    this.setState({ products });
  },
  setPurchaseOrders(purchaseOrders) {
    this.setState({ purchaseOrders });
  },
  setSalesOrders(salesOrders) {
    this.setState({ salesOrders });
  },
  setWarehouses(warehouses) {
    this.setState({ warehouses });
  },
  setSuppliers(suppliers) {
    this.setState({ suppliers });
  },
  setStockMovements(stockMovements) {
    this.setState({ stockMovements });
  },
  setStockLevels(stockLevels) {
    this.setState({ stockLevels });
  },

  // Actions for backward compatibility and local updates
  addProduct(product) {
    const products = [...state.products, {
      ...product,
      price: parseFloat(product.price) || 0,
      stock: parseInt(product.stock) || 0,
      threshold: parseInt(product.threshold) || 0,
      barcode: product.barcode || `0100${product.sku.replace(/\D/g, '') || '0000'}8`
    }];
    this.setState({ products });
  },
  addPurchaseOrder(order) {
    const purchaseOrders = [order, ...state.purchaseOrders];
    this.setState({ purchaseOrders });
  },
  updatePurchaseOrderStatus(orderId, status) {
    const purchaseOrders = state.purchaseOrders.map((o) =>
      o.id === orderId ? { ...o, status } : o
    );
    this.setState({ purchaseOrders });
  },
  updateSalesOrderStatus(orderId, status) {
    const salesOrders = state.salesOrders.map((o) =>
      o.id === orderId ? { ...o, status } : o
    );
    this.setState({ salesOrders });
  },
  addStockMovement(movement) {
    const stockMovements = [movement, ...state.stockMovements];
    this.setState({ stockMovements });
  },
  setPendingNewPO(po) {
    this.setState({ pendingNewPO: po });
  }
};

export function useStore() {
  const [currentState, setCurrentState] = useState(state);

  useEffect(() => {
    return store.subscribe((nextState) => {
      setCurrentState(nextState);
    });
  }, []);

  return [currentState, store];
}
