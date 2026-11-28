export const routes = {
  'GET /v1/shipping-quote': () => ({ shippingFee: 699, carrierHint: 'ground' }),
};

export function dispatch(method, path) {
  const handler = routes[`${method} ${path}`];
  return handler ? { status: 200, body: handler() } : { status: 404 };
}
