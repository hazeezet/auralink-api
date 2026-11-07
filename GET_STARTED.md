Goal and MVP scope
We build one working path end to end: an order creates a payment link, Busha's webhook
marks it paid, and a ledger line writes itself. Everything else is stretch or cut.
Must have
Seller dashboard: create an order (items, price) and get one payment link for it
Customer pay page: amount, expiry countdown, one pre-selected network with a
plain warning above the pay button
Webhook handler: verify the signature, ignore repeats, mark the order paid, write one
ledger line
Exception states: underpaid, expired, late and unmatched payments each get a visible
status and a suggested action
Ledger view: order, amount received, naira value at settlement, fee, status
Stretch, in this order
1. Convert or pay out to a Nigerian bank through Busha quotes (withdrawal)
2. CSV export of the ledger
3. AI-written month-end summary (needs a real Gemini API key, not only a Gemini Pro
subscription)
Cut
Login and accounts, multiple sellers, refunds, polished diagrams.
Page 1 of 6Getting Amaka Paid: Technical Build Brief
Architecture
architecture · 5 components, 6 steps
Dara's dashboard creates an order, Azeez's API asks Busha for a link, and Busha's signed
webhook is what moves the order to paid and writes the ledger line.
Data model and order states
Three tables are enough. The state machine below is what keeps the dashboard honest,
so both of us code against it.
Tables
Table Key columns
orders id, buyer_name, items, amount_ngn, busha_ref,
status, expires_at, created_at
payments id, order_id (nullable), busha_event_id (unique),
amount, currency, network, received_at,
raw_payload
ledger id, order_id, payment_id, amount_received,
naira_value_at_settlement, fee, status, created_at
The unique busha_event_id is our idempotency guard: a repeated webhook inserts
nothing the second time.
Order states
Page 2 of 6Getting Amaka Paid: Technical Build Brief
From Event To What Amaka sees
created link generated awaiting_payment Link ready to send,
countdown running
awaiting_payment full amount
confirmed
paid Green: send the parcel
awaiting_payment less than due
arrives
underpaid Amber: ask for the balance
or refund
awaiting_payment timer ends,
nothing received
expired Grey: resend a fresh link
expired money arrives
afterwards
late_paid Amber: confirm the price
with the buyer
none payment matches
no order
unmatched Red: hold the parcel,
contact Busha support with
the transaction details
A payment that stays unmatched past about 30 minutes is flagged in the ledger, as in the
original proposal.
Busha integration
Azeez can start tonight: a sandbox business account exists at
sandbox.dash.busha.io/business/signup, and API keys come from Settings, Developer
Tools. Sandbox calls go to https://api.sandbox.busha.so.
Need Busha piece Status
One payment link per
order
POST /v1/payments/links
(supports one-time links, uses
the secret key)
Documented
Payment request with
expiry
Payment request: pay_in
address, source_amount,
expires_at (uses the public
key)
Documented
Paid notification Webhook to a public URL,
signed in the x-bu-signature
header (HMAC of the body
with the webhook secret)
Documented
Page 3 of 6Getting Amaka Paid: Technical Build Brief
Need Busha piece Status
Payment status check Retrieve payment request Documented
Convert or pay out to a
bank
POST /v1/quotes with type
"withdrawal", then transfer
status by webhook
Documented, needs a
funded sandbox balance
Per-order temporary naira
account
Mentioned in both
prescreening PDFs
Unverified: check the
sandbox before building on
it
Exact webhook event
names for partial, late or
failed payments
Webhook setup page lists the
events
Unverified: read the list first
thing tomorrow
A real customer paying a
sandbox link
Docs show simulated fiat
deposits to fund a balance, not
a customer paying our link
Unverified: if impossible,
use our own simulatepayment endpoint and tell
the judges
Rules for the webhook
The URL must be public, so localhost will not work. Deploy early or use a tunnel.
Return 200 quickly, and do the slow work after.
Verify the signature on the raw request body before trusting anything in it.
Use the unique event id so a repeat delivery changes nothing.
Split of work
Azeez owns everything that talks to Busha and decides an order's state. Dara owns
everything a person looks at, plus the story. Suggested stack, to confirm tonight: Next.js
and Supabase, deployed on Vercel, so the webhook gets a public URL from the first
deploy.
Order Azeez (backend) Dara (frontend and story)
1 Repo, Supabase project and Vercel
deploy live
Agree the data shapes with Azeez
(orders, payments, ledger)
2 Busha client wrapper: create link or
payment request, behind one interface
3 Webhook route: signature check,
idempotency, order marked paid
Seller dashboard: create order form,
orders list with status chips
Customer pay page: amount,
countdown, network warning
Page 4 of 6Getting Amaka Paid: Technical Build Brief
Order Azeez (backend) Dara (frontend and story)
4 State machine for underpaid, expired,
late and unmatched
Exception display: colour and
suggested action per state
5 Ledger writes, plus a simulate-payment
endpoint as the fallback
Ledger screen: one row per confirmed
payment
6 Stretch: quote and payout, CSV, AI
summary
Demo script, pitch and slides if needed,
test data for two buyers
The interface in row 2 matters most. If the Busha wrapper is one file with one swap point,
a missing sandbox feature costs minutes, not hours.
Pre-build checklist and risks
The one test that settles most unknowns: create a payment link from code, receive its
webhook at a public URL, and see what arrives.
Tonight, both of you
Install the Busha app and sign up (prizes are paid there)
Agree the stack and the data shapes for orders, payments and ledger
Tonight, Azeez
Create a sandbox business account and generate API keys
Create one payment link from code (curl or a script)
Deploy a bare webhook endpoint to a public URL and log everything it receives
Read the webhook events list and note the names for paid, partial, expired and failed
Check whether a customer payment against a sandbox link can be simulated
Check that the Gemini key works through the API, not only the app
Tonight, Dara
Sketch the three screens: dashboard, pay page, ledger
Draft the one-minute pitch and a demo script with two phones
Prepare two test buyers: Ibadan paying naira, Manchester paying USDC
Risks and fallbacks
Risk Fallback
Sandbox cannot simulate a customer paying
our link
Our own simulate-payment button fires the
same webhook handler; say so to the judges
Page 5 of 6Getting Amaka Paid: Technical Build Brief
Risk Fallback
Per-order naira account is not available Use the payment link checkout for naira
Partial or late events have different names
than expected
Compute underpaid, expired and late from
amounts and timestamps ourselves
Webhook cannot reach localhost Deploy first, test against the live URL
Gemini API access is missing Cut the AI summary, keep the ledger
