import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { API_URL } from '../config.js';

const PAGE_SIZE = 12;

function ProductList() {
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    fetch(`${API_URL}/api/search/categories`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      q: query,
      sort,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (category) params.set('category', category);
    if (inStock) params.set('inStock', 'true');

    setLoading(true);
    setError(null);

    fetch(`${API_URL}/api/search?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Sökningen misslyckades');
        }
        return data;
      })
      .then((data) => {
        setProducts(data.data);
        setMeta(data.meta);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [query, category, inStock, sort, page]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setQuery(searchText.trim());
  }

  function handleCategoryChange(e) {
    setCategory(e.target.value);
    setPage(1);
  }

  function handleSortChange(e) {
    setSort(e.target.value);
    setPage(1);
  }

  function handleInStockChange(e) {
    setInStock(e.target.checked);
    setPage(1);
  }

  return (
    <div>
      <h1>Våra produkter</h1>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Sök produkter..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          maxLength={100}
        />
        <button type="submit" className="btn">Sök</button>

        <select value={category} onChange={handleCategoryChange}>
          <option value="">Alla kategorier</option>
          {categories.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select value={sort} onChange={handleSortChange}>
          <option value="relevance">Relevans</option>
          <option value="price_asc">Pris: lägst först</option>
          <option value="price_desc">Pris: högst först</option>
        </select>

        <label>
          <input type="checkbox" checked={inStock} onChange={handleInStockChange} /> Endast i lager
        </label>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading && <p>Laddar produkter...</p>}

      {!loading && !error && meta && (
        <>
          <p className="search-meta">
            {meta.total} {meta.total === 1 ? 'träff' : 'träffar'}
          </p>

          {products.length === 0 ? (
            <p className="empty-state">Inga produkter hittades.</p>
          ) : (
            <div className="product-grid">
              {products.map((product) => (
                <div className="product-card" key={product.id}>
                  <img
                    src={product.image_url || 'https://picsum.photos/seed/' + product.id + '/400/300'}
                    alt={product.name}
                  />
                  <div className="product-card-body">
                    <span className="product-name">{product.name}</span>
                    <span className="product-desc">{product.category}</span>
                    <span className="product-price">{product.price} kr</span>
                    <button className="btn" onClick={() => addToCart(product)} disabled={product.stock === 0}>
                      {product.stock === 0 ? 'Slut i lager' : 'Lägg i varukorg'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta.totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Föregående
              </button>
              <span>Sida {meta.page} av {meta.totalPages}</span>
              <button
                className="btn btn-secondary"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Nästa
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProductList;