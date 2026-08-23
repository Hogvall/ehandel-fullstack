import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

function Cart() {
  const { cartItems, removeFromCart, updateQuantity } = useCart();

  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (cartItems.length === 0) {
    return (
      <div>
        <h1>Varukorg</h1>
        <p>Din varukorg är tom.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Varukorg</h1>
      <ul>
        {cartItems.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong> – {item.price} kr st
            <br />
            Antal:{' '}
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
            />
            <button onClick={() => removeFromCart(item.id)}>Ta bort</button>
          </li>
        ))}
      </ul>
      <p><strong>Totalt: {total.toFixed(2)} kr</strong></p>
      <p><Link to="/kassa">Gå till kassan</Link></p>
    </div>
  );
}

export default Cart;