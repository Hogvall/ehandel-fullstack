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
        <p className="empty-state">Din varukorg är tom.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Varukorg</h1>
      <ul className="cart-list">
        {cartItems.map((item) => (
<li className="cart-item" key={item.id}>
  <div className="cart-item-main">
    <img
      className="cart-item-thumb"
      src={item.image_url || 'https://picsum.photos/seed/' + item.id + '/100/100'}
      alt={item.name}
    />
    <div>
      <strong>{item.name}</strong> – {item.price} kr st
    </div>
  </div>
  <div>
    <input
      type="number"
      min="1"
      value={item.quantity}
      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
    />
    <button className="btn btn-danger btn-small" onClick={() => removeFromCart(item.id)}>Ta bort</button>
  </div>
</li>
        ))}
      </ul>
      <p className="total-line">Totalt: {total.toFixed(2)} kr</p>
      <Link to="/kassa" className="btn">Gå till kassan</Link>
    </div>
  );
}

export default Cart;