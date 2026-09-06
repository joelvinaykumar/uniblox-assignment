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
      {
        name: 'Coupons',
        description: 'Admin-managed rewards and customer coupon discovery.',
      },
      {
        name: 'Reports',
        description: 'Read-only administrative business summaries.',
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
              format: 'uuid',
              example: '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f',
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
            productId: { type: 'string', format: 'uuid', example: '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f' },
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
            productId: { type: 'string', format: 'uuid', example: '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f' },
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
            productId: { type: 'string', format: 'uuid', example: '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f' },
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
            couponId: { type: 'string', format: 'uuid', nullable: true },
            couponCode: { type: 'string', nullable: true, example: 'CPN-A1B2C3D4' },
            couponDiscountPercent: { type: 'integer', nullable: true, example: 10 },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CheckoutRequest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            couponCode: {
              type: 'string',
              nullable: true,
              minLength: 1,
              maxLength: 128,
              pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$',
              description: 'Optional issued coupon. Omit it to check out without a discount.',
              example: 'CPN-A1B2C3D4',
            },
          },
        },
        CouponConfig: {
          type: 'object',
          properties: {
            n: { type: 'integer', minimum: 1, example: 5 },
            x: { type: 'integer', minimum: 1, maximum: 100, example: 10 },
            version: { type: 'string', example: '1' },
            confirmedOrders: { type: 'string', example: '12' },
            earnedMilestones: { type: 'string', example: '2' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UpdateCouponConfigRequest: {
          type: 'object',
          additionalProperties: false,
          required: ['n', 'x', 'version'],
          properties: {
            n: { type: 'integer', minimum: 1, example: 5 },
            x: { type: 'integer', minimum: 1, maximum: 100, example: 10 },
            version: { type: 'string', example: '1' },
          },
        },
        CouponMilestone: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            n: { type: 'integer', example: 5 },
            discountPercent: { type: 'integer', example: 10 },
            configVersion: { type: 'string', example: '1' },
            earnedAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['eligible'] },
          },
        },
        Coupon: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            milestoneId: { type: 'string', example: '1' },
            code: { type: 'string', example: 'CPN-A1B2C3D4' },
            discountPercent: { type: 'integer', example: 10 },
            status: { type: 'string', enum: ['issued', 'redeemed'] },
            issuedAt: { type: 'string', format: 'date-time' },
            redeemedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        ProductPurchaseSummary: {
          type: 'object',
          properties: {
            productId: { type: 'string', format: 'uuid' },
            productName: { type: 'string', example: 'Classic Ceramic Mug' },
            purchasedQuantity: { type: 'string', pattern: '^\\d+$', example: '3' },
          },
        },
        AdminReport: {
          type: 'object',
          properties: {
            purchasedQuantityByProduct: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProductPurchaseSummary' },
            },
            grossRevenueCents: { type: 'string', pattern: '^\\d+$', example: '3897' },
            totalDiscountsCents: { type: 'string', pattern: '^\\d+$', example: '389' },
            netRevenueCents: { type: 'string', pattern: '^\\d+$', example: '3508' },
            couponsGenerated: { type: 'string', pattern: '^\\d+$', example: '2' },
            couponsAvailable: { type: 'string', pattern: '^\\d+$', example: '1' },
            couponsRedeemed: { type: 'string', pattern: '^\\d+$', example: '1' },
            totalOrders: { type: 'string', pattern: '^\\d+$', example: '2' },
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
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckoutRequest' },
              },
            },
          },
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
              description: 'Invalid request, coupon format, or empty cart',
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
              description: 'Cart or coupon not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            409: {
              description: 'Cart checked out, coupon redeemed, idempotency conflict, unavailable product, or insufficient inventory',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/admin/coupon-config': {
        get: {
          summary: 'Read coupon reward configuration (admin only)',
          tags: ['Coupons'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Current configuration and reconciled historical reward totals',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { config: { $ref: '#/components/schemas/CouponConfig' } },
                  },
                },
              },
            },
            401: { description: 'Missing, invalid, or expired token' },
            403: { description: 'Missing coupon:config:read permission' },
          },
        },
        put: {
          summary: 'Update N/X and immediately reconcile rewards (admin only)',
          tags: ['Coupons'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCouponConfigRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Configuration updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { config: { $ref: '#/components/schemas/CouponConfig' } },
                  },
                },
              },
            },
            400: { description: 'Invalid N, X, or version' },
            401: { description: 'Missing, invalid, or expired token' },
            403: { description: 'Missing coupon:config:write permission' },
            409: { description: 'Stale configuration version' },
          },
        },
      },
      '/api/admin/coupon-milestones': {
        get: {
          summary: 'List eligible, unissued reward milestones (admin only)',
          tags: ['Coupons'],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['eligible'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: {
              description: 'Eligible milestones',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      milestones: { type: 'array', items: { $ref: '#/components/schemas/CouponMilestone' } },
                      pagination: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: { description: 'Missing, invalid, or expired token' },
            403: { description: 'Missing coupon:generate permission' },
          },
        },
      },
      '/api/admin/coupons': {
        post: {
          summary: 'Generate a coupon for an eligible milestone (admin only)',
          tags: ['Coupons'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['milestoneId'],
                  properties: { milestoneId: { type: 'string', example: '1' } },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Generation replay; existing coupon returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      coupon: { $ref: '#/components/schemas/Coupon' },
                      replayed: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
            201: {
              description: 'Coupon generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      coupon: { $ref: '#/components/schemas/Coupon' },
                      replayed: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid milestone ID',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
              },
            },
            401: { description: 'Missing, invalid, or expired token' },
            403: { description: 'Missing coupon:generate permission' },
            404: {
              description: 'Eligible milestone not found',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
              },
            },
          },
        },
      },
      '/api/coupons/available': {
        get: {
          summary: 'List issued, unredeemed coupons (customer only)',
          tags: ['Coupons'],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            200: {
              description: 'Available shared coupons; listing does not reserve them',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      coupons: { type: 'array', items: { $ref: '#/components/schemas/Coupon' } },
                      pagination: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: { description: 'Missing, invalid, or expired token' },
            403: { description: 'Missing coupon:read:available permission' },
          },
        },
      },
      '/api/admin/report': {
        get: {
          summary: 'Return the all-time administrative business report',
          description: 'Read-only summary from one PostgreSQL snapshot; repeated requests do not mutate state.',
          tags: ['Reports'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Reconciled order, product, revenue, and coupon totals',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { report: { $ref: '#/components/schemas/AdminReport' } },
                  },
                },
              },
            },
            401: {
              description: 'Missing, invalid, or expired token',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
              },
            },
            403: {
              description: 'Missing report:read permission',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
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
