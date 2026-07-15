import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-broadcast-secret',
}

type BroadcastBody = {
  type: 'daily' | 'feature'
  date?: string
  articleCount?: number
  title?: string
  summary?: string
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = required('SUPABASE_URL')
    const admin = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'))
    const configuredSecret = Deno.env.get('BROADCAST_SECRET')
    const secretAuthorized = Boolean(configuredSecret && request.headers.get('x-broadcast-secret') === configuredSecret)
    let editorAuthorized = false
    if (!secretAuthorized) {
      const authorization = request.headers.get('Authorization')
      if (authorization) {
        const userClient = createClient(url, required('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } } })
        const { data: { user } } = await userClient.auth.getUser()
        if (user) {
          const { data: editor } = await admin.from('editors').select('user_id').eq('user_id', user.id).maybeSingle()
          editorAuthorized = Boolean(editor)
        }
      }
    }
    if (!secretAuthorized && !editorAuthorized) return json({ error: 'Unauthorized' }, 401)
    const body = await request.json() as BroadcastBody
    if (body.type !== 'daily' && body.type !== 'feature') return json({ error: 'Invalid broadcast type' }, 400)

    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id,full_name,email,phone,email_updates,whatsapp_updates')
      .or('email_updates.eq.true,whatsapp_updates.eq.true')
    if (error) throw error

    const appUrl = Deno.env.get('APP_URL') || 'https://penni.app'
    const emailProfiles = (profiles ?? []).filter(profile => profile.email_updates && profile.email)
    const whatsappProfiles = (profiles ?? []).filter(profile => profile.whatsapp_updates && profile.phone)

    const emailSent = await sendEmails(emailProfiles, body, appUrl)
    const whatsappSent = await sendWhatsApp(whatsappProfiles, body, appUrl)
    const now = new Date().toISOString()
    if (emailSent.ids.length) await admin.from('profiles').update({ last_digest_sent_at: now }).in('id', emailSent.ids)
    if (whatsappSent.ids.length) await admin.from('profiles').update({ last_whatsapp_sent_at: now }).in('id', whatsappSent.ids)

    return json({ email: emailSent.count, whatsapp: whatsappSent.count, type: body.type })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Broadcast failed' }, 500)
  }
})

async function sendEmails(profiles: Array<Record<string, string>>, body: BroadcastBody, appUrl: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!key || !from || profiles.length === 0) return { count: 0, ids: [] as string[] }
  const ids: string[] = []
  for (const group of chunks(profiles, 100)) {
    const payload = group.map(profile => ({
      from,
      to: [profile.email],
      subject: body.type === 'daily' ? `Your Penni briefing for ${body.date || 'today'} is ready` : body.title || 'What’s new in Penni',
      html: updateTemplate(profile.full_name || 'Aspirant', body, appUrl),
    }))
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (response.ok) ids.push(...group.map(profile => profile.id))
    else console.error('Resend batch failed', response.status, await response.text())
  }
  return { count: ids.length, ids }
}

async function sendWhatsApp(profiles: Array<Record<string, string>>, body: BroadcastBody, appUrl: string) {
  const token = Deno.env.get('META_WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const template = Deno.env.get(body.type === 'daily' ? 'WHATSAPP_TEMPLATE_DAILY' : 'WHATSAPP_TEMPLATE_FEATURE')
  if (!token || !phoneId || !template || profiles.length === 0) return { count: 0, ids: [] as string[] }
  const ids: string[] = []
  for (const profile of profiles) {
    const parameters = body.type === 'daily'
      ? [profile.full_name || 'Aspirant', body.date || 'today', String(body.articleCount || 0), appUrl]
      : [profile.full_name || 'Aspirant', body.title || 'New in Penni', body.summary || 'Open Penni to explore the latest update.', appUrl]
    const response = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: profile.phone.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: template,
          language: { code: 'en' },
          components: [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }],
        },
      }),
    })
    if (response.ok) ids.push(profile.id)
    else console.error('WhatsApp send failed', response.status, await response.text())
  }
  return { count: ids.length, ids }
}

function updateTemplate(name: string, body: BroadcastBody, appUrl: string) {
  const heading = body.type === 'daily' ? `Today’s briefing is ready` : body.title || 'What’s new in Penni'
  const copy = body.type === 'daily'
    ? `${body.articleCount || 'New'} UPSC-focused stories are ready for ${body.date || 'today'}.`
    : body.summary || 'Open Penni to explore the latest update.'
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172246"><div style="max-width:600px;margin:auto;padding:36px 20px"><div style="background:#fff;border:1px solid #e4e8f1;border-radius:24px;padding:32px"><div style="font-size:26px;font-weight:800">Penni<span style="color:#f0a43e">.</span></div><p style="margin:26px 0 6px;color:#6b7489">Hello ${escapeHtml(name)},</p><h1 style="font-size:25px;line-height:1.2;margin:0 0 12px">${escapeHtml(heading)}</h1><p style="font-size:15px;line-height:1.7;color:#5b647b">${escapeHtml(String(copy))}</p><a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#172246;color:#fff;text-decoration:none;font-weight:700">Open Penni</a><p style="margin-top:28px;font-size:12px;color:#8a91a4">You opted in to Penni updates. Unsubscribe anytime in Settings.</p></div></div></body></html>`
}

function required(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`${name} is not configured`); return value }
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function chunks<T>(items: T[], size: number) { return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)) }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!) }
