export const routes = {
  'GET /v1/shipping-estimate': () => ({ shippingCents: 699 }),
  'GET /v1/shipping-quote': () => ({ shippingCents: 699 }),
};

export function dispatch(method, path) {
  const handler = routes[`${method} ${path}`];
  return handler ? { status: 200, body: handler() } : { status: 404 };
}
