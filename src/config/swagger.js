const swaggerJsdoc = require('swagger-jsdoc');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Uniblox Assignment API',
      version: '1.0.0',
      description: 'Starter Express backend API documentation',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and JWT identity endpoints',
      },
      {
        name: 'Health',
        description: 'Application health checks',
      },
      {
        name: 'Users',
        description: 'Basic user management',
      },
      {
        name: 'Products',
        description: 'Product catalog and inventory (authenticated reads, permission-protected writes)',
      },
      {
        name: 'Carts',
        description: 'Customer carts. Live prices; inventory is not reserved until checkout.',
      },
      {
        name: 'Orders',
        description: 'Checkout and immutable order receipts.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'customer@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'customer123',
            },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'usr_customer_demo',
            },
            name: {
              type: 'string',
              example: 'Demo Customer',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'customer@example.com',
            },
            role: {
              type: 'string',
              enum: ['customer', 'admin'],
              example: 'customer',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            tokenType: {
              type: 'string',
              example: 'Bearer',
            },
            expiresIn: {
              type: 'string',
              example: '1h',
            },
            user: {
              $ref: '#/components/schemas/AuthUser',
            },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: {
              type: 'string',
              example: 'Jane Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane@example.com',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '1',
            },
            name: {
              type: 'string',
              example: 'Jane Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane@example.com',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'ValidationError',
            },
            message: {
              type: 'string',
              example: 'Name and email are required',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '1',
            },
            name: {
              type: 'string',
              example: 'Classic Ceramic Mug',
            },
            unitPriceCents: {
              type: 'integer',
              example: 1299,
            },
            availableInventory: {
              type: 'integer',
              example: 500,
            },
            metadata: {
              type: 'object',
              example: { category: 'drinkware', color: 'white' },
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['name', 'unitPriceCents', 'availableInventory'],
          properties: {
            name: {
              type: 'string',
              example: 'Classic Ceramic Mug',
            },
            unitPriceCents: {
              type: 'integer',
              minimum: 0,
              example: 1299,
            },
            availableInventory: {
              type: 'integer',
              minimum: 0,
              example: 500,
            },
            metadata: {
              type: 'object',
              example: { category: 'drinkware', color: 'white' },
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        UpdateProductRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Classic Ceramic Mug',
            },
            unitPriceCents: {
              type: 'integer',
              minimum: 0,
              example: 1399,
            },
            availableInventory: {
              type: 'integer',
              minimum: 0,
              example: 480,
            },
            metadata: {
              type: 'object',
              example: { category: 'drinkware', color: 'blue' },
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        InventoryAdjustmentRequest: {
          type: 'object',
          required: ['delta'],
          properties: {
            delta: {
              type: 'integer',
              description: 'Non-zero integer to add (positive) or remove (negative) from inventory',
              example: 50,
            },
          },
        },
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '1' },
            name: { type: 'string', example: 'Classic Ceramic Mug' },
            quantity: { type: 'integer', example: 2 },
            unitPriceCents: { type: 'integer', example: 1299 },
            lineTotalCents: { type: 'integer', example: 2598 },
            availableInventory: { type: 'integer', example: 500 },
            isActive: { type: 'boolean', example: true },
          },
        },
        Cart: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            customerId: { type: 'string', example: 'usr_customer_demo' },
            status: { type: 'string', enum: ['open', 'checked_out'], example: 'open' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/CartItem' },
            },
            subtotalCents: { type: 'integer', example: 2598 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AddCartItemRequest: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', example: '1' },
            quantity: { type: 'integer', minimum: 1, example: 2 },
          },
        },
        UpdateCartItemRequest: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'integer', minimum: 1, example: 3 },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '1' },
            productName: { type: 'string', example: 'Classic Ceramic Mug' },
            quantity: { type: 'integer', example: 2 },
            unitPriceCents: { type: 'integer', example: 1299 },
            lineTotalCents: { type: 'integer', example: 2598 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            customerId: { type: 'string', example: 'usr_customer_demo' },
            cartId: { type: 'string', example: '1' },
            status: { type: 'string', enum: ['confirmed'], example: 'confirmed' },
            subtotalCents: { type: 'integer', example: 2598 },
            discountCents: { type: 'integer', example: 0 },
            totalCents: { type: 'integer', example: 2598 },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      '/': {
        get: {
          summary: 'API welcome endpoint',
          tags: ['Health'],
          responses: {
            200: {
              description: 'Welcome response',
            },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Check API health',
          tags: ['Health'],
          responses: {
            200: {
              description: 'API is healthy',
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Authenticate and receive a JWT',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginRequest',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Authentication succeeded',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/LoginResponse',
                  },
                },
              },
            },
            400: {
              description: 'Missing email or password',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          summary: 'Return the authenticated JWT subject',
          tags: ['Auth'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            200: {
              description: 'Authenticated token payload',
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/users': {
        post: {
          summary: 'Create a user',
          tags: ['Users'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateUserRequest',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User',
                  },
                },
              },
            },
            400: {
              description: 'Invalid request body',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          summary: 'Get a user by ID',
          tags: ['Users'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              example: '1',
            },
          ],
          responses: {
            200: {
              description: 'User found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User',
                  },
                },
              },
            },
            404: {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/products': {
        get: {
          summary: 'List active products (authenticated)',
          tags: ['Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            200: {
              description: 'List of active products',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      products: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Product',
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create a product (admin only)',
          tags: ['Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateProductRequest',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Product created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      product: {
                        $ref: '#/components/schemas/Product',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid request body',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            403: {
              description: 'Missing required permissions: product:write and inventory:adjust',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/products/{id}': {
        get: {
          summary: 'Get a product by ID (authenticated)',
          tags: ['Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              example: '1',
            },
          ],
          responses: {
            200: {
              description: 'Product found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      product: {
                        $ref: '#/components/schemas/Product',
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            404: {
              description: 'Product not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
        patch: {
          summary: 'Update a product (permission protected)',
          tags: ['Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              example: '1',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateProductRequest',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Product updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      product: {
                        $ref: '#/components/schemas/Product',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid request body',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            403: {
              description: 'Missing required permissions: product:write, plus inventory:adjust when replacing stock',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            404: {
              description: 'Product not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/products/{id}/inventory-adjustments': {
        post: {
          summary: 'Adjust product inventory (permission protected)',
          tags: ['Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
              example: '1',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InventoryAdjustmentRequest',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Inventory adjusted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      product: {
                        $ref: '#/components/schemas/Product',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid delta or would make inventory negative',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            403: {
              description: 'Missing required permission: inventory:adjust',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            404: {
              description: 'Product not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/carts': {
        post: {
          summary: 'Create or return the authenticated customer open cart',
          tags: ['Carts'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Existing open cart returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            201: {
              description: 'Open cart created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Missing required permission: cart:manage',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/carts/{id}': {
        get: {
          summary: 'Get a cart with live product prices (owner only)',
          tags: ['Carts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
          ],
          responses: {
            200: {
              description: 'Cart found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Caller does not own the cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Cart not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/carts/{id}/items': {
        post: {
          summary: 'Add a product quantity to an open cart',
          tags: ['Carts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddCartItemRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Item added',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid product or quantity',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Caller does not own the cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Cart not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'Cart is already checked out',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/carts/{id}/items/{productId}': {
        patch: {
          summary: 'Set a cart line quantity',
          tags: ['Carts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
            {
              name: 'productId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCartItemRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Quantity updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid quantity or unavailable product',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Caller does not own the cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Cart or cart item not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'Cart is already checked out',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
        delete: {
          summary: 'Remove a product from an open cart',
          tags: ['Carts'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
            {
              name: 'productId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
          ],
          responses: {
            200: {
              description: 'Item removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cart: { $ref: '#/components/schemas/Cart' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Caller does not own the cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Cart or cart item not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'Cart is already checked out',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/carts/{id}/checkout': {
        post: {
          summary: 'Checkout an open cart',
          tags: ['Orders'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
            {
              name: 'Idempotency-Key',
              in: 'header',
              required: true,
              schema: { type: 'string', maxLength: 128 },
              example: 'checkout-2026-09-06-001',
            },
          ],
          responses: {
            200: {
              description: 'Idempotent replay; existing order returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      order: { $ref: '#/components/schemas/Order' },
                      replayed: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
            201: {
              description: 'Order created and inventory decremented',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      order: { $ref: '#/components/schemas/Order' },
                      replayed: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid request, empty cart, or unsupported coupon code',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Missing order:create permission or caller does not own the cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Cart not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'Cart already checked out, idempotency conflict, unavailable product, or insufficient inventory',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/orders': {
        get: {
          summary: 'List orders',
          tags: ['Orders'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: 'offset',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
          ],
          responses: {
            200: {
              description: 'Orders visible to the authenticated caller',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      orders: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Order' },
                      },
                      pagination: { type: 'object' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid pagination',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Missing order read permission',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/orders/{id}': {
        get: {
          summary: 'Get an immutable order receipt',
          tags: ['Orders'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: '1',
            },
          ],
          responses: {
            200: {
              description: 'Order found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      order: { $ref: '#/components/schemas/Order' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            403: {
              description: 'Caller does not own the order and lacks order:read:any',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            404: {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
});

module.exports = swaggerSpec;
