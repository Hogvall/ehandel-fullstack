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
    <div>
      <h1>Tack för din beställning!</h1>
      <p>Ordernummer: {orderId}</p>
      <p>Totalsumma: {total.toFixed(2)} kr</p>
      <Link to="/">Fortsätt handla</Link>
    </div>
  );
}

export default OrderConfirmation;