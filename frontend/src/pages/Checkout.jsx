import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL } from '../config.js';

const POSTAL_CODE_PATTERN = /^\d{3} ?\d{2}$/;

function formatDelivery(estimate) {
  if (!estimate) return 'Leveranstid kunde inte hämtas';
  if (estimate.date) {
    const date = new Date(`${estimate.date}T12:00:00`);
    const weekday = date.toLocaleDateString('sv-SE', { weekday: 'long' });
    return `Beräknad leverans: ${weekday} ${date.getDate()}/${date.getMonth() + 1}`;
  }
  return `Beräknad leverans: ${estimate.daysMin}–${estimate.daysMax} dagar`;
}

function Checkout() {
  const { cartItems } = useCart();
  const { user, token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [shippingMethod, setShippingMethod] = useState('service_point');
  const [servicePointId, setServicePointId] = useState('');

  const [delivery, setDelivery] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: '',
    postalCode: '',
    city: '',
  });

  const postalCodeIsValid = POSTAL_CODE_PATTERN.test(delivery.postalCode.trim());
  const orderItemsJson = JSON.stringify(cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })));

  useEffect(() => {
    const orderItems = JSON.parse(orderItemsJson);
    if (!postalCodeIsValid || orderItems.length === 0) return;

    const controller = new AbortController();

    fetch(`${API_URL}/api/shipping/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ items: orderItems, postalCode: delivery.postalCode.trim() }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Kunde inte hämta fraktalternativ');
        return data;
      })
      .then((data) => {
        setQuote(data);
        setQuoteError(null);
        setServicePointId(data.servicePoints?.[0]?.id ?? '');
        if (!data.servicePoints?.length) setShippingMethod('home');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setQuote(null);
        setQuoteError(err.message);
      });

    return () => controller.abort();
  }, [delivery.postalCode, postalCodeIsValid, orderItemsJson]);

  function handleChange(e) {
    setDelivery({ ...delivery, [e.target.name]: e.target.value });
  }

  const activeQuote = postalCodeIsValid ? quote : null;
  const selectedOption = activeQuote?.options.find((option) => option.method === shippingMethod);
  const estimatedSubtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  async function handleConfirm(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
          delivery,
          shipping: {
            method: shippingMethod,
            servicePointId: shippingMethod === 'service_point' ? servicePointId : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel');
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div>
        <h1>Kassa</h1>
        <p className="empty-state">
          Du behöver <Link to="/logga-in">logga in</Link> för att handla.
        </p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div>
        <h1>Kassa</h1>
        <p className="empty-state">Din varukorg är tom.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Kassa</h1>
      <ul className="checkout-list">
        {cartItems.map((item) => (
          <li className="cart-item" key={item.id}>
            <div className="cart-item-main">
              <img
                className="cart-item-thumb"
                src={item.image_url || 'https://picsum.photos/seed/' + item.id + '/100/100'}
                alt={item.name}
              />
              <span>{item.name} × {item.quantity}</span>
            </div>
            <span>{(Number(item.price) * item.quantity).toFixed(2)} kr</span>
          </li>
        ))}
      </ul>

      <form className="form-card" onSubmit={handleConfirm}>
        <label>Namn
          <input name="name" value={delivery.name} onChange={handleChange} required />
        </label>
        <label>E-post
          <input type="email" name="email" value={delivery.email} onChange={handleChange} required />
        </label>
        <label>Adress
          <input name="address" value={delivery.address} onChange={handleChange} required />
        </label>
        <label>Postnummer
          <input name="postalCode" value={delivery.postalCode} onChange={handleChange} inputMode="numeric" required />
        </label>
        <label>Ort
          <input name="city" value={delivery.city} onChange={handleChange} required />
        </label>

        <h2>Frakt</h2>
        {!postalCodeIsValid && <p className="search-meta">Fyll i ditt postnummer för att se fraktalternativ.</p>}
        {postalCodeIsValid && quoteError && <p className="error-text">{quoteError}</p>}
        {postalCodeIsValid && !activeQuote && !quoteError && <p>Hämtar fraktalternativ...</p>}

        {activeQuote && (
          <div className="shipping-options">
            {activeQuote.options.map((option) => (
              <label key={option.method} className="shipping-option">
                <input
                  type="radio"
                  name="shippingMethod"
                  value={option.method}
                  checked={shippingMethod === option.method}
                  onChange={() => setShippingMethod(option.method)}
                  disabled={option.method === 'service_point' && !activeQuote.servicePoints?.length}
                />
                <span>
                  <strong>{option.label}</strong> – {option.price === 0 ? 'Fri frakt' : `${option.price} kr`}
                  <br />
                  <span className="search-meta">{formatDelivery(option.estimatedDelivery)}</span>
                </span>
              </label>
            ))}

            {activeQuote.subtotal < activeQuote.freeShippingLimit && (
              <p className="search-meta">Fri frakt när du handlar för minst {activeQuote.freeShippingLimit} kr.</p>
            )}

            {shippingMethod === 'service_point' && activeQuote.servicePoints?.length > 0 && (
              <label>Välj ombud
                <select value={servicePointId} onChange={(e) => setServicePointId(e.target.value)} required>
                  {activeQuote.servicePoints.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.name}, {point.address}, {point.city}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {activeQuote.servicePoints === null && (
              <p className="notice-text">Ombud kunde inte hämtas från PostNord just nu. Du kan välja hemleverans.</p>
            )}
          </div>
        )}

        <p className="total-line">
          Varor: {estimatedSubtotal.toFixed(2)} kr
          {selectedOption && (
            <>
              <br />
              Frakt: {selectedOption.price.toFixed(2)} kr
              <br />
              Att betala: {(activeQuote.subtotal + selectedOption.price).toFixed(2)} kr
            </>
          )}
        </p>

        {error && <p className="error-text">Fel: {error}</p>}

        <button type="submit" className="btn" disabled={submitting || !selectedOption}>
          {submitting ? 'Skickar till betalning...' : 'Gå till betalning'}
        </button>
      </form>
    </div>
  );
}

export default Checkout;