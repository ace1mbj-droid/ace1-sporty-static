export function simulateStripeCheckout(cart) {
  // Simulate Stripe checkout in test mode — return a promise like Stripe.
  // This is purely client-side and only meant for demos.
  return new Promise((resolve, reject) => {
    // Validate cart
    if(!cart || cart.length === 0){
      return reject(new Error('Cart empty'));
    }
    // Fake processing delay, then succeed
    setTimeout(() => {
      resolve({ status: 'success', sessionId: 'mock_session_' + Date.now() });
    }, 1200);
  });
}
