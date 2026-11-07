import { type FastifyPluginAsync } from "fastify";
import { orderService } from "../../services/order.service";
import { paymentService } from "../../services/payment.service";
import type { CreateOrderInput } from "../../types/order";

const ordersRoutes: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
    // 1. Create Order Link
    fastify.post<{ Body: CreateOrderInput }>("/api/orders", {
        schema: {
            tags: ["Orders"],
            summary: "Create a new order and generate Busha payment link",
            body: {
                type: "object",
                required: ["customer", "items", "channel"],
                properties: {
                    customer: { type: "string" },
                    handle: { type: "string" },
                    city: { type: "string" },
                    channel: { type: "string", enum: ["NGN", "USDC"] },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["productId", "qty"],
                            properties: {
                                productId: { type: "string" },
                                qty: { type: "integer", minimum: 1 },
                            },
                        },
                    },
                    discount: { type: "number" },
                    note: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const order = await orderService.createOrder(request.body);
            return reply.status(201).send({
                ...order,
                status_code: 201,
                error: null,
                message: "Order created successfully",
                data: order,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create order";
            return reply.status(400).send({
                status_code: 400,
                error: "BAD_REQUEST",
                message,
                data: null,
            });
        }
    });

    // 2. List Orders
    fastify.get<{ Querystring: { status?: string; q?: string } }>("/api/orders", {
        schema: {
            tags: ["Orders"],
            summary: "List all orders with optional status or search filter",
            querystring: {
                type: "object",
                properties: {
                    status: { type: "string" },
                    q: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const orders = await orderService.listOrders(request.query.status, request.query.q);
            return reply.send({
                status_code: 200,
                error: null,
                message: "Orders retrieved successfully",
                data: orders,
                orders, // Dual compatibility
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to list orders";
            return reply.status(500).send({
                status_code: 500,
                error: "DATABASE_ERROR",
                message,
                data: [],
            });
        }
    });

    // 3. Get Order by ID
    fastify.get<{ Params: { id: string } }>("/api/orders/:id", {
        schema: {
            tags: ["Orders"],
            summary: "Get order details by order ID",
            params: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const order = await orderService.getOrderById(request.params.id);
        if (!order) {
            return reply.status(404).send({
                status_code: 404,
                error: "NOT_FOUND",
                message: `Order ${request.params.id} not found`,
                data: null,
            });
        }
        return reply.send({
            ...order,
            status_code: 200,
            error: null,
            message: "Order retrieved",
            data: order,
        });
    });

    // 4. Get Order by Busha Ref (for Public Buyer Pay Page)
    fastify.get<{ Params: { ref: string } }>("/api/orders/ref/:ref", {
        schema: {
            tags: ["Orders"],
            summary: "Get order by Busha reference string",
            params: {
                type: "object",
                required: ["ref"],
                properties: {
                    ref: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const order = await orderService.getOrderByRef(request.params.ref);
        if (!order) {
            return reply.status(404).send({
                status_code: 404,
                error: "NOT_FOUND",
                message: `Order with ref ${request.params.ref} not found`,
                data: null,
            });
        }
        return reply.send({
            ...order,
            status_code: 200,
            error: null,
            message: "Order retrieved",
            data: order,
        });
    });

    // 5. Cancel Order
    fastify.post<{ Params: { id: string } }>("/api/orders/:id/cancel", {
        schema: {
            tags: ["Orders"],
            summary: "Cancel an awaiting order",
            params: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const order = await orderService.cancelOrder(request.params.id);
            return reply.send({
                ...order,
                status_code: 200,
                error: null,
                message: "Order cancelled",
                data: order,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to cancel order";
            return reply.status(400).send({
                status_code: 400,
                error: "BAD_REQUEST",
                message,
                data: null,
            });
        }
    });

    // 6. Expire Order
    fastify.post<{ Params: { id: string } }>("/api/orders/:id/expire", {
        schema: {
            tags: ["Orders"],
            summary: "Expire an awaiting order when quote runs out",
            params: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const order = await orderService.expireOrder(request.params.id);
            return reply.send({
                ...order,
                status_code: 200,
                error: null,
                message: "Order expired",
                data: order,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to expire order";
            return reply.status(400).send({
                status_code: 400,
                error: "BAD_REQUEST",
                message,
                data: null,
            });
        }
    });

    // 7. Demo Sandbox Simulation Endpoint
    fastify.post<{ Params: { id: string }; Body?: { amountNgn?: number } }>("/api/orders/:id/simulate", {
        schema: {
            tags: ["Sandbox"],
            summary: "Simulate a customer payment against an order for live presentation",
            params: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string" },
                },
            },
            body: {
                type: "object",
                properties: {
                    amountNgn: { type: "number" },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const updatedOrder = await paymentService.simulatePayment(
                request.params.id,
                request.body?.amountNgn,
            );
            return reply.send({
                ...updatedOrder,
                status_code: 200,
                error: null,
                message: "Payment simulated successfully",
                data: updatedOrder,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Simulation failed";
            return reply.status(400).send({
                status_code: 400,
                error: "BAD_REQUEST",
                message,
                data: null,
            });
        }
    });
};

export default ordersRoutes;
