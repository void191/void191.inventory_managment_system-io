import React, { useState, useEffect } from 'react';
import api from '../../api';

const permissionKeys = [
  { key: 'view_dashboard', label: 'View Dashboard' },
  { key: 'view_products', label: 'View Products Catalog' },
  { key: 'add_products', label: 'Add/Create Products' },
  { key: 'delete_products', label: 'Delete Products' },
  { key: 'view_stock_levels', label: 'View Stock Levels' },
  { key: 'view_purchase_orders', label: 'View Purchase Orders' },
  { key: 'create_purchase_orders', label: 'Create Purchase Orders' },
  { key: 'receive_purchase_orders', label: 'Receive Purchase Orders' },
  { key: 'view_sales_orders', label: 'View Sales Orders' },
  { key: 'ship_sales_orders', label: 'Ship / Return Sales Orders' },
  { key: 'view_cashier', label: 'Access Cashier POS Tab' },
  { key: 'view_warehouses', label: 'View Warehouses List' },
  { key: 'view_suppliers', label: 'View Suppliers' },
  { key: 'view_stock_movements', label: 'View Stock Movements' },
  { key: 'view_reports', label: 'Access Analytics & Reports' },
  { key: 'view_users', label: 'Access User Management Panel' }
];

const defaultPermissionsForRole = (roleName) => {
  const norm = roleName.toLowerCase();
  if (norm === 'admin') {
    return {
      view_dashboard: true,
      view_products: true,
      add_products: true,
      delete_products: true,
      view_stock_levels: true,
      view_purchase_orders: true,
      create_purchase_orders: true,
      receive_purchase_orders: true,
      view_sales_orders: true,
      ship_sales_orders: true,
      view_cashier: true,
      view_warehouses: true,
      view_suppliers: true,
      view_stock_movements: true,
      view_reports: true,
      view_users: true
    };
  } else if (norm === 'manager') {
    return {
      view_dashboard: true,
      view_products: true,
      add_products: true,
      delete_products: false,
      view_stock_levels: true,
      view_purchase_orders: true,
      create_purchase_orders: true,
      receive_purchase_orders: true,
      view_sales_orders: true,
      ship_sales_orders: true,
      view_cashier: false,
      view_warehouses: true,
      view_suppliers: true,
      view_stock_movements: true,
      view_reports: true,
      view_users: false
    };
  } else if (norm === 'cashier') {
    return {
      view_dashboard: true,
      view_products: true,
      add_products: false,
      delete_products: false,
      view_stock_levels: false,
      view_purchase_orders: false,
      create_purchase_orders: false,
      receive_purchase_orders: false,
      view_sales_orders: true,
      ship_sales_orders: false,
      view_cashier: true,
      view_warehouses: false,
      view_suppliers: false,
      view_stock_movements: false,
      view_reports: false,
      view_users: false
    };
  } else {
    // Viewer
    return {
      view_dashboard: true,
      view_products: true,
      add_products: false,
      delete_products: false,
      view_stock_levels: true,
      view_purchase_orders: true,
      create_purchase_orders: false,
      receive_purchase_orders: false,
      view_sales_orders: true,
      ship_sales_orders: false,
      view_cashier: false,
      view_warehouses: true,
      view_suppliers: true,
      view_stock_movements: true,
      view_reports: true,
      view_users: false
    };
  }
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Viewer');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Edit Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('Viewer');
  const [editModalError, setEditModalError] = useState('');
  const [editModalLoading, setEditModalLoading] = useState(false);

  // Granular Permissions states
  const [permissions, setPermissions] = useState(defaultPermissionsForRole('Viewer'));
  const [editPermissions, setEditPermissions] = useState({});

  const handleRoleChangeForCreate = (newRole) => {
    setRole(newRole);
    setPermissions(defaultPermissionsForRole(newRole));
  };

  const handleRoleChangeForEdit = (newRole) => {
    setEditRole(newRole);
    setEditPermissions(defaultPermissionsForRole(newRole));
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/users');
      setUsers(data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load users');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeactivate = async (userId) => {
    if (userId === currentUser.id) {
      alert('You cannot deactivate your own account.');
      return;
    }

    if (!confirm('Are you sure you want to deactivate this user? This action is permanent and prevents them from logging in.')) {
      return;
    }

    try {
      await api.patch(`/api/users/${userId}/deactivate`);
      // Update list locally
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: false } : u));
    } catch (err) {
      alert(err.message || 'Failed to deactivate user');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!fullName || !email || !password || !confirmPassword) {
      setModalError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setModalError('Passwords do not match');
      return;
    }

    // Password validation: at least 8 chars, 1 uppercase letter, 1 number
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      setModalError('Password must be at least 8 characters long, containing at least one uppercase letter and one number.');
      return;
    }

    setModalLoading(true);
    try {
      const newUser = await api.post('/api/users', {
        full_name: fullName,
        email,
        password,
        role: role.toLowerCase(),
        permissions
      });
      
      setUsers([newUser, ...users]);
      setModalLoading(false);
      setShowModal(false);
      
      // Clear inputs
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('Viewer');
      setPermissions(defaultPermissionsForRole('Viewer'));
    } catch (err) {
      setModalError(err.message || 'Failed to create user');
      setModalLoading(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditModalError('');

    if (!editFullName || !editEmail || !editRole) {
      setEditModalError('Full name, email, and role are required');
      return;
    }

    if (editPassword) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(editPassword)) {
        setEditModalError('Password must be at least 8 characters long, containing at least one uppercase letter and one number.');
        return;
      }
    }

    setEditModalLoading(true);
    try {
      const updatedUser = await api.put(`/api/users/${editUserId}`, {
        full_name: editFullName,
        email: editEmail,
        password: editPassword || undefined,
        role: editRole.toLowerCase(),
        permissions: editPermissions
      });

      setUsers(users.map(u => u.id === editUserId ? { ...u, ...updatedUser } : u));
      setEditModalLoading(false);
      setShowEditModal(false);

      setEditUserId(null);
      setEditFullName('');
      setEditEmail('');
      setEditPassword('');
      setEditRole('Viewer');
      setEditPermissions({});
    } catch (err) {
      setEditModalError(err.message || 'Failed to update user');
      setEditModalLoading(false);
    }
  };

  const renderRolePill = (roleName) => {
    const normRole = roleName.toLowerCase();
    let bg = '#C2A27C'; // Viewer default
    if (normRole === 'admin') bg = '#7A5C3E';
    else if (normRole === 'manager') bg = '#A67C52';
    else if (normRole === 'cashier') bg = '#A68B52';
    
    return (
      <span className="badge" style={{ backgroundColor: bg, color: '#ffffff', textTransform: 'capitalize' }}>
        {roleName}
      </span>
    );
  };

  const renderStatusPill = (isActive) => {
    if (isActive) {
      return (
        <span className="badge" style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
          Active
        </span>
      );
    } else {
      return (
        <span className="badge" style={{ backgroundColor: '#ffebee', color: '#c62828' }}>
          Inactive
        </span>
      );
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1.24rem' }}>User Management</h3>
            <p>Admin panel to register and manage warehouse staff credentials</p>
          </div>
        </div>

        <button onClick={() => setShowModal(true)} className="action-button">
          <span>+ Create User</span>
        </button>
      </div>

      {loading ? (
        <div className="card stack" style={{ padding: 24, gap: 16 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '36px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
        </div>
      ) : error ? (
        <div className="banner" style={{ borderLeftColor: 'var(--danger)' }}>
          <div>
            <strong>Error Loading Users</strong>
            <p>{error}</p>
          </div>
          <button onClick={fetchUsers} className="subtle-button">Retry</button>
        </div>
      ) : (
        <div className="table-shell">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600 }}>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{renderRolePill(user.role)}</td>
                    <td>{renderStatusPill(user.is_active)}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => {
                            setEditUserId(user.id);
                            setEditFullName(user.full_name);
                            setEditEmail(user.email);
                            setEditRole(user.role);
                            setEditPermissions(user.permissions || defaultPermissionsForRole(user.role));
                            setEditPassword('');
                            setEditModalError('');
                            setShowEditModal(true);
                          }}
                          className="subtle-button"
                          style={{ color: 'var(--color-accent-hover)', background: 'rgba(166, 124, 82, 0.08)' }}
                        >
                          Edit
                        </button>
                      )}
                      {user.is_active && user.id !== currentUser.id ? (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="subtle-button"
                          style={{ color: 'var(--danger)', background: 'rgba(182, 84, 67, 0.08)' }}
                        >
                          Deactivate
                        </button>
                      ) : user.id === currentUser.id ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--sand-muted)', fontStyle: 'italic' }}>Your Account</span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showModal && (
        <div className="overlay">
          <div className="modal-card">
            <h4 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Create New User Account</h4>
            <form onSubmit={handleCreateUser} className="stack" style={{ gap: 16 }}>
              <div className="login-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@grainhouse.com"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars, 1 upper, 1 number"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>Role Defaults</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChangeForCreate(e.target.value)}
                  className="login-input"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem', marginBottom: 8, display: 'block' }}>Granular Tab & Action Permissions</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: '150px', overflowY: 'auto', padding: '10px', border: '1px solid rgba(122, 92, 62, 0.12)', borderRadius: 8, background: '#fffcf7' }}>
                  {permissionKeys.map(p => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--sand-ink)' }}>
                      <input
                        type="checkbox"
                        checked={!!permissions[p.key]}
                        onChange={() => setPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                        style={{ cursor: 'pointer' }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              {modalError && <div className="login-error">{modalError}</div>}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setModalError(''); }}
                  className="subtle-button"
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-button"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && (
        <div className="overlay">
          <div className="modal-card">
            <h4 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Edit User Account & Permissions</h4>
            <form onSubmit={handleEditUser} className="stack" style={{ gap: 16 }}>
              <div className="login-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="John Doe"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="john@grainhouse.com"
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label>New Password (Optional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="login-input"
                />
              </div>

              <div className="login-field">
                <label>Role Defaults</label>
                <select
                  value={editRole}
                  onChange={(e) => handleRoleChangeForEdit(e.target.value)}
                  className="login-input"
                  style={{ cursor: 'pointer', textTransform: 'capitalize' }}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600, fontSize: '0.86rem', marginBottom: 8, display: 'block' }}>Granular Tab & Action Permissions</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', maxHeight: '150px', overflowY: 'auto', padding: '10px', border: '1px solid rgba(122, 92, 62, 0.12)', borderRadius: 8, background: '#fffcf7' }}>
                  {permissionKeys.map(p => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--sand-ink)' }}>
                      <input
                        type="checkbox"
                        checked={!!editPermissions[p.key]}
                        onChange={() => setEditPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                        style={{ cursor: 'pointer' }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              {editModalError && <div className="login-error">{editModalError}</div>}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditModalError(''); }}
                  className="subtle-button"
                  disabled={editModalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-button"
                  disabled={editModalLoading}
                >
                  {editModalLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
