import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "#types/order";

export interface ProductDB {
    list(): Promise<Product[]>;
    findByIds(ids: string[]): Promise<Product[]>;
    decrementStock(items: { productId: string; qty: number }[]): Promise<void>;
}

export function createProductDB(supabase: SupabaseClient): ProductDB {
    return {
        async list(): Promise<Product[]> {
            const { data, error } = await supabase.from("products").select("*").order("name");
            if (error) {
                throw new Error(`Failed to list products: ${error.message}`);
            }
            return (data || []).map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                stock: Number(p.stock),
                emoji: p.emoji,
                sku: p.sku,
            }));
        },

        async findByIds(ids: string[]): Promise<Product[]> {
            const { data, error } = await supabase.from("products").select("*").in("id", ids);
            if (error) {
                throw new Error(`Failed to find products by ids: ${error.message}`);
            }
            return (data || []).map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                stock: Number(p.stock),
                emoji: p.emoji,
                sku: p.sku,
            }));
        },

        async decrementStock(items: { productId: string; qty: number }[]): Promise<void> {
            for (const item of items) {
                const { data } = await supabase
                    .from("products")
                    .select("stock")
                    .eq("id", item.productId)
                    .maybeSingle();

                if (data) {
                    const currentStock = Number(data.stock);
                    await supabase
                        .from("products")
                        .update({ stock: Math.max(0, currentStock - item.qty) })
                        .eq("id", item.productId);
                }
            }
        },
    };
}
