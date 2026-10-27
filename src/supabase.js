import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ontbrekende configuratie mag de app niet laten crashen tot een wit scherm:
// we onthouden de fout en tonen ze netjes via het foutscherm.
export const configError = (!supabaseUrl || !supabaseKey)
  ? 'De app is niet goed geconfigureerd (VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt in Vercel).'
  : null
export const supabase = configError ? null : createClient(supabaseUrl, supabaseKey)

// Zonder time-out blijft de app eindeloos "laden" als het netwerk de database
// tegenhoudt (bv. een firewall of adblocker die supabase.co blokkeert).
// Ruim genomen (45s) zodat trage mobiele verbindingen niet onterecht falen.
// De aanvraag wordt bij een time-out ook echt AFGEBROKEN, zodat een trage
// schrijfactie niet achteraf alsnog een nieuwere wijziging kan overschrijven.
export const TIMEOUT_MS = 45000
async function withTimeout(buildQuery, what) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await buildQuery().abortSignal(ctrl.signal)
    if (ctrl.signal.aborted) throw new Error(`geen antwoord van de database na ${TIMEOUT_MS / 1000} seconden (${what})`)
    return res
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`geen antwoord van de database na ${TIMEOUT_MS / 1000} seconden (${what})`)
    throw e
  } finally {
    clearTimeout(t)
  }
}

// Leest één sleutel.
//  - Rij bestaat niet          → null
//  - Fout (netwerk, rechten…)  → GOOIT een fout
// Vroeger gaf een fout ook gewoon null terug, waardoor de app dacht dat er geen
// gegevens waren en de echte data met standaardwaarden overschreef.
export async function dbGet(key) {
  if (configError) throw new Error(configError)
  let res
  try {
    res = await withTimeout(
      () => supabase.from('app_data').select('value').eq('id', key).maybeSingle(),
      `laden van '${key}'`
    )
  } catch (e) {
    throw new Error(`Kan '${key}' niet laden: ${e?.message || e}`)
  }
  const { data, error } = res
  if (error) throw new Error(`Kan '${key}' niet laden: ${error.message || error}${error.code ? ` (${error.code})` : ''}`)
  if (!data || data.value == null) return null
  try {
    return JSON.parse(data.value)
  } catch {
    throw new Error(`De gegevens van '${key}' zijn beschadigd (geen geldige JSON).`)
  }
}

// Schrijft één sleutel. GOOIT een fout als het opslaan mislukt, zodat de app
// dat kan melden in plaats van te doen alsof alles bewaard is.
export async function dbSet(key, value) {
  if (configError) throw new Error(configError)
  let res
  try {
    res = await withTimeout(
      () => supabase.from('app_data').upsert({
        id: key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      }),
      `opslaan van '${key}'`
    )
  } catch (e) {
    throw new Error(`Kan '${key}' niet opslaan: ${e?.message || e}`)
  }
  if (res?.error) throw new Error(`Kan '${key}' niet opslaan: ${res.error.message || res.error}${res.error.code ? ` (${res.error.code})` : ''}`)
}
