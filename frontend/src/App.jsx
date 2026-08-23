import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CartProvider, useCart } from './context/CartContext.jsx';
import ProductList from './pages/ProductList.jsx';
import Cart from './pages/Cart.jsx';
import './App.css';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import AdminOrders from './pages/AdminOrders.jsx';

function Nav() {
  const { cartItems } = useCart();
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav>
      <Link to="/">Produkter</Link>
      {' | '}
      <Link to="/varukorg">Varukorg ({itemCount})</Link>
      {' | '}
      <Link to="/admin/produkter">Admin: Produkter</Link>
      {' | '}
      <Link to="/admin/ordrar">Admin: Ordrar</Link>
    </nav>
  );
}

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/varukorg" element={<Cart />} />
          <Route path="/kassa" element={<Checkout />} />
          <Route path="/orderbekraftelse" element={<OrderConfirmation />} />
          <Route path="/admin/produkter" element={<AdminProducts />} />
          <Route path="/admin/ordrar" element={<AdminOrders />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;