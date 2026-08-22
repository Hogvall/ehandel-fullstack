import { useState, useEffect } from 'react';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/products')
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
        <p>Inga produkter hittades.</p>
      ) : (
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <strong>{product.name}</strong> – {product.price} kr
              <br />
              {product.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductList;