import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL } from '../config.js';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

const STATUS_TEXT = {
  Obetald: 'Väntar på betalning',
  Betald: 'Betald',
  Avbruten: 'Avbruten',
};

function OrderConfirmation() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const cancelledByCustomer = searchParams.get('avbruten') === '1';
  const { token, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (authLoading || !token) return;

    let active = true;
    let attempts = 0;
    let timerId;

    async function loadOrder() {
      try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Kunde inte hämta ordern');
        }

        if (!active) return;

        setOrder(data);
        attempts += 1;

        const keepPolling = data.payment_status === 'Obetald' && !cancelledByCustomer && attempts < MAX_ATTEMPTS;
        setPolling(keepPolling);

        if (keepPolling) {
          timerId = setTimeout(loadOrder, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setPolling(false);
        }
      }
    }

    loadOrder();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [orderId, token, authLoading, cancelledByCustomer]);

  if (!authLoading && !token) {
    return (
      <div className="confirmation">
        <h1>Logga in</h1>
        <p>Du behöver <Link to="/logga-in">logga in</Link> för att se din order.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="confirmation">
        <h1>Ordern kunde inte visas</h1>
        <p className="error-text">{error}</p>
        <Link to="/" className="btn">Till startsidan</Link>
      </div>
    );
  }

  if (!order) {
    return <p>Hämtar order...</p>;
  }

  return (
    <div className="confirmation">
      <h1>{order.payment_status === 'Betald' ? 'Tack för din beställning' : `Order ${order.id}`}</h1>
      <p>Ordernummer: {order.id}</p>
      <p>Betalning: <strong>{STATUS_TEXT[order.payment_status]}</strong></p>

      {cancelledByCustomer && order.payment_status === 'Obetald' && (
        <p className="notice-text">Betalningen avbröts. Ordern är inte betald.</p>
      )}
      {polling && <p>Väntar på bekräftelse från betalningen...</p>}
      {!polling && order.payment_status === 'Obetald' && !cancelledByCustomer && (
        <p className="notice-text">Vi har inte fått någon bekräftelse än. Ladda om sidan om en stund.</p>
      )}

      <ul className="checkout-list">
        {order.items.map((item) => (
          <li className="cart-item" key={item.name}>
            <span>{item.name} × {item.quantity}</span>
            <span>{(Number(item.price_at_purchase) * item.quantity).toFixed(2)} kr</span>
          </li>
        ))}
      </ul>
      <p className="total-line">Totalt: {Number(order.total).toFixed(2)} kr</p>

      <Link to="/" className="btn">Fortsätt handla</Link>
    </div>
  );
}

export default OrderConfirmation;