import type { FastifyPluginAsync } from "fastify";
import { ErrorCodes } from "#types/response";
import { config } from "#src/config/index";
import { convertSchema, withdrawSchema } from "./schema";

const treasuryRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
    /**
     * POST /v1/treasury/withdraw - Bank Payout
     */
    fastify.post<{ Body: { amount: number; bankCode?: string; accountNumber?: string } }>(
        "/withdraw",
        { schema: withdrawSchema },
        async (request, reply) => {
            const { amount } = request.body;
            const current = await fastify.db.balances.get();

            if (amount <= 0) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = "Withdrawal amount must be greater than zero";
                return reply.send(reply.response);
            }
            if (amount < 100) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = "Minimum withdrawal is ₦100";
                return reply.send(reply.response);
            }
            if (amount > current.ngn) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = `Insufficient balance. Available: ₦${current.ngn.toLocaleString("en-NG")}`;
                return reply.send(reply.response);
            }

            // Create Busha withdrawal quote
            let quoteId: string | null = null;
            try {
                const quote = await fastify.busha.createQuote({
                    source_currency: "NGN",
                    target_currency: "NGN",
                    source_amount: amount,
                    type: "withdrawal",
                });
                quoteId = quote.id;
            } catch (err) {
                fastify.log.warn(`Busha withdrawal quote failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            const newBalances = await fastify.db.balances.debitNgn(amount);

            reply.response.message = "Withdrawal processed successfully";
            reply.response.data = {
                success: true,
                quoteId,
                balances: newBalances,
            };
            return reply.send(reply.response);
        },
    );

    /**
     * POST /v1/treasury/convert - Convert NGN to USDC
     */
    fastify.post<{ Body: { amountNgn: number } }>(
        "/convert",
        { schema: convertSchema },
        async (request, reply) => {
            const { amountNgn } = request.body;
            const current = await fastify.db.balances.get();

            if (amountNgn <= 0 || amountNgn > current.ngn) {
                reply.status(400);
                reply.response.status_code = 400;
                reply.response.error = ErrorCodes.BAD_REQUEST;
                reply.response.message = "Invalid conversion amount";
                return reply.send(reply.response);
            }

            let usdcGained = +(amountNgn / config.rates.usdcNgn).toFixed(2);
            try {
                const quote = await fastify.busha.createQuote({
                    source_currency: "NGN",
                    target_currency: "USDC",
                    source_amount: amountNgn,
                });
                if (quote.target_amount) {
                    usdcGained = quote.target_amount;
                }
            } catch (err) {
                fastify.log.warn(`Busha conversion quote failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            const newBalances = await fastify.db.balances.convert(amountNgn, usdcGained);

            reply.response.message = "Conversion completed successfully";
            reply.response.data = {
                success: true,
                usdcGained,
                balances: newBalances,
            };
            return reply.send(reply.response);
        },
    );
};

export default treasuryRoutes;

