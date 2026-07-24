import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { api, storeSession, clearSession, getStoredSession } from '../lib/api';

function parseQrSlug(): string | null {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('table') ?? params.get('slug') ?? params.get('qr');
  if (slug) localStorage.setItem('qr_slug', slug);
  return slug ?? localStorage.getItem('qr_slug');
}

type View = 'menu' | 'order' | 'payment' | 'feedback';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifierIds: string[];
  modifierNames: string[];
  modifiersPrice: number;
  notes: string;
}

interface ProductWithPrice {
  id: string;
  name: string;
  localName: string | null;
  description: string | null;
  isAvailable: boolean;
  categoryId: string;
  imageUrl: string | null;
  price: number;
  currency: string;
}

interface ModifierWithGroup {
  id: string;
  name: string;
  priceDelta: number;
  modifierGroupId: string;
  groupName: string;
  minSelect: number;
  maxSelect: number;
}

function formatMoney(amount: number, currency: string = 'KES'): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function App() {
  const [session, setSession] = useState(getStoredSession);
  const [qrSlug, setQrSlug] = useState(parseQrSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('menu');

  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; menuId: string }[]>([]);
  const [modifiers, setModifiers] = useState<ModifierWithGroup[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductWithPrice | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  const [currentOrder, setCurrentOrder] = useState<{
    orderId: string;
    order: any;
    items: any[];
    bill: any;
  } | null>(null);

  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [waiterReason, setWaiterReason] = useState('');
  const [waiterSent, setWaiterSent] = useState(false);

  const [feedbackItemId, setFeedbackItemId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const [firingCourse, setFiringCourse] = useState(false);
  const [courseFired, setCourseFired] = useState<string | null>(null);

  const [dishRatingItemId, setDishRatingItemId] = useState<string | null>(null);
  const [dishRatingValue, setDishRatingValue] = useState(0);
  const [dishRatingSent, setDishRatingSent] = useState<Record<string, boolean>>({});

  const loadMenu = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMenu(token);
      const priceMap = new Map(data.productPrices.map(p => [p.productId, p]));
      const categoryMap = new Map(data.categories.map(c => [c.id, c]));
      const modGroupMap = new Map(data.modifierGroups.map(g => [g.id, g]));
      const linkMap = new Map<string, { minSelect: number; maxSelect: number; modifierGroupId: string }[]>();
      for (const link of data.productModifierGroups) {
        const arr = linkMap.get(link.productId) || [];
        arr.push({ modifierGroupId: link.modifierGroupId, minSelect: link.minSelect, maxSelect: link.maxSelect });
        linkMap.set(link.productId, arr);
      }

      setProducts(
        data.products.map(p => ({
          ...p,
          price: priceMap.get(p.id)?.priceAmount ?? 0,
          currency: priceMap.get(p.id)?.currency ?? 'KES',
        }))
      );
      setCategories(data.categories);
      setModifiers(
        data.modifiers.map(m => ({
          ...m,
          groupName: modGroupMap.get(m.modifierGroupId)?.name ?? '',
          minSelect: modGroupMap.get(m.modifierGroupId)?.minSelect ?? 0,
          maxSelect: modGroupMap.get(m.modifierGroupId)?.maxSelect ?? 0,
        }))
      );
      if (data.categories.length > 0) {
        const firstCat = data.categories[0];
        if (firstCat) setActiveCategory(firstCat.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadMenu(session.token);
    }
  }, [session, loadMenu]);

  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrSlug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.createSession(qrSlug);
      storeSession(data.token, { table: data.table });
      setSession({ token: data.token, table: data.table });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setCart([]);
    setCurrentOrder(null);
    setView('menu');
  };

  const handleProductClick = (product: ProductWithPrice) => {
    setSelectedProduct(product);
    setSelectedModifiers([]);
    setItemQuantity(1);
    setItemNotes('');
  };

  const toggleModifier = (modId: string) => {
    setSelectedModifiers(prev =>
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const modNames = modifiers.filter(m => selectedModifiers.includes(m.id)).map(m => m.name);
    const modsPrice = modifiers.filter(m => selectedModifiers.includes(m.id)).reduce((s, m) => s + m.priceDelta, 0);
    setCart(prev => [...prev, {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: itemQuantity,
      unitPrice: selectedProduct.price,
      modifierIds: selectedModifiers,
      modifierNames: modNames,
      modifiersPrice: modsPrice,
      notes: itemNotes,
    }]);
    setSelectedProduct(null);
    setSelectedModifiers([]);
    setItemQuantity(1);
    setItemNotes('');
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateCartItemQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const qty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: qty };
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice + item.modifiersPrice) * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const productMods = selectedProduct
    ? modifiers.filter(m => {
        // This is simplified - in real app you'd check productModifierGroups
        return true;
      })
    : [];

  const handlePlaceOrder = async () => {
    if (!session || cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.submitOrder(
        session.token,
        cart.map(item => {
          const body: { productId: string; quantity: number; modifierIds?: string[]; notes?: string } = {
            productId: item.productId,
            quantity: item.quantity,
          };
          if (item.modifierIds.length > 0) body.modifierIds = item.modifierIds;
          if (item.notes) body.notes = item.notes;
          return body;
        }),
      );
      setCurrentOrder({
        orderId: data.order.id,
        order: data.order,
        items: data.items,
        bill: data.bill,
      });
      setCart([]);
      setShowCart(false);
      setView('order');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayMpesa = async () => {
    if (!session || !currentOrder) return;
    if (!paymentPhone.match(/^(\+?254|0)7\d{8}$/)) {
      setError('Please enter a valid M-Pesa phone number');
      return;
    }
    setPaymentLoading(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.payMpesa(session.token, currentOrder.orderId, paymentPhone, idempotencyKey);
      setPaymentLoading(false);
      setView('feedback');
    } catch (err: any) {
      setError(err.message);
      setPaymentLoading(false);
    }
  };

  const handleRequestWaiter = async () => {
    if (!session) return;
    try {
      await api.requestWaiter(session.token, waiterReason || undefined);
      setWaiterSent(true);
      setTimeout(() => setWaiterSent(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!session || !feedbackItemId || feedbackRating === 0) return;
    try {
      await api.submitFeedback(session.token, feedbackItemId, feedbackRating, feedbackComment || undefined);
      setFeedbackSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFireCourse = async (courseName: string) => {
    if (!session || !currentOrder) return;
    setFiringCourse(true);
    setError(null);
    try {
      const result = await api.fireCourse(session.token, currentOrder.orderId, courseName);
      setCourseFired(courseName);
      setFiringCourse(false);
      setTimeout(() => setCourseFired(null), 3000);
      currentOrder.items.forEach((item: any) => {
        if (item.course === courseName && item.status === 'draft') {
          item.status = 'sent';
        }
      });
      if (currentOrder.order.status === 'draft' || currentOrder.order.status === 'open') {
        currentOrder.order.status = 'sent_to_kitchen';
      }
      setCurrentOrder({ ...currentOrder });
    } catch (err: any) {
      setError(err.message);
      setFiringCourse(false);
    }
  };

  const handleRateDish = async (orderItemId: string) => {
    if (!session || dishRatingValue === 0) return;
    try {
      await api.rateDish(session.token, orderItemId, dishRatingValue);
      setDishRatingSent(prev => ({ ...prev, [orderItemId]: true }));
      setDishRatingItemId(null);
      setDishRatingValue(0);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const futureCourses = currentOrder
    ? [...new Set(currentOrder.items
        .filter((item: any) => item.course && item.status === 'draft')
        .map((item: any) => item.course))]
    : [];

  if (!session) {
    return (
      <main className="app-shell loading-shell">
        <section className="panel login-panel" style={{ width: 'min(420px, 100%)' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Welcome</h1>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>
            Scan a QR code on your table to view the menu and order.
          </p>
          <form onSubmit={handleQrSubmit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="field">
              <span className="eyebrow">Table QR Code</span>
              <input
                type="text"
                placeholder="Enter QR slug or scan code"
                value={qrSlug ?? ''}
                onChange={e => setQrSlug(e.target.value)}
              />
            </div>
            {error && <div className="notice notice--error">{error}</div>}
            <button type="submit" className="primary-button full-width" disabled={loading || !qrSlug}>
              {loading ? 'Loading...' : 'Start Ordering'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const filteredProducts = activeCategory
    ? products.filter(p => p.categoryId === activeCategory)
    : products;

  const orderStatusSteps = [
    { key: 'draft', label: 'Order Placed' },
    { key: 'sent_to_kitchen', label: 'Sent to Kitchen' },
    { key: 'ready', label: 'Ready' },
    { key: 'served', label: 'Served' },
    { key: 'bill_requested', label: 'Bill Requested' },
  ];

  const orderStatusIndex = currentOrder
    ? orderStatusSteps.findIndex(s => s.key === currentOrder.order.status)
    : -1;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h2>{session.table.label}</h2>
          {session.table.section && <p className="muted" style={{ fontSize: '0.82rem' }}>{session.table.section}</p>}
        </div>
        <div className="topbar-actions">
          {currentOrder && (
            <button className="secondary-button" onClick={() => setView(view === 'order' ? 'menu' : 'order')}>
              {view === 'order' ? 'Menu' : 'My Order'}
            </button>
          )}
          <button className="secondary-button" onClick={handleLogout}>Exit</button>
        </div>
      </header>

      {error && <div className="notice notice--error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {view === 'menu' && !currentOrder && (
        <>
          {categories.length > 0 && (
            <nav className="nav-row">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`nav-btn ${activeCategory === cat.id ? 'nav-btn--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          )}

          {loading && products.length === 0 ? (
            <div className="empty-state">Loading menu...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">No items in this category</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={`product-card ${!product.isAvailable ? 'product-card__unavailable' : ''}`}
                  onClick={() => product.isAvailable && handleProductClick(product)}
                >
                  <h3>{product.name}</h3>
                  {product.description && <p className="product-card__desc">{product.description}</p>}
                  <p className="product-card__price">{formatMoney(product.price)}</p>
                  {!product.isAvailable && <p className="muted" style={{ fontSize: '0.78rem' }}>Unavailable</p>}
                </div>
              ))}
            </div>
          )}

          {cartCount > 0 && (
            <button className="cart-toggle" onClick={() => setShowCart(true)}>
              Cart <span className="cart-toggle__count">{cartCount}</span>
            </button>
          )}
        </>
      )}

      {view === 'menu' && currentOrder && (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="panel">
            <div className="section-header">
              <h2>Your Order</h2>
              <span className={`pill ${currentOrder.order.status === 'paid' ? 'pill--success' : 'pill--warning'}`}>
                {currentOrder.order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="order-items-list">
              {currentOrder.items.map((item: any) => (
                <div key={item.id} className="order-item-card">
                  <div>
                    <div className="order-item-card__name">{item.quantity}x {item.nameSnapshot}</div>
                    <div className="order-item-card__meta">{formatMoney(item.totalAmount)}</div>
                  </div>
                  <span className={`pill ${item.status === 'served' ? 'pill--success' : ''}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: '0.5rem' }}>Need help?</h3>
            <div className="actions-row">
              <button className="secondary-button" onClick={() => setWaiterReason('')}>
                {waiterSent ? 'Waiter Notified!' : 'Call Waiter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <>
          <div className="overlay" onClick={() => setShowCart(false)} />
          <div className="cart-panel">
            <div className="cart-panel__header">
              <h2>Your Cart</h2>
              <button className="close-btn" onClick={() => setShowCart(false)}>x</button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-state">Cart is empty</div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item, index) => (
                    <div key={index} className="cart-item">
                      <div className="cart-item__info">
                        <div className="cart-item__name">{item.name}</div>
                        {item.modifierNames.length > 0 && (
                          <div className="cart-item__mods">+ {item.modifierNames.join(', ')}</div>
                        )}
                        {item.notes && <div className="cart-item__mods">Note: {item.notes}</div>}
                        <div className="cart-item__qty-row">
                          <button className="qty-btn" onClick={() => updateCartItemQty(index, -1)}>-</button>
                          <span className="qty-value">{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateCartItemQty(index, 1)}>+</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="cart-item__price">{formatMoney(item.unitPrice * item.quantity)}</div>
                        <button className="cart-item__remove" onClick={() => removeFromCart(index)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div className="cart-summary__row">
                    <span>Total</span>
                    <span className="cart-summary__total">{formatMoney(cartTotal)}</span>
                  </div>
                  <button className="primary-button full-width" onClick={handlePlaceOrder} disabled={loading || cart.length === 0}>
                    {loading ? 'Placing Order...' : 'Place Order'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {selectedProduct && (
        <div className="overlay" onClick={() => setSelectedProduct(null)}>
          <div className="panel modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProduct.name}</h2>
              <button className="close-btn" onClick={() => setSelectedProduct(null)}>x</button>
            </div>
            {selectedProduct.description && <p className="muted" style={{ marginBottom: '1rem' }}>{selectedProduct.description}</p>}
            <p className="product-card__price" style={{ marginBottom: '1rem' }}>{formatMoney(selectedProduct.price)}</p>

            <div className="modifier-group">
              <label className="field">
                <span className="eyebrow">Special instructions</span>
                <input
                  type="text"
                  placeholder="e.g. No onions, extra sauce..."
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                />
              </label>
            </div>

            <div className="quantity-row" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
              <button className="qty-btn" onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}>-</button>
              <span className="qty-value">{itemQuantity}</span>
              <button className="qty-btn" onClick={() => setItemQuantity(itemQuantity + 1)}>+</button>
            </div>

            <div className="cart-summary">
              <div className="cart-summary__row">
                <span>Total</span>
                <span className="cart-summary__total">
                  {formatMoney((selectedProduct.price) * itemQuantity)}
                </span>
              </div>
              <button className="primary-button full-width" onClick={addToCart}>
                Add to Cart - {formatMoney((selectedProduct.price) * itemQuantity)}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'order' && currentOrder && (
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="panel">
            <div className="section-header">
              <h2>Order Status</h2>
              <span className={`pill ${currentOrder.order.status === 'paid' ? 'pill--success' : 'pill--warning'}`}>
                {currentOrder.order.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="status-timeline">
              {orderStatusSteps.map((step, idx) => (
                <div
                  key={step.key}
                  className={`status-step ${
                    idx < orderStatusIndex ? 'status-step--done' :
                    idx === orderStatusIndex ? 'status-step--active' :
                    'status-step--pending'
                  }`}
                >
                  <div className="status-step__icon">
                    {idx < orderStatusIndex ? '\u2713' : idx + 1}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <h3>Order Items</h3>
              <span className="muted">{formatMoney(currentOrder.order.totalAmount)}</span>
            </div>
            <div className="order-items-list">
              {currentOrder.items.map((item: any) => (
                <div key={item.id} className="order-item-card">
                  <div>
                    <div className="order-item-card__name">{item.quantity}x {item.nameSnapshot}</div>
                    <div className="order-item-card__meta">{formatMoney(item.totalAmount)}</div>
                    {item.course && <div className="order-item-card__meta" style={{ fontSize: '0.75rem' }}>Course: {item.course}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`pill ${item.status === 'served' ? 'pill--success' : ''}`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    {item.status === 'served' && !dishRatingSent[item.id] && (
                      <button className="secondary-button" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }} onClick={() => { setDishRatingItemId(item.id); setDishRatingValue(0); }}>
                        Rate
                      </button>
                    )}
                    {dishRatingSent[item.id] && <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>Rated</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {futureCourses.length > 0 && (
            <div className="panel">
              <h3 style={{ marginBottom: '0.5rem' }}>Courses</h3>
              {futureCourses.map(courseName => (
                <div key={courseName} className="actions-row" style={{ marginBottom: '0.5rem' }}>
                  <button
                    className="primary-button full-width"
                    onClick={() => handleFireCourse(courseName)}
                    disabled={firingCourse}
                  >
                    {firingCourse ? 'Firing...' : courseFired === courseName ? 'Fired!' : `Fire ${courseName}`}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <div className="section-header">
              <h3>Payment</h3>
            </div>
            <p className="muted" style={{ marginBottom: '0.75rem' }}>
              Total Due: <strong style={{ color: '#bbf7d0' }}>{formatMoney(currentOrder.bill.totalAmount)}</strong>
            </p>
            <button className="primary-button full-width" onClick={() => setView('payment')}>
              Pay with M-Pesa
            </button>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: '0.5rem' }}>Need Assistance?</h3>
            <div className="actions-row">
              <input
                type="text"
                placeholder="Reason (optional)"
                value={waiterReason}
                onChange={e => setWaiterReason(e.target.value)}
                style={{
                  flex: 1,
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#f8fafc',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 0.9rem',
                }}
              />
              <button className="secondary-button" onClick={handleRequestWaiter}>
                {waiterSent ? 'Notified!' : 'Call Waiter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'payment' && (
        <div className="panel">
          <div className="modal-header">
            <h2>Pay with M-Pesa</h2>
            <button className="close-btn" onClick={() => setView('order')}>x</button>
          </div>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Total: <strong style={{ color: '#bbf7d0' }}>{formatMoney(currentOrder?.bill.totalAmount ?? 0)}</strong>
          </p>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <span className="eyebrow">M-Pesa Phone Number</span>
            <input
              type="tel"
              placeholder="e.g. 0712345678"
              value={paymentPhone}
              onChange={e => setPaymentPhone(e.target.value)}
            />
          </div>
          {error && <div className="notice notice--error">{error}</div>}
          <button
            className="primary-button full-width"
            onClick={handlePayMpesa}
            disabled={paymentLoading || !paymentPhone}
          >
            {paymentLoading ? 'Sending M-Pesa Request...' : `Pay ${formatMoney(currentOrder?.bill.totalAmount ?? 0)}`}
          </button>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            You will receive an M-Pesa prompt on your phone. Enter your PIN to confirm.
          </p>
        </div>
      )}

      {dishRatingItemId && (
        <>
          <div className="overlay" onClick={() => { setDishRatingItemId(null); setDishRatingValue(0); }} />
          <div className="panel modal" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Rate this dish</h2>
            <p className="muted" style={{ marginBottom: '1rem' }}>Tap a star to rate</p>
            <div className="feedback-stars" style={{ marginBottom: '1rem' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  className={`star-btn ${star <= dishRatingValue ? 'star-btn--active' : ''}`}
                  onClick={() => setDishRatingValue(dishRatingValue === star ? 0 : star)}
                >
                  {'\u2605'}
                </button>
              ))}
            </div>
            <button
              className="primary-button full-width"
              onClick={() => handleRateDish(dishRatingItemId)}
              disabled={dishRatingValue === 0}
            >
              Submit Rating
            </button>
          </div>
        </>
      )}

      {view === 'feedback' && (
        <div className="panel" style={{ textAlign: 'center' }}>
          {feedbackSent ? (
            <>
              <h2 style={{ marginBottom: '0.5rem' }}>Thank You!</h2>
              <p className="muted">Your feedback helps us improve.</p>
              <button className="primary-button" style={{ marginTop: '1rem' }} onClick={() => setView('menu')}>
                Back to Menu
              </button>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: '0.5rem' }}>How was your meal?</h2>
              <p className="muted" style={{ marginBottom: '1rem' }}>Tap a star to rate</p>

              <div className="feedback-stars" style={{ marginBottom: '1rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star-btn ${star <= feedbackRating ? 'star-btn--active' : ''}`}
                    onClick={() => setFeedbackRating(feedbackRating === star ? 0 : star)}
                  >
                    {'\u2605'}
                  </button>
                ))}
              </div>

              <div className="field" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <span className="eyebrow">Comment (optional)</span>
                <input
                  type="text"
                  placeholder="Tell us about your experience..."
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                />
              </div>

              <button
                className="primary-button full-width"
                onClick={handleSubmitFeedback}
                disabled={feedbackRating === 0}
              >
                Submit Feedback
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
