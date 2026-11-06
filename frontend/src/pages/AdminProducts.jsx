import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY_FORM = { name: '', description: '', price: '', stock: '', image_url: '' };

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    loadProducts();
  }, []);

  function loadProducts() {
    fetch(`${API_URL}/api/products`)
      .then((res) => res.json())
      .then(setProducts)
      .catch((err) => setError(err.message));
  }

  async function handleImport(format) {
    setError(null);
    setImportReport(null);
    setImporting(format);

    try {
      const response = await fetch(`${API_URL}/api/admin/products/import/${format}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Importen misslyckades');
      }

      setImportReport(data);
      loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const url = editingId ? `${API_URL}/api/products/${editingId}` : `${API_URL}/api/products`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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

      <h2>Importera från leverantör</h2>
      <div className="form-card">
        <button className="btn" onClick={() => handleImport('csv')} disabled={importing !== null}>
          {importing === 'csv' ? 'Importerar...' : 'Importera CSV'}
        </button>
        {' '}
        <button className="btn" onClick={() => handleImport('xml')} disabled={importing !== null}>
          {importing === 'xml' ? 'Importerar...' : 'Importera XML'}
        </button>

        {importReport && (
          <div>
            <p>
              Import från {importReport.format.toUpperCase()}: {importReport.total} produkter i filen
            </p>
            <ul>
              <li>Nya: {importReport.created}</li>
              <li>Uppdaterade: {importReport.updated}</li>
              <li>Överhoppade: {importReport.skipped.length}</li>
            </ul>

            {importReport.skipped.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artikelnummer</th>
                    <th>Orsak</th>
                  </tr>
                </thead>
                <tbody>
                  {importReport.skipped.map((item) => (
                    <tr key={item.sku}>
                      <td>{item.sku}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

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
            <th>Artikelnr</th>
            <th>Namn</th>
            <th>Pris</th>
            <th>Lager</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.sku || '–'}</td>
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