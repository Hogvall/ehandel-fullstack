import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CartProvider, useCart } from './context/CartContext.jsx';
import ProductList from './pages/ProductList.jsx';
import Cart from './pages/Cart.jsx';
import './App.css';

function Nav() {
  const { cartItems } = useCart();
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav>
      <Link to="/">Produkter</Link>
      {' | '}
      <Link to="/varukorg">Varukorg ({itemCount})</Link>
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
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;