import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verifica autenticazione
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Crea client autenticato per verificare l'utente
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { shop_id, price_id, success_url, cancel_url } = body;

        if (!shop_id || !price_id) {
            return new Response(JSON.stringify({ error: 'Missing shop_id or price_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verifica che l'utente abbia accesso allo shop
        const { data: profile } = await supabase
            .from('profiles')
            .select('shop_id, role')
            .eq('user_id', user.id)
            .single();

        if (!profile || profile.shop_id !== shop_id) {
            return new Response(JSON.stringify({ error: 'Unauthorized for this shop' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Solo owner e admin possono gestire abbonamenti
        if (!['owner', 'admin'].includes(profile.role || '')) {
            return new Response(JSON.stringify({ error: 'Only owners and admins can manage subscriptions' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Controlla se esiste già una subscription per questo shop
        const { data: existingSub } = await supabase
            .from('shop_subscriptions')
            .select('stripe_customer_id')
            .eq('shop_id', shop_id)
            .single();

        let customerId: string;

        if (existingSub?.stripe_customer_id) {
            // Usa customer esistente
            customerId = existingSub.stripe_customer_id;
        } else {
            // Recupera info shop per creare customer
            const { data: shop } = await supabase
                .from('shops')
                .select('name, email')
                .eq('id', shop_id)
                .single();

            // Crea nuovo customer Stripe
            const customer = await stripe.customers.create({
                email: shop?.email || user.email,
                name: shop?.name || 'Shop',
                metadata: {
                    shop_id,
                    user_id: user.id,
                },
            });
            customerId = customer.id;
        }

        // Crea sessione checkout
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: price_id,
                    quantity: 1,
                },
            ],
            success_url: success_url || `${req.headers.get('origin')}/settings?tab=subscription&success=true`,
            cancel_url: cancel_url || `${req.headers.get('origin')}/settings?tab=subscription&canceled=true`,
            metadata: {
                shop_id,
            },
            subscription_data: {
                metadata: {
                    shop_id,
                },
            },
            // Consenti cambio quantità
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            // Aggiungi trial se configurato
            // subscription_data: {
            //   trial_period_days: 14,
            // },
        });

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Error creating checkout session:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
