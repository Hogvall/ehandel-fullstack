import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CartProvider, useCart } from './context/CartContext.jsx';
import ProductList from './pages/ProductList.jsx';
import Cart from './pages/Cart.jsx';
import './App.css';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import AdminOrders from './pages/AdminOrders.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { useAuth } from './context/AuthContext.jsx';

function Nav() {
  const { cartItems } = useCart();
  const { user, logout } = useAuth();
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">E-handel</Link>
      <div className="nav-links">
        <Link to="/">Produkter</Link>
        <Link to="/varukorg">Varukorg <span className="nav-cart-count">{itemCount}</span></Link>
        {user?.role === 'admin' && (
          <>
            <Link to="/admin/produkter">Admin: Produkter</Link>
            <Link to="/admin/ordrar">Admin: Ordrar</Link>
          </>
        )}
        {user ? (
          <>
            <span>{user.name}</span>
            <button className="btn btn-secondary btn-small" onClick={logout}>Logga ut</button>
          </>
        ) : (
          <Link to="/logga-in">Logga in</Link>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Nav />
          <div className="app-shell">
            <Routes>
              <Route path="/" element={<ProductList />} />
              <Route path="/varukorg" element={<Cart />} />
              <Route path="/kassa" element={<Checkout />} />
              <Route path="/orderbekraftelse" element={<OrderConfirmation />} />
              <Route path="/admin/produkter" element={<AdminProducts />} />
              <Route path="/admin/ordrar" element={<AdminOrders />} />
              <Route path="/logga-in" element={<Login />} />
              <Route path="/registrera" element={<Register />} />
            </Routes>
          </div>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;