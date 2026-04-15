import React from 'react'

// Minimal checkout page with PayPal Smart Buttons integration.
// Assumptions:
// - There is an API POST /api/orders that accepts { items: [{ workflowId, quantity }] } and returns { orderId, accessToken, amount, currency }
// - There is an API POST /api/create-paypal-order { orderId } which returns { url, id } (id = PayPal order id)
// - There is an API POST /api/capture-paypal-order { paypalOrderId } which finalizes payment and marks order paid.

export default function Checkout() {
  const [loading, setLoading] = React.useState(false)
  const [orderId, setOrderId] = React.useState(null)
  const [paypalLoaded, setPaypalLoaded] = React.useState(false)
  const paypalRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    // inject PayPal SDK script
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${(window as any).ENV?.PAYPAL_CLIENT_ID || ''}&currency=USD`
    script.async = true
    script.onload = () => setPaypalLoaded(true)
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  const startCheckout = async () => {
    setLoading(true)
    try {
      // Example: create order with 1 dummy item; in real app, use cart state
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ workflowId: 'example-workflow', quantity: 1 }], currency: 'usd' }) })
      if (!res.ok) throw new Error('create order failed')
      const data = await res.json()
      setOrderId(data.orderId)

      // create paypal order
      const r2 = await fetch('/api/create-paypal-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: data.orderId }) })
      if (!r2.ok) throw new Error('create-paypal-order failed')
      const res2 = await r2.json()
      const paypalOrderId = res2.id

      // render buttons
      if ((window as any).paypal && paypalRef.current) {
        ;(window as any).paypal.Buttons({
          createOrder: (data: any, actions: any) => paypalOrderId,
          onApprove: async (data: any, actions: any) => {
            // capture on server
            const cap = await fetch('/api/capture-paypal-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paypalOrderId: data.orderID }) })
            if (!cap.ok) throw new Error('capture failed')
            const capRes = await cap.json()
            alert('Payment captured! Order: ' + (capRes.orderId || 'unknown'))
          }
        }).render(paypalRef.current)
      }

    } catch (err) {
      console.error(err)
      alert('Checkout failed: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-zinc-900 rounded-lg">
        <h2 className="text-xl mb-4">Checkout</h2>
        <div className="mb-4">
          <button disabled={loading || !paypalLoaded} onClick={startCheckout} className="px-4 py-2 bg-cyan-500 rounded">Start PayPal Checkout</button>
        </div>
        <div ref={paypalRef}></div>
      </div>
    </div>
  )
}
