// Follow this type definition from the deno.land/x/stripe@0.155.0 module
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
        return new Response('No signature', { status: 400 });
    }

    try {
        const body = await req.text();
        const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

        console.log(`Received event: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaid(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaymentFailed(invoice);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (err) {
        console.error('Error processing webhook:', err);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const shopId = session.metadata?.shop_id;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!shopId) {
        console.error('No shop_id in session metadata');
        return;
    }

    // Recupera dettagli subscription da Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Determina il piano (mensile o annuale) basato sull'intervallo
    const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;
    const plan = priceInterval === 'year' ? 'yearly' : 'monthly';

    // Inserisci o aggiorna subscription
    const { error } = await supabase
        .from('shop_subscriptions')
        .upsert({
            shop_id: shopId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: mapStripeStatus(subscription.status),
            plan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
        }, {
            onConflict: 'shop_id',
        });

    if (error) {
        console.error('Error upserting subscription:', error);
    } else {
        console.log(`Subscription created/updated for shop ${shopId}`);
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const subscriptionId = subscription.id;

    // Trova shop_id dalla subscription esistente
    const { data: existingSub } = await supabase
        .from('shop_subscriptions')
        .select('shop_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

    if (!existingSub) {
        console.log('Subscription not found in database, might be new');
        return;
    }

    const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;
    const plan = priceInterval === 'year' ? 'yearly' : 'monthly';

    const { error } = await supabase
        .from('shop_subscriptions')
        .update({
            status: mapStripeStatus(subscription.status),
            plan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
        })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        console.error('Error updating subscription:', error);
    } else {
        console.log(`Subscription ${subscriptionId} updated`);
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const subscriptionId = subscription.id;

    const { error } = await supabase
        .from('shop_subscriptions')
        .update({
            status: 'canceled',
            cancel_at_period_end: false,
        })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        console.error('Error marking subscription as canceled:', error);
    } else {
        console.log(`Subscription ${subscriptionId} marked as canceled`);
    }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.subscription as string;
    const customerId = invoice.customer as string;

    // Trova shop_id
    const { data: sub } = await supabase
        .from('shop_subscriptions')
        .select('shop_id, id')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

    if (!sub) {
        console.log('No subscription found for invoice');
        return;
    }

    // Inserisci fattura
    const { error } = await supabase
        .from('subscription_invoices')
        .upsert({
            shop_id: sub.shop_id,
            subscription_id: sub.id,
            stripe_invoice_id: invoice.id,
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
            status: 'paid',
            invoice_pdf: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            period_start: invoice.period_start
                ? new Date(invoice.period_start * 1000).toISOString()
                : null,
            period_end: invoice.period_end
                ? new Date(invoice.period_end * 1000).toISOString()
                : null,
        }, {
            onConflict: 'stripe_invoice_id',
        });

    if (error) {
        console.error('Error inserting invoice:', error);
    } else {
        console.log(`Invoice ${invoice.id} recorded as paid`);
    }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.subscription as string;

    // Aggiorna stato subscription
    const { error } = await supabase
        .from('shop_subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        console.error('Error updating subscription to past_due:', error);
    } else {
        console.log(`Subscription ${subscriptionId} marked as past_due due to failed payment`);
    }
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
    const statusMap: Record<string, string> = {
        'trialing': 'trialing',
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'unpaid': 'unpaid',
        'incomplete': 'incomplete',
        'incomplete_expired': 'incomplete_expired',
        'paused': 'canceled', // Map paused to canceled
    };
    return statusMap[stripeStatus] || 'incomplete';
}
