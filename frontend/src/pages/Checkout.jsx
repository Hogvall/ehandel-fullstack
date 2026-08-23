import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

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
      const response = await fetch('http://localhost:3000/api/orders', {
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
        <p>Din varukorg är tom.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Kassa</h1>
      <ul>
        {cartItems.map((item) => (
          <li key={item.id}>
            {item.name} × {item.quantity} = {(item.price * item.quantity).toFixed(2)} kr
          </li>
        ))}
      </ul>
      <p><strong>Totalt: {total.toFixed(2)} kr</strong></p>

      {error && <p style={{ color: 'red' }}>Fel: {error}</p>}

      <button onClick={handleConfirm} disabled={submitting}>
        {submitting ? 'Bearbetar...' : 'Betala (simulerad betalning)'}
      </button>
    </div>
  );
}

export default Checkout;