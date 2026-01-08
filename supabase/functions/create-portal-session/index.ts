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

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { shop_id, return_url } = body;

        if (!shop_id) {
            return new Response(JSON.stringify({ error: 'Missing shop_id' }), {
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

        // Trova customer ID
        const { data: sub } = await supabase
            .from('shop_subscriptions')
            .select('stripe_customer_id')
            .eq('shop_id', shop_id)
            .single();

        if (!sub?.stripe_customer_id) {
            return new Response(JSON.stringify({ error: 'No subscription found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Crea sessione portal
        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripe_customer_id,
            return_url: return_url || `${req.headers.get('origin')}/settings?tab=subscription`,
        });

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Error creating portal session:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
