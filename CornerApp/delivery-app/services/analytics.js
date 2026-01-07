// Servicio de analytics básico
class Analytics {
  constructor() {
    this.events = [];
  }

  track(eventName, properties = {}) {
    const event = {
      name: eventName,
      properties,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    console.log('📊 Analytics:', event);
    
    // En producción, aquí enviarías los eventos a un servicio real
    // Ejemplo: Firebase Analytics, Mixpanel, etc.
  }

  trackScreenView(screenName) {
    this.track('screen_view', { screen: screenName });
  }

  trackAddToCart(product) {
    this.track('add_to_cart', {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
    });
  }

  trackPurchase(orderTotal, items) {
    this.track('purchase', {
      total: orderTotal,
      item_count: items.length,
    });
  }

  getEvents() {
    return this.events;
  }

  clearEvents() {
    this.events = [];
  }
}

export default new Analytics();
