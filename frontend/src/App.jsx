import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ProductList from './pages/ProductList.jsx';
import Cart from './pages/Cart.jsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Produkter</Link>
        {' | '}
        <Link to="/varukorg">Varukorg</Link>
      </nav>

      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/varukorg" element={<Cart />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;