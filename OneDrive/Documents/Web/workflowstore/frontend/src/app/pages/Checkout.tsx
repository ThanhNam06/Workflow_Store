import React from 'react'

// Checkout page with PayPal Smart Buttons (server-side order creation)
// Flow:
// 1) POST /api/orders to create a local order
// 2) PayPal Buttons createOrder -> POST /api/create-paypal-order { orderId } -> returns { id }
// 3) onApprove -> POST /api/capture-paypal-order { paypalOrderId }

export default function Checkout() {
  const [loading, setLoading] = React.useState(false)
  const [orderId, setOrderId] = React.useState<string | null>(null)
  const [paypalLoaded, setPaypalLoaded] = React.useState(false)
  const paypalRef = React.useRef<HTMLDivElement | null>(null)
  const buttonsRenderedRef = React.useRef(false)

  React.useEffect(() => {
    // inject PayPal SDK script
    const clientId = (window as any).ENV?.PAYPAL_CLIENT_ID || ''
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`
    script.async = true
    script.onload = () => setPaypalLoaded(true)
    document.body.appendChild(script)
    return () => {
      try { document.body.removeChild(script) } catch (e) { /* ignore */ }
    }
  }, [])

  const startCheckout = async () => {
    setLoading(true)
    try {
      // create a local order (replace with real cart data)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ workflowId: 'example-workflow', quantity: 1 }], currency: 'usd' })
      })
      if (!res.ok) throw new Error('create order failed')
      const data = await res.json()
      setOrderId(data.orderId)

      // Render PayPal Buttons once SDK loaded and orderId available
      if ((window as any).paypal && paypalRef.current && !buttonsRenderedRef.current) {
        ;(window as any).paypal.Buttons({
          createOrder: async (data: any, actions: any) => {
            // create PayPal order server-side for the local order
            const r = await fetch('/api/create-paypal-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderId || data.orderID || data })
            })
            if (!r.ok) throw new Error('create-paypal-order failed')
            const resJson = await r.json()
            return resJson.id
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const cap = await fetch('/api/capture-paypal-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paypalOrderId: data.orderID })
              })
              if (!cap.ok) throw new Error('capture failed')
              const capRes = await cap.json()
              alert('Payment captured! Order: ' + (capRes.orderId || 'unknown'))
            } catch (err: any) {
              console.error(err)
              alert('Capture failed: ' + (err?.message || err))
            }
          },
          onError: (err: any) => {
            console.error('PayPal Buttons error', err)
            alert('PayPal error: ' + (err?.message || err))
          }
        }).render(paypalRef.current)
        buttonsRenderedRef.current = true
      }

    } catch (err: any) {
      console.error(err)
      alert('Checkout failed: ' + (err?.message || err))
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
