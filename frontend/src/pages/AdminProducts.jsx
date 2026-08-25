import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';

const EMPTY_FORM = { name: '', description: '', price: '', stock: '', image_url: '' };

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  function loadProducts() {
       fetch(`${API_URL}/api/products`)
      .then((res) => res.json())
      .then(setProducts)
      .catch((err) => setError(err.message));
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const url = editingId
     ? `${API_URL}/api/products/${editingId}`
     : `${API_URL}/api/products`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Något gick fel');
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      image_url: product.image_url || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id) {
    if (!confirm('Ta bort produkten?')) return;

    try {
        const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte ta bort produkten');
      }

      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Admin – Produkter</h1>

      {error && <p className="error-text">Fel: {error}</p>}

      <h2>{editingId ? 'Redigera produkt' : 'Ny produkt'}</h2>
      <form className="form-card" onSubmit={handleSubmit}>
        <label>Namn
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>Beskrivning
          <input name="description" value={form.description} onChange={handleChange} />
        </label>
        <label>Pris (kr)
          <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
        </label>
        <label>Lager
          <input name="stock" type="number" value={form.stock} onChange={handleChange} required />
        </label>
        <label>Bild-URL
          <input name="image_url" value={form.image_url} onChange={handleChange} />
        </label>
        <button type="submit" className="btn">{editingId ? 'Spara ändringar' : 'Lägg till produkt'}</button>
        {editingId && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Avbryt</button>}
      </form>

      <h2>Alla produkter</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Namn</th>
            <th>Pris</th>
            <th>Lager</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.price} kr</td>
              <td>{product.stock}</td>
              <td>
                <button className="btn btn-secondary btn-small" onClick={() => startEdit(product)}>Redigera</button>
                {' '}
                <button className="btn btn-danger btn-small" onClick={() => handleDelete(product.id)}>Ta bort</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminProducts;