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
    },
  },
  apis: [],
});

module.exports = swaggerSpec;
