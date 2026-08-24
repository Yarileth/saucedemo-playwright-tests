/**
 * Masa de datos de prueba.
 *
 * Todos los valores de este archivo fueron VERIFICADOS contra el sitio real
 * (saucedemo.com) durante el diseño de la suite: mensajes de error exactos,
 * catálogo de productos con sus precios, y la tasa de impuesto aplicada en
 * el checkout. No hay valores asumidos.
 */

/** Usuarios de prueba publicados por el propio sitio en su pantalla de login. */
export const users = {
  /** Usuario "feliz": todos los flujos funcionan correctamente. */
  standard: { username: 'standard_user', password: 'secret_sauce' },
  /** Usuario bloqueado: el login debe rechazarlo con un mensaje específico. */
  lockedOut: { username: 'locked_out_user', password: 'secret_sauce' },
  /** Usuario con defectos inyectados a propósito (imágenes rotas, etc.). */
  problem: { username: 'problem_user', password: 'secret_sauce' },
  /** Usuario con degradación de performance inyectada en el login. */
  performanceGlitch: { username: 'performance_glitch_user', password: 'secret_sauce' },
  /** Usuario con errores inyectados en acciones del carrito/checkout. */
  error: { username: 'error_user', password: 'secret_sauce' },
  /** Usuario con defectos visuales inyectados. */
  visual: { username: 'visual_user', password: 'secret_sauce' },
} as const;

export const invalidCredentials = {
  emptyUsername: { username: '', password: 'secret_sauce' },
  emptyPassword: { username: 'standard_user', password: '' },
  bothEmpty: { username: '', password: '' },
  wrongPassword: { username: 'standard_user', password: 'contraseña_incorrecta' },
  unknownUser: { username: 'usuario_inexistente', password: 'secret_sauce' },
};

/**
 * Mensajes de error exactos del sitio (copiados textualmente del DOM real).
 * Centralizarlos acá evita duplicar strings frágiles en cada spec.
 */
export const errorMessages = {
  usernameRequired: 'Epic sadface: Username is required',
  passwordRequired: 'Epic sadface: Password is required',
  noMatch: 'Epic sadface: Username and password do not match any user in this service',
  lockedOut: 'Epic sadface: Sorry, this user has been locked out.',
  firstNameRequired: 'Error: First Name is required',
  lastNameRequired: 'Error: Last Name is required',
  postalCodeRequired: 'Error: Postal Code is required',
  /** Se muestra al intentar acceder a una URL protegida sin sesión iniciada. */
  protectedRoute: (route: string) =>
    `Epic sadface: You can only access '${route}' when you are logged in.`,
};

/** Catálogo completo de productos, con el slug usado en los `data-test`. */
export const products = [
  { name: 'Sauce Labs Backpack', slug: 'sauce-labs-backpack', price: 29.99, id: 4 },
  { name: 'Sauce Labs Bike Light', slug: 'sauce-labs-bike-light', price: 9.99, id: 0 },
  { name: 'Sauce Labs Bolt T-Shirt', slug: 'sauce-labs-bolt-t-shirt', price: 15.99, id: 1 },
  { name: 'Sauce Labs Fleece Jacket', slug: 'sauce-labs-fleece-jacket', price: 49.99, id: 5 },
  { name: 'Sauce Labs Onesie', slug: 'sauce-labs-onesie', price: 7.99, id: 2 },
  {
    name: 'Test.allTheThings() T-Shirt (Red)',
    slug: 'test.allthethings()-t-shirt-(red)',
    price: 15.99,
    id: 3,
  },
] as const;

export const EXPECTED_PRODUCT_COUNT = products.length;

/**
 * Tasa de impuesto aplicada en el checkout.
 * Verificada en vivo: subtotal $39.98 -> impuesto $3.20 -> total $43.18,
 * es decir 8% redondeado a 2 decimales.
 */
export const TAX_RATE = 0.08;

/** Opciones del combo de ordenamiento (value real del <select>). */
export const sortOptions = {
  nameAsc: 'az',
  nameDesc: 'za',
  priceAsc: 'lohi',
  priceDesc: 'hilo',
} as const;

/** Datos válidos del formulario de checkout (paso 1). */
export const checkoutCustomer = {
  firstName: 'Fox',
  lastName: 'Oropeza',
  postalCode: '1414',
};

/**
 * Datos inválidos para el checkout, siguiendo partición de equivalencia
 * sobre los tres campos obligatorios.
 */
export const invalidCheckoutData = [
  {
    caseName: 'los tres campos vacíos',
    data: { firstName: '', lastName: '', postalCode: '' },
    expectedError: errorMessages.firstNameRequired,
  },
  {
    caseName: 'falta apellido y código postal',
    data: { firstName: 'Fox', lastName: '', postalCode: '' },
    expectedError: errorMessages.lastNameRequired,
  },
  {
    caseName: 'falta solo el código postal',
    data: { firstName: 'Fox', lastName: 'Oropeza', postalCode: '' },
    expectedError: errorMessages.postalCodeRequired,
  },
];

/** Rutas protegidas que exigen sesión iniciada. */
export const protectedRoutes = [
  '/inventory.html',
  '/cart.html',
  '/checkout-step-one.html',
  '/checkout-step-two.html',
  '/checkout-complete.html',
];

/**
 * Techo de regresión para el caso no funcional de performance (TC-09).
 *
 * NO es "lo que debería tardar": `performance_glitch_user` tiene una demora
 * inyectada a propósito de unos 5 segundos, y el test la caracteriza de forma
 * comparativa contra `standard_user`. Este valor es el techo por encima del
 * cual la demora deja de ser la conocida y pasa a ser una regresión real.
 * Holgado a propósito, para no generar falsos positivos por la variabilidad
 * de red de un runner de CI.
 */
export const PERFORMANCE_THRESHOLD_MS = Number(process.env.PERF_THRESHOLD_MS ?? 20_000);
