import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Unauthorized' }, 401)

    const url = required('SUPABASE_URL')
    const userClient = createClient(url, required('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } } })
    const admin = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('full_name,email,email_updates,welcome_email_sent_at')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    if (!profile.email_updates) return json({ skipped: 'not_opted_in' })
    if (profile.welcome_email_sent_at) return json({ skipped: 'already_sent' })

    const recipient = profile.email || user.email
    if (!recipient) return json({ skipped: 'no_email' })
    const name = profile.full_name?.trim() || 'Aspirant'
    const appUrl = Deno.env.get('APP_URL') || 'https://penni.app'
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${required('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: required('EMAIL_FROM'),
        to: [recipient],
        subject: 'Welcome to Penni — your preparation, organised',
        html: welcomeTemplate(name, appUrl),
      }),
    })
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`)

    await admin.from('profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', user.id)
    return json({ sent: true })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Email delivery failed' }, 500)
  }
})

function required(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function welcomeTemplate(name: string, appUrl: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172246"><div style="max-width:600px;margin:auto;padding:36px 20px"><div style="background:#fff;border:1px solid #e4e8f1;border-radius:24px;padding:32px"><div style="font-size:28px;font-weight:800">Penni<span style="color:#f0a43e">.</span></div><h1 style="font-size:26px;line-height:1.15;margin:28px 0 12px">Welcome, ${escapeHtml(name)}</h1><p style="font-size:15px;line-height:1.7;color:#5b647b">Your daily current affairs, practice targets, revision and progress now live in one focused workspace.</p><a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#172246;color:#fff;text-decoration:none;font-weight:700">Open Penni</a><p style="margin-top:28px;font-size:12px;line-height:1.6;color:#8a91a4">You opted in to Penni updates. You can change email preferences anytime in Settings.</p></div></div></body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}
