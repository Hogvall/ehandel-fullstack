import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY_FORM = { sku: '', name: '', description: '', price: '', stock: '' };
const SEARCH_WARNING = 'Produkten sparades, men sökindexet kunde inte uppdateras. Klicka på "Bygg om sökindex" senare.';

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [importing, setImporting] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
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

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  async function handleImport(format) {
    clearMessages();
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
      if (!data.searchIndexed) {
        setNotice('Produkterna sparades, men sökindexet kunde inte uppdateras. Klicka på "Bygg om sökindex" senare.');
      }
      loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  }

  async function handleReindex() {
    clearMessages();
    setReindexing(true);

    try {
      const response = await fetch(`${API_URL}/api/admin/search/reindex`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte bygga om sökindexet');
      }

      if (data.searchIndexed) {
        setNotice('Sökindexet är ombyggt och speglar databasen.');
      } else {
        setError('Sökindexet kunde inte byggas om. Sökningen är troligen inte tillgänglig just nu.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReindexing(false);
    }
  }

  async function handleImageUpload(productId, file) {
    if (!file) return;
    clearMessages();
    setUploadingId(productId);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/api/admin/products/${productId}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bilden kunde inte laddas upp');
      }

      if (data.searchIndexed === false) {
        setNotice('Bilden sparades, men sökindexet kunde inte uppdateras. Klicka på "Bygg om sökindex" senare.');
      } else {
        setNotice('Bilden är uppladdad.');
      }

      loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel');
      }

      if (data.searchIndexed === false) {
        setNotice(SEARCH_WARNING);
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(product) {
    clearMessages();
    setEditingId(product.id);
    setForm({
      sku: product.sku || '',
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id) {
    if (!confirm('Ta bort produkten?')) return;
    clearMessages();

    try {
      const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ta bort produkten');
      }

      if (data.searchIndexed === false) {
        setNotice('Produkten togs bort, men finns kvar i sökningen. Klicka på "Bygg om sökindex" senare.');
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
      {notice && <p className="notice-text">{notice}</p>}

      <h2>Importera från leverantör</h2>
      <div className="form-card">
        <button className="btn" onClick={() => handleImport('csv')} disabled={importing !== null || reindexing}>
          {importing === 'csv' ? 'Importerar...' : 'Importera CSV'}
        </button>
        {' '}
        <button className="btn" onClick={() => handleImport('xml')} disabled={importing !== null || reindexing}>
          {importing === 'xml' ? 'Importerar...' : 'Importera XML'}
        </button>
        {' '}
        <button className="btn btn-secondary" onClick={handleReindex} disabled={importing !== null || reindexing}>
          {reindexing ? 'Bygger om...' : 'Bygg om sökindex'}
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
              <li>Sökindex uppdaterat: {importReport.searchIndexed ? 'Ja' : 'Nej'}</li>
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
        <label>Artikelnummer
          <input name="sku" value={form.sku} onChange={handleChange} required disabled={editingId !== null} />
        </label>
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
        <button type="submit" className="btn">{editingId ? 'Spara ändringar' : 'Lägg till produkt'}</button>
        {editingId && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Avbryt</button>}
      </form>

      <h2>Alla produkter</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Bild</th>
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
              <td>
                {product.image_url ? (
                  <img className="admin-thumb" src={product.image_url} alt={product.name} />
                ) : (
                  <span className="search-meta">Ingen bild</span>
                )}
                <label className="btn btn-secondary btn-small upload-button">
                  {uploadingId === product.id ? 'Laddar upp...' : product.image_url ? 'Byt bild' : 'Ladda upp'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    hidden
                    disabled={uploadingId !== null}
                    onChange={(e) => {
                      handleImageUpload(product.id, e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </td>
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