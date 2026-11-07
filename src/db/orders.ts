import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderItem, OrderStatus, TimelineEvent } from "#types/order";

export interface OrderDB {
    create(order: Order): Promise<Order>;
    findById(id: string): Promise<Order | null>;
    findByRef(ref: string): Promise<Order | null>;
    list(status?: string, query?: string): Promise<Order[]>;
    updateStatus(
        id: string,
        status: OrderStatus,
        paidAt?: string,
        receivedNgn?: number,
        note?: string,
        newTimeline?: TimelineEvent,
    ): Promise<Order | null>;
    cancel(id: string): Promise<Order | null>;
    expire(id: string): Promise<Order | null>;
}

function mapRowToOrder(row: Record<string, unknown>): Order {
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
        status: row.status as OrderStatus,
        ref: String(row.ref),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        paidAt: row.paid_at ? String(row.paid_at) : undefined,
        receivedNgn: row.received_ngn ? Number(row.received_ngn) : undefined,
        note: row.note ? String(row.note) : undefined,
        timeline: (row.timeline as TimelineEvent[]) || [],
    };
}

export function createOrderDB(supabase: SupabaseClient): OrderDB {
    return {
        async create(order: Order): Promise<Order> {
            const { error } = await supabase.from("orders").insert({
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

            if (error) {
                throw new Error(`Failed to insert order: ${error.message}`);
            }

            return order;
        },

        async findById(id: string): Promise<Order | null> {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .eq("id", id)
                .maybeSingle();

            if (error) {
                throw new Error(`Failed to fetch order ${id}: ${error.message}`);
            }
            if (!data) {return null;}
            return mapRowToOrder(data);
        },

        async findByRef(ref: string): Promise<Order | null> {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .eq("ref", ref)
                .maybeSingle();

            if (error) {
                throw new Error(`Failed to fetch order by ref ${ref}: ${error.message}`);
            }
            if (!data) {return null;}
            return mapRowToOrder(data);
        },

        async list(status?: string, query?: string): Promise<Order[]> {
            let qb = supabase.from("orders").select("*").order("created_at", { ascending: false });

            if (status && status !== "all") {
                qb = qb.eq("status", status);
            }
            if (query) {
                qb = qb.or(`customer.ilike.%${query}%,id.ilike.%${query}%,ref.ilike.%${query}%`);
            }

            const { data, error } = await qb;
            if (error) {
                throw new Error(`Failed to list orders: ${error.message}`);
            }
            return (data || []).map((row) => mapRowToOrder(row));
        },

        async updateStatus(
            id: string,
            status: OrderStatus,
            paidAt?: string,
            receivedNgn?: number,
            note?: string,
            newTimeline?: TimelineEvent,
        ): Promise<Order | null> {
            const existing = await this.findById(id);
            if (!existing) {return null;}

            const timeline = newTimeline ? [...existing.timeline, newTimeline] : existing.timeline;

            const updateData: Record<string, unknown> = {
                status,
                timeline,
            };
            if (paidAt) {updateData.paid_at = paidAt;}
            if (receivedNgn !== undefined) {updateData.received_ngn = receivedNgn;}
            if (note) {updateData.note = note;}

            const { data, error } = await supabase
                .from("orders")
                .update(updateData)
                .eq("id", id)
                .select("*")
                .maybeSingle();

            if (error || !data) {
                throw new Error(`Failed to update order status: ${error?.message || "Unknown error"}`);
            }
            return mapRowToOrder(data);
        },

        async cancel(id: string): Promise<Order | null> {
            const existing = await this.findById(id);
            if (!existing) {return null;}

            const timeline: TimelineEvent[] = [
                ...existing.timeline,
                {
                    id: Math.random().toString(36).slice(2, 9),
                    label: "Order cancelled",
                    note: "Cancelled by seller",
                    at: new Date().toISOString(),
                    tone: "bad",
                },
            ];

            const { data, error } = await supabase
                .from("orders")
                .update({ status: "cancelled", timeline })
                .eq("id", id)
                .select("*")
                .maybeSingle();

            if (error || !data) {
                throw new Error(`Failed to cancel order: ${error?.message || "Unknown error"}`);
            }
            return mapRowToOrder(data);
        },

        async expire(id: string): Promise<Order | null> {
            const existing = await this.findById(id);
            if (!existing) {return null;}

            const timeline: TimelineEvent[] = [
                ...existing.timeline,
                {
                    id: Math.random().toString(36).slice(2, 9),
                    label: "Quote expired",
                    note: "Quote timer elapsed before payment arrived",
                    at: new Date().toISOString(),
                    tone: "neutral",
                },
            ];

            const { data, error } = await supabase
                .from("orders")
                .update({ status: "expired", timeline })
                .eq("id", id)
                .select("*")
                .maybeSingle();

            if (error || !data) {
                throw new Error(`Failed to expire order: ${error?.message || "Unknown error"}`);
            }
            return mapRowToOrder(data);
        },
    };
}
