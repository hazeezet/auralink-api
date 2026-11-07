import { getSupabase } from "../lib/supabase";
import { bushaClient } from "../lib/busha";
import { config } from "../config";
import { appLogger } from "../lib/logger";
import type { Order, OrderItem, Product, CreateOrderInput, TimelineEvent } from "../types/order";

const uid = () => Math.random().toString(36).slice(2, 9);

export class OrderService {
    /**
     * Creates a new order, requests Busha payment link, and stores in Supabase.
     */
    async createOrder(input: CreateOrderInput): Promise<Order> {
        const supabase = getSupabase();

        if (!input.customer?.trim()) {
            throw new Error("Add the customer name so the ledger can match the payment.");
        }
        if (!input.items || input.items.length === 0) {
            throw new Error("Pick at least one product before creating the link.");
        }

        // Fetch products to validate prices and stock
        const productIds = input.items.map((i) => i.productId);
        const { data: dbProducts, error: prodErr } = await supabase
            .from("products")
            .select("*")
            .in("id", productIds);

        if (prodErr) {
            appLogger.error("Failed to query products from Supabase", prodErr);
            throw new Error(`Failed to check product inventory: ${prodErr.message}`);
        }

        const products: Product[] = (dbProducts || input.products || []) as Product[];

        // Check stock levels
        for (const item of input.items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product) {
                throw new Error(`Product ${item.productId} not found in catalogue.`);
            }
            if (product.stock < item.qty) {
                throw new Error(`Only ${product.stock} of "${product.name}" left in stock. Reduce the quantity.`);
            }
        }

        // Map items
        const items: OrderItem[] = input.items.map((i) => {
            const p = products.find((x) => x.id === i.productId)!;
            return {
                productId: p.id,
                name: p.name,
                qty: i.qty,
                unitPrice: Number(p.price),
                emoji: p.emoji,
            };
        });

        const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
        const discount = Math.min(input.discount ?? 0, subtotal);
        const total = subtotal - discount;

        const id = `ORD-${Math.floor(2000 + Math.random() * 7000)}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + config.rates.quoteMinutes * 60_000).toISOString();

        // Call Busha Sandbox API to generate payment link
        let bushaRef = "";
        try {
            const bushaRes = await bushaClient.createPaymentLink({
                title: `Amaka Threads - ${id}`,
                description: items.map((i) => `${i.qty}x ${i.name}`).join(", "),
                amount: total,
                currency: input.channel === "USDC" ? "USDC" : "NGN",
                expires_in: config.rates.quoteMinutes * 60,
                metadata: {
                    order_id: id,
                    customer: input.customer.trim(),
                    channel: input.channel,
                },
            });
            bushaRef = bushaRes.reference || bushaRes.id;
        } catch (err: unknown) {
            appLogger.error(`Busha payment link creation failed for ${id}:`, err);
            throw err;
        }

        const timeline: TimelineEvent[] = [
            {
                id: uid(),
                label: "Order created",
                note: "One-time link generated for this order only via Busha",
                at: now.toISOString(),
                tone: "neutral",
            },
        ];

        const order: Order = {
            id,
            customer: input.customer.trim(),
            handle: input.handle?.trim() || `@${input.customer.trim().split(" ")[0].toLowerCase()}`,
            city: input.city?.trim() || (input.channel === "USDC" ? "International" : "Nigeria"),
            channel: input.channel,
            items,
            subtotal,
            discount,
            total,
            status: "awaiting",
            ref: bushaRef,
            expiresAt,
            createdAt: now.toISOString(),
            note: input.note?.trim() || undefined,
            timeline,
        };

        // Insert into Supabase
        const { error: insertErr } = await supabase.from("orders").insert({
            id: order.id,
            customer: order.customer,
            handle: order.handle,
            city: order.city,
            channel: order.channel,
            items: order.items,
            subtotal: order.subtotal,
            discount: order.discount,
            total: order.total,
            status: order.status,
            ref: order.ref,
            expires_at: order.expiresAt,
            created_at: order.createdAt,
            note: order.note,
            timeline: order.timeline,
        });

        if (insertErr) {
            appLogger.error("Failed to insert order into Supabase", insertErr);
            throw new Error(`Database error saving order: ${insertErr.message}`);
        }

        // Deduct inventory stock
        for (const item of input.items) {
            const product = products.find((p) => p.id === item.productId);
            if (product) {
                await supabase
                    .from("products")
                    .update({ stock: Math.max(0, product.stock - item.qty) })
                    .eq("id", product.id);
            }
        }

        return order;
    }

    /**
     * Lists orders with optional status or search filters.
     */
    async listOrders(status?: string, query?: string): Promise<Order[]> {
        const supabase = getSupabase();
        let qb = supabase.from("orders").select("*").order("created_at", { ascending: false });

        if (status && status !== "all") {
            qb = qb.eq("status", status);
        }
        if (query) {
            qb = qb.or(`customer.ilike.%${query}%,id.ilike.%${query}%,ref.ilike.%${query}%`);
        }

        const { data, error } = await qb;
        if (error) {
            appLogger.error("Error listing orders from Supabase", error);
            throw new Error(`Database error retrieving orders: ${error.message}`);
        }

        return (data || []).map((row) => this.mapRowToOrder(row));
    }

    /**
     * Gets a single order by ID.
     */
    async getOrderById(id: string): Promise<Order | null> {
        const supabase = getSupabase();
        const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();

        if (error) {
            appLogger.error(`Error retrieving order ${id}`, error);
            throw new Error(`Database error retrieving order: ${error.message}`);
        }
        if (!data) return null;
        return this.mapRowToOrder(data);
    }

    /**
     * Gets an order by its Busha reference string (used on public pay page).
     */
    async getOrderByRef(ref: string): Promise<Order | null> {
        const supabase = getSupabase();
        const { data, error } = await supabase.from("orders").select("*").eq("ref", ref).maybeSingle();

        if (error) {
            appLogger.error(`Error retrieving order by ref ${ref}`, error);
            throw new Error(`Database error retrieving order: ${error.message}`);
        }
        if (!data) return null;
        return this.mapRowToOrder(data);
    }

    /**
     * Cancels an order.
     */
    async cancelOrder(id: string): Promise<Order> {
        const supabase = getSupabase();
        const order = await this.getOrderById(id);
        if (!order) {
            throw new Error(`Order ${id} not found.`);
        }
        if (order.status === "paid") {
            throw new Error(`Cannot cancel an order that is already paid.`);
        }

        const updatedTimeline: TimelineEvent[] = [
            ...order.timeline,
            {
                id: uid(),
                label: "Order cancelled",
                note: "Cancelled by seller",
                at: new Date().toISOString(),
                tone: "bad",
            },
        ];

        const { error } = await supabase
            .from("orders")
            .update({ status: "cancelled", timeline: updatedTimeline })
            .eq("id", id);

        if (error) {
            throw new Error(`Failed to cancel order: ${error.message}`);
        }

        return { ...order, status: "cancelled", timeline: updatedTimeline };
    }

    /**
     * Expires an order when its quote window elapses.
     */
    async expireOrder(id: string): Promise<Order> {
        const supabase = getSupabase();
        const order = await this.getOrderById(id);
        if (!order) {
            throw new Error(`Order ${id} not found.`);
        }
        if (order.status !== "awaiting") {
            return order;
        }

        const updatedTimeline: TimelineEvent[] = [
            ...order.timeline,
            {
                id: uid(),
                label: "Quote expired",
                note: "Quote timer elapsed before payment arrived",
                at: new Date().toISOString(),
                tone: "neutral",
            },
        ];

        const { error } = await supabase
            .from("orders")
            .update({ status: "expired", timeline: updatedTimeline })
            .eq("id", id);

        if (error) {
            throw new Error(`Failed to expire order: ${error.message}`);
        }

        return { ...order, status: "expired", timeline: updatedTimeline };
    }

    private mapRowToOrder(row: Record<string, unknown>): Order {
        return {
            id: String(row.id),
            customer: String(row.customer),
            handle: String(row.handle || ""),
            city: String(row.city || ""),
            channel: (row.channel as "NGN" | "USDC") || "NGN",
            items: (row.items as OrderItem[]) || [],
            subtotal: Number(row.subtotal),
            discount: Number(row.discount || 0),
            total: Number(row.total),
            status: row.status as Order["status"],
            ref: String(row.ref),
            expiresAt: String(row.expires_at),
            createdAt: String(row.created_at),
            paidAt: row.paid_at ? String(row.paid_at) : undefined,
            receivedNgn: row.received_ngn ? Number(row.received_ngn) : undefined,
            note: row.note ? String(row.note) : undefined,
            timeline: (row.timeline as TimelineEvent[]) || [],
        };
    }
}

export const orderService = new OrderService();
