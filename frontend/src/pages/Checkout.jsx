import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { API_URL } from '../config.js';

function Checkout() {
  const { cartItems, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Något gick fel');
      }

      const data = await response.json();
      clearCart();
      navigate('/orderbekraftelse', { state: { orderId: data.orderId, total: data.total } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
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
  <span>{(item.price * item.quantity).toFixed(2)} kr</span>
</li>
        ))}
      </ul>
      <p className="total-line">Totalt: {total.toFixed(2)} kr</p>

      {error && <p className="error-text">Fel: {error}</p>}

      <button className="btn" onClick={handleConfirm} disabled={submitting}>
        {submitting ? 'Bearbetar...' : 'Betala'}
      </button>
    </div>
  );
}

export default Checkout;