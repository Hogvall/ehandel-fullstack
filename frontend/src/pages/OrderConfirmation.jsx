import { useLocation, Link } from 'react-router-dom';

function OrderConfirmation() {
  const location = useLocation();
  const { orderId, total } = location.state || {};

  if (!orderId) {
    return (
      <div>
        <h1>Ingen order hittades</h1>
        <Link to="/">Till startsidan</Link>
      </div>
    );
  }

  return (
    <div className="confirmation">
      <h1>Tack för din beställning</h1>
      <p>Ordernummer: {orderId}</p>
      <p className="total-line">{total.toFixed(2)} kr</p>
      <Link to="/" className="btn">Fortsätt handla</Link>
    </div>
  );
}

export default OrderConfirmation;