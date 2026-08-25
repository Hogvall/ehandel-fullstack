import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { API_URL } from '../config.js';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToCart } = useCart();


  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Nätverksfel: ' + response.status);
        }
        return response.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Laddar produkter...</p>;
  if (error) return <p>Något gick fel: {error}</p>;

  return (
    <div>
      <h1>Våra produkter</h1>
      {products.length === 0 ? (
        <p className="empty-state">Inga produkter hittades.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <div className="product-card" key={product.id}>
              <img src={product.image_url || 'https://picsum.photos/seed/' + product.id + '/400/300'} alt={product.name} />
              <div className="product-card-body">
                <span className="product-name">{product.name}</span>
                <span className="product-desc">{product.description}</span>
                <span className="product-price">{product.price} kr</span>
                <button className="btn" onClick={() => addToCart(product)}>Lägg i varukorg</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductList;