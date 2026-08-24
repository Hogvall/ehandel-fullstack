import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';

const STATUSES = ['Beställd', 'Behandlas', 'Levererad', 'Återbetald'];

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    fetch(`${API_URL}/api/orders`)
      .then((res) => res.json())
      .then(setOrders)
      .catch((err) => setError(err.message));
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
     const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte uppdatera status');
      }

      loadOrders();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Admin – Ordrar</h1>

      {error && <p style={{ color: 'red' }}>Fel: {error}</p>}

      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Order-id</th>
            <th>Kund</th>
            <th>Totalsumma</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer_name}</td>
              <td>{order.total} kr</td>
              <td>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminOrders;